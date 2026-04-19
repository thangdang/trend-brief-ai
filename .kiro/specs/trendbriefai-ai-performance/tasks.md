# Implementation Plan: TrendBrief AI Engine Performance

## Overview

Incremental implementation of 10 performance and quality improvements to the `trendbriefai-engine` Python/FastAPI service. Tasks are ordered to build foundational components first (config, caching, quality scoring), then enhance existing modules (summarizer, classifier, dedup, cleaner), and finally wire everything together in the concurrent pipeline. Each task builds on previous steps and ends with integration.

## Tasks

- [x] 1. Extend configuration and add new dependencies
  - [x] 1.1 Add new settings to `config.py`
    - Add `summarizer_batch_size`, `lru_cache_max_size`, `redis_ai_cache_ttl`, `classifier_keyword_threshold`, `classifier_keyword_weight`, `classifier_zero_shot_weight`, `faiss_top_k`, `faiss_rebuild_interval_hours`, `pipeline_concurrency_limit`, `pipeline_rate_limit_delay`, `quality_score_threshold` fields to the `Settings` class
    - _Requirements: 1.1, 2.3, 4.2, 4.4, 5.2, 5.4, 7.1, 7.2, 9.3_
  - [x] 1.2 Update `requirements.txt` with new dependencies
    - Add `faiss-cpu`, `hypothesis` (dev), and ensure `transformers` version supports zero-shot pipeline
    - _Requirements: 5.1, 4.1_

- [x] 2. Implement content quality scorer (`services/quality_scorer.py`)
  - [x] 2.1 Create `QualitySignals` dataclass and `ContentQualityScorer` class
    - Implement `_length_score`, `_structure_score`, `_vietnamese_ratio`, `_spam_score` signal methods
    - Implement `score()` method returning `QualitySignals` with weighted `overall` field (0.3×length + 0.25×structure + 0.25×vn_ratio + 0.2×(1−spam))
    - All scores must be clamped to [0.0, 1.0]
    - Log quality score and signal values for each article
    - _Requirements: 9.1, 9.2, 9.4, 9.5_
  - [x]* 2.2 Write property test for quality score range (Property 17)
    - **Property 17: Quality score range and signals invariant**
    - Generate random text strings (including empty) and verify all signal values and `overall` are in [0.0, 1.0]
    - **Validates: Requirements 9.1, 9.2**
  - [x]* 2.3 Write property test for quality threshold gate (Property 18)
    - **Property 18: Quality threshold gate**
    - Generate texts with varying quality, verify articles below threshold are marked "failed" and articles above threshold proceed to summarization
    - **Validates: Requirements 9.3**

- [x] 3. Enhance Vietnamese text cleaning (`services/cleaner.py`)
  - [x] 3.1 Add Vietnamese-specific artifact removal
    - Add regex patterns for "Đọc thêm:", "Xem thêm:", "Tin liên quan:", "Bài liên quan:", source attribution ("Nguồn:", "Theo:"), copyright notices ("©"), advertisement markers, and social sharing text fragments
    - Implement repeated paragraph detection and removal
    - Ensure all text passes through `unicodedata.normalize("NFC", ...)` and Vietnamese diacritical marks are preserved
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x]* 3.2 Write property test for NFC normalization idempotence (Property 15)
    - **Property 15: Vietnamese NFC normalization idempotence**
    - Generate random Vietnamese Unicode strings and verify `normalize('NFC', normalize('NFC', text)) == normalize('NFC', text)`
    - **Validates: Requirements 8.1**
  - [x]* 3.3 Write property test for Vietnamese cleaning completeness (Property 16)
    - **Property 16: Vietnamese cleaning completeness**
    - Generate texts with injected Vietnamese artifacts and verify all artifacts are removed while diacritical marks in content are preserved
    - **Validates: Requirements 8.2, 8.3, 8.4**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Redis AI cache (`services/cache/redis_cache.py`)
  - [x] 5.1 Create `RedisAICache` class
    - Implement `get_summary`, `put_summary`, `get_classification`, `put_classification` methods
    - Use `ai:summary:{content_hash}` and `ai:classify:{content_hash}` key namespaces
    - Store JSON-serialized results with configurable TTL (default 24h)
    - Handle Redis unavailability gracefully — log warning and return None
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x]* 5.2 Write property test for Redis key namespace invariant (Property 19)
    - **Property 19: Redis key namespace invariant**
    - Generate random content hashes and verify summary keys start with `ai:summary:` and classification keys start with `ai:classify:`
    - **Validates: Requirements 10.5**

- [x] 6. Implement summarizer cache (`services/cache/summarizer_cache.py`)
  - [x] 6.1 Create `SummarizerCache` class with two-level LRU + Redis
    - Implement `_content_hash` (SHA-256 of truncated text), `get` (check LRU first, then Redis), `put` (store in both LRU and Redis)
    - LRU uses `OrderedDict` with configurable `max_lru_size` (default 1000)
    - Include `from_cache` metadata flag on cache hits
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x]* 6.2 Write property test for LRU cache eviction invariant (Property 5)
    - **Property 5: LRU cache eviction invariant**
    - Generate random put/get sequences with small `max_size` and verify cache size never exceeds `max_lru_size` and LRU entry is evicted
    - **Validates: Requirements 2.3**
  - [x]* 6.3 Write property test for two-level cache round-trip (Property 4)
    - **Property 4: Two-level cache round-trip**
    - Generate article content, store summary, retrieve again and verify identical result with `from_cache=True` without Ollama invocation
    - **Validates: Requirements 2.2, 2.5, 10.3**

- [x] 7. Enhance summarizer with batch processing (`services/summarizer.py`)
  - [x] 7.1 Add `generate_summary_batch()` function
    - Group articles into batches of configurable size (default 5)
    - Send each batch in a single Ollama inference call
    - Fall back to individual processing on batch failure
    - Apply extractive fallback per article on unparseable output
    - Output structure: `title_ai` (≤12 Vietnamese words), exactly 3 `summary_bullets`, 1 `reason`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 7.2 Enhance `generate_summary()` with cache integration
    - Accept optional `SummarizerCache` parameter
    - Check cache before calling Ollama, store result after generation
    - Add `from_cache` metadata flag to returned dict
    - _Requirements: 2.1, 2.2, 2.5_
  - [x]* 7.3 Write property test for summarizer output structure (Property 1)
    - **Property 1: Summarizer output structure invariant**
    - Generate random texts ≥100 chars, mock Ollama, verify output always has `title_ai` ≤12 words, exactly 3 `summary_bullets`, and 1 `reason`
    - **Validates: Requirements 1.4**
  - [x]* 7.4 Write property test for batch grouping correctness (Property 2)
    - **Property 2: Batch grouping correctness**
    - Generate random list lengths N and batch sizes B, verify `ceil(N/B)` batches with no duplicates or omissions
    - **Validates: Requirements 1.1**
  - [x]* 7.5 Write property test for batch failure isolation (Property 3)
    - **Property 3: Batch failure isolation**
    - Mock one article producing unparseable output, verify other articles get valid summaries and the failed one gets extractive fallback
    - **Validates: Requirements 1.3**

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Enhance classifier with hybrid zero-shot mode (`services/classifier.py`)
  - [x] 9.1 Implement `HybridClassifier` class
    - Preserve existing keyword matching logic in `_keyword_scores()`
    - Add `_zero_shot_scores()` using `joeddav/xlm-roberta-large-xnli` with Vietnamese-compatible candidate labels mapped to the six topics
    - Implement `_combine_scores()` with configurable weights (default 0.4 keyword + 0.6 zero-shot)
    - Invoke zero-shot only when keyword hits ≤ configurable threshold (default 2)
    - Cache zero-shot model in memory after first load
    - Fall back to keyword-only if zero-shot model fails to load or inference fails
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x]* 9.2 Write property test for hybrid classifier threshold dispatch (Property 6)
    - **Property 6: Hybrid classifier threshold dispatch**
    - Generate article texts, verify zero-shot is invoked only when keyword hits ≤ threshold
    - **Validates: Requirements 4.2**
  - [x]* 9.3 Write property test for score combination formula (Property 7)
    - **Property 7: Score combination formula**
    - Generate random keyword and zero-shot score dicts over six topics, verify combined score = 0.4×keyword + 0.6×zero-shot and highest combined score wins
    - **Validates: Requirements 4.4**

- [x] 10. Implement FAISS index for deduplication (`services/dedup/faiss_index.py`)
  - [x] 10.1 Create `FAISSIndex` class
    - Initialize `faiss.IndexFlatIP` with dimension 384
    - Implement `add()`, `search()` (top-k, default k=10), `rebuild()` (remove expired entries outside time window), and `size` property
    - Maintain `_id_map` and `_timestamps` for article tracking and expiry
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  - [x] 10.2 Integrate FAISS into `services/dedup/core.py`
    - Replace brute-force cosine similarity loop with FAISS `search()` for Layer 3
    - Fall back to brute-force scan when FAISS index is empty or unavailable
    - Add new non-duplicate embeddings to FAISS index after storage
    - _Requirements: 5.2, 5.3, 5.5_
  - [x]* 10.3 Write property test for FAISS search equivalence (Property 8)
    - **Property 8: FAISS search equivalence to brute-force**
    - Generate random normalized 384-dim vectors, verify FAISS top-k results match brute-force cosine similarity within floating-point tolerance
    - **Validates: Requirements 5.2**
  - [x]* 10.4 Write property test for FAISS inner product = cosine similarity (Property 9)
    - **Property 9: FAISS inner product equals cosine similarity on normalized vectors**
    - Generate random L2-normalized vector pairs, verify FAISS IP score equals `numpy.dot(a, b)` within ±1e-6
    - **Validates: Requirements 5.6**
  - [x]* 10.5 Write property test for FAISS rebuild expiry (Property 10)
    - **Property 10: FAISS rebuild removes expired entries**
    - Generate entries with mixed timestamps, rebuild with 48h window, verify only non-expired entries remain
    - **Validates: Requirements 5.1, 5.4**

- [x] 11. Add batch embedding support (`services/dedup/embedding.py`)
  - [x] 11.1 Add `encode_texts_batch()` function
    - Accept list of texts, truncate each to 4000 chars, call `model.encode()` once for the entire batch
    - Return list of 384-dim L2-normalized vectors identical to individual `encode_text()` results
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x]* 11.2 Write property test for batch embedding equivalence (Property 11)
    - **Property 11: Batch embedding equivalence**
    - Generate random text lists, verify `encode_texts_batch(texts)` returns same-length list of 384-dim, L2-normalized vectors identical to individual `encode_text()` calls
    - **Validates: Requirements 6.1, 6.3**

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement model warm-up and enhanced health endpoint (`api.py`)
  - [x] 13.1 Enhance FastAPI lifespan with model warm-up
    - Pre-load sentence-transformer model during startup (force `_get_model()` call)
    - Verify Ollama connectivity with a test prompt
    - Log errors and fall back to lazy loading if sentence-transformer fails
    - Log warning and set summarizer to fallback-only mode if Ollama is unreachable
    - Store `model_status` dict in `app.state`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 13.2 Enhance `/health` endpoint with model readiness
    - Return `HealthResponse` with `status` ("ok" or "degraded"), `models` dict (sentence_transformer, ollama status), `cache` info (LRU size, Redis connectivity), and `faiss_index_size`
    - _Requirements: 3.5_

- [x] 14. Wire concurrent pipeline (`pipeline.py`)
  - [x] 14.1 Refactor `run_ingestion_pipeline()` for concurrency
    - Replace sequential `for` loop with `asyncio.gather` + `asyncio.Semaphore` (configurable concurrency limit, default 5)
    - Maintain per-source rate limit delay between HTTP requests using `asyncio.Lock` + `asyncio.sleep`
    - Extract `_process_single_article()` function handling: URL hash check → clean → quality score → cache check → summarize → classify → dedup → store
    - Integrate `ContentQualityScorer` — skip AI summarization for articles with score < threshold, mark as "failed"
    - Integrate `SummarizerCache` — check cache before Ollama, store after generation
    - Integrate `RedisAICache` — cache classification results
    - Integrate `FAISSIndex` — use for Layer 3 dedup, add new embeddings after storage
    - Use batch embedding where multiple articles are processed concurrently
    - Log errors per article and continue processing remaining articles
    - Return same stats format: `{"new": int, "duplicate": int, "failed": int}` where `new + duplicate + failed == N`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 9.3, 2.1, 10.1, 10.2, 5.2_
  - [x]* 14.2 Write property test for pipeline statistics invariant (Property 14)
    - **Property 14: Pipeline statistics invariant**
    - Generate random article outcomes (new/duplicate/failed), verify `new + duplicate + failed == N` and each count ≥ 0
    - **Validates: Requirements 7.4**
  - [x]* 14.3 Write property test for pipeline concurrency limit (Property 12)
    - **Property 12: Pipeline concurrency limit**
    - Generate sets of N articles with concurrency limit C, verify at no point more than C articles process simultaneously
    - **Validates: Requirements 7.1**
  - [x]* 14.4 Write property test for pipeline failure isolation (Property 13)
    - **Property 13: Pipeline failure isolation**
    - Generate article sets where a subset fails, verify all non-failing articles are processed to completion
    - **Validates: Requirements 7.3**

- [x] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (19 properties total)
- Unit tests validate specific examples and edge cases
- The implementation language is Python 3.12, matching the existing codebase
- All new modules follow the existing project structure under `trendbriefai-engine/services/`

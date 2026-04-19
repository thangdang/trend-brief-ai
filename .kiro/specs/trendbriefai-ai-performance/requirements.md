# Requirements Document

## Introduction

This specification defines performance improvements for the TrendBrief AI Engine (`trendbriefai-engine`), a Python/FastAPI service that crawls Vietnamese news, summarizes articles via Ollama (LLaMA 3/Mistral), classifies topics using keyword matching, and deduplicates content using a 3-layer approach (URL hash → title similarity → embedding cosine). The current pipeline processes articles sequentially with a 1.5-second delay, uses lazy model loading, has no AI response caching, and relies solely on keyword-based classification. This feature improves summarization speed, classification accuracy, deduplication throughput, pipeline concurrency, caching, and content quality — all using free Python AI tools.

## Glossary

- **AI_Engine**: The `trendbriefai-engine` Python/FastAPI service responsible for crawling, cleaning, summarizing, classifying, deduplicating, and storing articles
- **Summarizer**: The module (`services/summarizer.py`) that generates AI titles, 3-bullet summaries, and reason sentences using Ollama with extractive fallback
- **Classifier**: The module (`services/classifier.py`) that assigns one of six topics (ai, finance, lifestyle, drama, career, insight) to articles using keyword matching
- **Dedup_Engine**: The deduplication subsystem (`services/dedup/`) that detects duplicate articles using URL hash, title similarity (SequenceMatcher ≥ 0.8), and embedding cosine similarity (≥ 0.8)
- **Embedding_Service**: The module (`services/dedup/embedding.py`) that generates 384-dimensional normalized vectors using the all-MiniLM-L6-v2 sentence-transformer model
- **Pipeline**: The ingestion pipeline (`pipeline.py`) that orchestrates crawl → clean → summarize → classify → dedup → store for each article sequentially
- **FAISS_Index**: A Facebook AI Similarity Search index used for efficient approximate nearest-neighbor vector search
- **Zero_Shot_Classifier**: A HuggingFace transformer model (e.g., `joeddav/xlm-roberta-large-xnli`) that classifies text into arbitrary categories without task-specific training
- **LRU_Cache**: A Least Recently Used in-memory cache that evicts the oldest entries when capacity is reached
- **Batch_Processing**: The technique of grouping multiple items together for a single model inference call instead of processing one at a time
- **Content_Quality_Scorer**: A module that evaluates article text quality based on length, structure, language coherence, and spam indicators
- **Warm_Up**: The process of pre-loading ML models into memory at application startup rather than on first request

## Requirements

### Requirement 1: Summarization Batch Processing

**User Story:** As a system operator, I want the Summarizer to process multiple articles in a single Ollama call batch, so that inference overhead is reduced and throughput increases.

#### Acceptance Criteria

1. WHEN multiple articles are queued for summarization, THE Summarizer SHALL group them into batches of a configurable size (default 5) and send each batch in a single Ollama inference call
2. WHEN a batch inference call fails, THE Summarizer SHALL fall back to processing each article in the failed batch individually
3. WHEN an individual article in a batch produces unparseable output, THE Summarizer SHALL apply extractive fallback for that article without affecting other articles in the batch
4. THE Summarizer SHALL produce output identical in structure to the current format: title_ai (≤12 Vietnamese words), exactly 3 summary_bullets, and 1 reason string

### Requirement 2: Summarization Response Caching

**User Story:** As a system operator, I want AI summarization results to be cached, so that re-processing the same article content does not require redundant Ollama inference.

#### Acceptance Criteria

1. WHEN the Summarizer generates a summary for article content, THE AI_Engine SHALL store the result in an LRU_Cache keyed by a hash of the truncated input text
2. WHEN the Summarizer receives content whose hash matches an existing cache entry, THE AI_Engine SHALL return the cached result without calling Ollama
3. THE LRU_Cache SHALL hold a configurable maximum number of entries (default 1000) and evict the least recently used entry when full
4. WHERE Redis integration is enabled, THE AI_Engine SHALL store summarization results in Redis with a configurable TTL (default 24 hours) as a second-level cache behind the in-memory LRU_Cache
5. WHEN a cached summary is returned, THE AI_Engine SHALL include a metadata flag indicating the result was served from cache

### Requirement 3: Model Warm-Up at Startup

**User Story:** As a system operator, I want ML models to be pre-loaded at application startup, so that the first request does not incur cold-start latency.

#### Acceptance Criteria

1. WHEN the AI_Engine starts, THE AI_Engine SHALL pre-load the sentence-transformer model (all-MiniLM-L6-v2) into memory during the FastAPI lifespan startup phase
2. WHEN the AI_Engine starts, THE AI_Engine SHALL verify Ollama connectivity and optionally warm the summarizer model by sending a short test prompt
3. IF the sentence-transformer model fails to load at startup, THEN THE AI_Engine SHALL log an error and continue startup with lazy loading as fallback
4. IF Ollama is unreachable at startup, THEN THE AI_Engine SHALL log a warning and mark the summarizer as fallback-only mode until Ollama becomes available
5. THE AI_Engine SHALL expose model readiness status via the `/health` endpoint, reporting which models are loaded and operational

### Requirement 4: Zero-Shot Classification

**User Story:** As a system operator, I want the Classifier to use a zero-shot HuggingFace model alongside keyword matching, so that articles with ambiguous or missing keywords are classified more accurately.

#### Acceptance Criteria

1. THE Classifier SHALL support a hybrid classification mode that combines keyword matching scores with zero-shot classification confidence scores
2. WHEN keyword matching produces a score below a configurable confidence threshold (default: total keyword hits ≤ 2), THE Classifier SHALL invoke the Zero_Shot_Classifier to obtain topic probabilities for the six topics (ai, finance, lifestyle, drama, career, insight)
3. WHEN the Zero_Shot_Classifier is invoked, THE Classifier SHALL use Vietnamese-compatible candidate labels mapped to the six topics
4. THE Classifier SHALL combine keyword scores and zero-shot probabilities using a configurable weight ratio (default: 0.4 keyword + 0.6 zero-shot) when both are available
5. IF the Zero_Shot_Classifier model fails to load or inference fails, THEN THE Classifier SHALL fall back to keyword-only classification
6. WHEN the Zero_Shot_Classifier is first loaded, THE Classifier SHALL cache the model in memory for subsequent classification calls

### Requirement 5: FAISS Vector Search for Deduplication

**User Story:** As a system operator, I want the Dedup_Engine to use FAISS for nearest-neighbor embedding search, so that cosine similarity checks scale efficiently as the article count grows.

#### Acceptance Criteria

1. THE Dedup_Engine SHALL maintain a FAISS_Index of article embeddings for the deduplication time window (default 48 hours)
2. WHEN a new article embedding is computed, THE Dedup_Engine SHALL query the FAISS_Index for the top-k nearest neighbors (default k=10) instead of iterating over all candidates
3. WHEN a new non-duplicate article is stored, THE Dedup_Engine SHALL add its embedding to the FAISS_Index
4. THE Dedup_Engine SHALL rebuild the FAISS_Index periodically (default every 6 hours) to remove expired articles outside the time window
5. IF the FAISS_Index is unavailable or empty, THEN THE Dedup_Engine SHALL fall back to the current brute-force cosine similarity scan
6. THE Dedup_Engine SHALL use a FAISS IndexFlatIP (inner product on normalized vectors) to maintain compatibility with the existing cosine similarity threshold of 0.8

### Requirement 6: Batch Embedding Generation

**User Story:** As a system operator, I want the Embedding_Service to encode multiple texts in a single batch call, so that GPU/CPU utilization is maximized and per-article embedding latency is reduced.

#### Acceptance Criteria

1. THE Embedding_Service SHALL provide a batch encoding function that accepts a list of texts and returns a list of 384-dimensional normalized embedding vectors
2. WHEN the Pipeline processes multiple articles concurrently, THE Embedding_Service SHALL batch their texts into a single `model.encode()` call
3. THE Embedding_Service SHALL produce embedding vectors identical in dimension (384) and normalization to the current single-text `encode_text()` function
4. WHEN a batch contains texts exceeding the model's maximum token length, THE Embedding_Service SHALL truncate each text to 4000 characters before encoding

### Requirement 7: Concurrent Pipeline Processing

**User Story:** As a system operator, I want the Pipeline to process multiple articles concurrently, so that total ingestion time for a source is reduced.

#### Acceptance Criteria

1. THE Pipeline SHALL process articles from a single source concurrently using asyncio, with a configurable concurrency limit (default 5 concurrent articles)
2. WHILE processing articles concurrently, THE Pipeline SHALL maintain a per-source rate limit delay (configurable, default 1.5 seconds) between HTTP requests to external news sites to avoid IP blocking
3. WHEN an individual article fails during concurrent processing, THE Pipeline SHALL log the error and continue processing remaining articles without affecting the batch
4. THE Pipeline SHALL aggregate and return the same statistics format as the current implementation: `{"new": int, "duplicate": int, "failed": int}`
5. WHILE processing articles concurrently, THE Pipeline SHALL use an asyncio semaphore to limit the number of simultaneous external HTTP requests

### Requirement 8: Vietnamese Text Processing Improvement

**User Story:** As a system operator, I want the text cleaning pipeline to handle Vietnamese-specific text patterns, so that content quality for Vietnamese articles is improved.

#### Acceptance Criteria

1. THE AI_Engine SHALL normalize all Vietnamese text to Unicode NFC form before any processing step (summarization, classification, deduplication)
2. THE AI_Engine SHALL strip common Vietnamese web artifacts including "Đọc thêm:", "Xem thêm:", "Tin liên quan:", advertisement markers, and social sharing text fragments
3. WHEN cleaning article text, THE AI_Engine SHALL preserve Vietnamese diacritical marks and tone marks throughout the cleaning pipeline
4. THE AI_Engine SHALL detect and remove repeated paragraphs and boilerplate text commonly found in Vietnamese news articles (e.g., source attribution blocks, copyright notices)

### Requirement 9: Content Quality Scoring

**User Story:** As a system operator, I want each article to receive a quality score, so that low-quality or spam content can be filtered before AI processing.

#### Acceptance Criteria

1. THE Content_Quality_Scorer SHALL compute a quality score between 0.0 and 1.0 for each cleaned article text
2. THE Content_Quality_Scorer SHALL evaluate at least the following signals: text length adequacy, paragraph structure, ratio of Vietnamese characters to total characters, and presence of spam indicators (excessive URLs, repeated phrases, all-caps blocks)
3. WHEN an article's quality score falls below a configurable threshold (default 0.3), THE Pipeline SHALL skip AI summarization and mark the article with processing_status "failed"
4. THE Content_Quality_Scorer SHALL log the quality score and contributing signal values for each evaluated article
5. THE Content_Quality_Scorer SHALL execute in under 50 milliseconds per article to avoid becoming a pipeline bottleneck

### Requirement 10: Redis Integration for AI Results

**User Story:** As a system operator, I want AI processing results (summaries, classifications, embeddings) to be cached in Redis, so that results persist across service restarts and can be shared between instances.

#### Acceptance Criteria

1. WHEN the AI_Engine produces a summary for an article, THE AI_Engine SHALL store the summary result in Redis with a key derived from the content hash and a configurable TTL (default 24 hours)
2. WHEN the AI_Engine classifies an article topic, THE AI_Engine SHALL store the classification result in Redis with a key derived from the content hash and a configurable TTL (default 24 hours)
3. WHEN the AI_Engine processes an article that has existing results in Redis, THE AI_Engine SHALL return the cached results without re-running AI inference
4. IF Redis is unavailable, THEN THE AI_Engine SHALL proceed with normal AI processing and log a warning about cache unavailability
5. THE AI_Engine SHALL use a consistent key namespace prefix (e.g., `ai:summary:`, `ai:classify:`) to organize cached AI results in Redis

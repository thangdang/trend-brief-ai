"""Core deduplication logic — three-layer check."""

from datetime import datetime, timedelta

from services.dedup.embedding import encode_text
from services.dedup.similarity import cosine_similarity, title_similarity
from services.dedup.utils import url_hash


async def deduplicate_article(
    db,
    url: str,
    title: str,
    content: str,
    window_hours: int = 48,
    title_threshold: float = 0.8,
    embed_threshold: float = 0.8,
    max_candidates: int = 200,
) -> dict:
    """
    Three-layer deduplication:
      Layer 1: URL hash exact match (O(1))
      Layer 2: Title similarity via SequenceMatcher (O(n))
      Layer 3: Embedding cosine similarity (O(n))

    Returns: { is_duplicate: bool, cluster_id: ObjectId, embedding: list[float] }
    """
    articles_col = db["articles"]
    clusters_col = db["clusters"]

    # --- Layer 1: URL hash exact match ---
    hash_val = url_hash(url)
    existing = await articles_col.find_one({"url_hash": hash_val})
    if existing is not None:
        return {
            "is_duplicate": True,
            "cluster_id": existing.get("cluster_id"),
            "embedding": existing.get("embedding"),
        }

    # Compute embedding once (384-dim, normalized)
    text_for_embedding = (title + "\n" + content)[:4000]
    embedding = encode_text(text_for_embedding)

    # --- Fetch recent candidates within time window ---
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    cursor = (
        articles_col.find({"created_at": {"$gte": cutoff}})
        .sort("created_at", -1)
        .limit(max_candidates)
    )
    candidates = await cursor.to_list(length=max_candidates)

    best_match = None
    best_score = 0.0

    for candidate in candidates:
        # --- Layer 2: Title similarity (fast string comparison) ---
        candidate_title = candidate.get("title_original", "")
        t_sim = title_similarity(title, candidate_title)
        if t_sim >= title_threshold:
            return {
                "is_duplicate": True,
                "cluster_id": candidate.get("cluster_id"),
                "embedding": embedding,
            }

        # --- Layer 3: Embedding cosine similarity ---
        candidate_embedding = candidate.get("embedding")
        if candidate_embedding is not None:
            score = cosine_similarity(embedding, candidate_embedding)
            if score > best_score:
                best_score = score
                best_match = candidate

    # Check best embedding match against threshold
    if best_match is not None and best_score >= embed_threshold:
        return {
            "is_duplicate": True,
            "cluster_id": best_match.get("cluster_id"),
            "embedding": embedding,
        }

    # --- Not duplicate — create new cluster ---
    cluster_doc = {
        "centroid_embedding": embedding,
        "representative_article_id": None,
        "article_count": 1,
        "created_at": datetime.utcnow(),
    }
    result = await clusters_col.insert_one(cluster_doc)

    return {
        "is_duplicate": False,
        "cluster_id": result.inserted_id,
        "embedding": embedding,
    }

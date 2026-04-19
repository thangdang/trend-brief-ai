# dedup package — three-layer article deduplication

from services.dedup.core import deduplicate_article
from services.dedup.embedding import encode_text, encode_texts_batch
from services.dedup.similarity import cosine_similarity, title_similarity
from services.dedup.utils import url_hash

__all__ = [
    "deduplicate_article",
    "encode_text",
    "encode_texts_batch",
    "cosine_similarity",
    "title_similarity",
    "url_hash",
]

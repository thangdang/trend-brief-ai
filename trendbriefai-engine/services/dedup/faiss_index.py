"""FAISS IndexFlatIP wrapper for dedup embedding search.

Uses inner product on L2-normalized vectors (equivalent to cosine similarity)
for exact nearest-neighbor search.
"""

import logging
from datetime import datetime, timedelta

import faiss
import numpy as np

logger = logging.getLogger(__name__)


class FAISSIndex:
    """FAISS IndexFlatIP wrapper for dedup embedding search."""

    def __init__(self, dimension: int = 384):
        self._dimension = dimension
        self._index: faiss.IndexFlatIP = faiss.IndexFlatIP(dimension)
        self._id_map: list[str] = []
        self._timestamps: list[datetime] = []

    def add(self, article_id: str, embedding: list[float], timestamp: datetime | None = None) -> None:
        """Add an embedding to the index."""
        vec = np.asarray([embedding], dtype=np.float32)
        self._index.add(vec)
        self._id_map.append(article_id)
        self._timestamps.append(timestamp or datetime.utcnow())

    def search(self, query_embedding: list[float], k: int = 10) -> list[tuple[str, float]]:
        """Search for top-k nearest neighbors by inner product.

        Returns list of (article_id, score) tuples sorted by descending score.
        """
        if self._index.ntotal == 0:
            return []

        actual_k = min(k, self._index.ntotal)
        query = np.asarray([query_embedding], dtype=np.float32)
        scores, indices = self._index.search(query, actual_k)

        results: list[tuple[str, float]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self._id_map):
                results.append((self._id_map[idx], float(score)))

        return results

    def rebuild(self, window_hours: int = 48) -> int:
        """Remove expired entries outside time window. Returns removed count."""
        cutoff = datetime.utcnow() - timedelta(hours=window_hours)

        keep_indices: list[int] = []
        for i, ts in enumerate(self._timestamps):
            if ts >= cutoff:
                keep_indices.append(i)

        removed = len(self._id_map) - len(keep_indices)

        if removed == 0:
            return 0

        # Rebuild index with only non-expired entries
        new_index = faiss.IndexFlatIP(self._dimension)
        new_id_map: list[str] = []
        new_timestamps: list[datetime] = []

        if keep_indices:
            vectors = np.zeros((len(keep_indices), self._dimension), dtype=np.float32)
            for new_i, old_i in enumerate(keep_indices):
                vec = self._index.reconstruct(old_i)
                vectors[new_i] = vec
                new_id_map.append(self._id_map[old_i])
                new_timestamps.append(self._timestamps[old_i])
            new_index.add(vectors)

        self._index = new_index
        self._id_map = new_id_map
        self._timestamps = new_timestamps

        logger.info("FAISS rebuild: removed %d expired entries, %d remaining", removed, self.size)
        return removed

    @property
    def size(self) -> int:
        """Number of vectors in the index."""
        return self._index.ntotal

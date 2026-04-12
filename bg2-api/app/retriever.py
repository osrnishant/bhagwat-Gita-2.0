from __future__ import annotations

from qdrant_client import QdrantClient
from .config import QDRANT_URL, QDRANT_API_KEY, QDRANT_PATH, COLLECTION_NAME, RETRIEVAL_THRESHOLD

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        if QDRANT_URL:
            # Qdrant Cloud — used in production (Railway)
            _client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        else:
            # Local file — used in development
            _client = QdrantClient(path=QDRANT_PATH)
    return _client


def get_vector_count() -> int:
    info = get_client().get_collection(COLLECTION_NAME)
    return info.points_count


def search(query_vector: list[float], top_k: int) -> tuple[list[dict], list[float]]:
    """
    Returns (verses, scores). Verses are full metadata dicts.
    If all scores < RETRIEVAL_THRESHOLD, still returns results but
    caller can check scores[0] to decide whether to add a disclaimer.
    """
    results = get_client().search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=top_k,
        with_payload=True,
    )
    verses = [hit.payload for hit in results]
    scores = [hit.score for hit in results]
    return verses, scores

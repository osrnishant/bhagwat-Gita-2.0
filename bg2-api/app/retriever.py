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
    return info.points_count or 0


def search(
    query_vector: list[float], top_k: int
) -> tuple[list[dict], list[float], bool]:
    """
    Returns (verses, scores, low_confidence).

    Passes score_threshold to Qdrant so results below RETRIEVAL_THRESHOLD
    are filtered server-side — avoids transferring irrelevant payloads.
    If nothing clears the threshold (low_confidence=True), falls back to
    a threshold-free search returning top-2 so the caller can add a disclaimer
    rather than returning an empty response.
    """
    results = get_client().search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=top_k,
        with_payload=True,
        score_threshold=RETRIEVAL_THRESHOLD,
    )

    if results:
        return [r.payload for r in results], [r.score for r in results], False

    # All scores below threshold — fall back to top-2 without filter
    fallback = get_client().search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=2,
        with_payload=True,
    )
    return [r.payload for r in fallback], [r.score for r in fallback], True

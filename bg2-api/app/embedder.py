from __future__ import annotations

from sentence_transformers import SentenceTransformer
from .config import EMBEDDING_MODEL

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def embed_query(text: str) -> list[float]:
    """Embed a user query. e5 models require 'query: ' prefix at query time."""
    model = get_model()
    vector = model.encode(f"query: {text}", normalize_embeddings=True)
    return vector.tolist()

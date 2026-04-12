from __future__ import annotations

from sentence_transformers import SentenceTransformer

from .config import EMBEDDING_MODEL

# Loaded once at import time — never reloaded.
# main.py imports this module at startup so the model is warm before the first request.
print(f"[embedding] Loading {EMBEDDING_MODEL} …", flush=True)
_model = SentenceTransformer(EMBEDDING_MODEL)
print(f"[embedding] Model ready.", flush=True)


def encode(text: str) -> list[float]:
    """
    Embed text and return a normalized 768-dim vector.
    Applies the 'query: ' prefix required by multilingual-e5-base at query time.
    """
    return _model.encode(f"query: {text}", normalize_embeddings=True).tolist()

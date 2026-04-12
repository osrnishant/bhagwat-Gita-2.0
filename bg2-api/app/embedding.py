from __future__ import annotations

import voyageai

from .config import VOYAGE_API_KEY

# Voyage AI remote embeddings — no local model download.
# voyage-multilingual-2 supports Hindi, Sanskrit, and English.
# Vectors are 1024-dim, normalized by default.
MODEL_NAME = "voyage-multilingual-2"

_client = voyageai.Client(api_key=VOYAGE_API_KEY)
print(f"[embedding] Voyage AI client ready ({MODEL_NAME}).", flush=True)


def encode(text: str) -> list[float]:
    """
    Embed a query string and return a normalized 1024-dim vector.
    input_type='query' applies Voyage's query-side instruction internally.
    """
    result = _client.embed([text], model=MODEL_NAME, input_type="query")
    return result.embeddings[0]

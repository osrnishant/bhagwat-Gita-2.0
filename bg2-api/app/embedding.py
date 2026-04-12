from __future__ import annotations

import anthropic

from .config import ANTHROPIC_API_KEY

# Anthropic resells Voyage AI embeddings — no separate key needed.
# voyage-multilingual-2 supports Hindi, Sanskrit, and English (1024-dim).
MODEL_NAME = "voyage-multilingual-2"

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
print(f"[embedding] Anthropic embeddings client ready ({MODEL_NAME}).", flush=True)


def encode(text: str) -> list[float]:
    """
    Embed a query string via Anthropic's Voyage embedding endpoint.
    Returns a normalized 1024-dim vector.
    """
    response = _client.embeddings.create(
        model=MODEL_NAME,
        input=[text],
    )
    return response.embeddings[0].embedding

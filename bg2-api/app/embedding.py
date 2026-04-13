from __future__ import annotations

import httpx

from .config import VOYAGE_API_KEY

MODEL_NAME = "voyage-multilingual-2"
_VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"


def encode(text: str) -> list[float]:
    """Embed a query string via the VoyageAI REST API (1024-dim)."""
    resp = httpx.post(
        _VOYAGE_URL,
        headers={
            "Authorization": f"Bearer {VOYAGE_API_KEY}",
            "Content-Type": "application/json",
        },
        json={"model": MODEL_NAME, "input": [text], "input_type": "query"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["data"][0]["embedding"]

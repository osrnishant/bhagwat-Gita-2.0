"""
Re-index all 701 Gita verses into Qdrant Cloud using Anthropic's
Voyage embedding API (voyage-multilingual-2, 1024-dim).

Requires in .env (or environment):
    ANTHROPIC_API_KEY
    QDRANT_URL        e.g. https://xyz.qdrant.tech
    QDRANT_API_KEY

Run from bg2-api/:
    python scripts/reindex_to_cloud.py
"""

import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import os

VOYAGE_API_KEY = os.getenv("VOYAGE_API_KEY", "") or os.getenv("ANTHROPIC_API_KEY", "")
QDRANT_URL     = os.getenv("QDRANT_URL", "")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

if not VOYAGE_API_KEY:
    sys.exit("Missing VOYAGE_API_KEY in .env — get a free key at voyageai.com")
if not QDRANT_URL:
    sys.exit("Missing QDRANT_URL in .env — set this to your Qdrant Cloud cluster URL")
if not QDRANT_API_KEY:
    sys.exit("Missing QDRANT_API_KEY in .env")

import socket
import urllib.parse

import httpx

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
except ImportError:
    sys.exit("Missing dependency: pip install qdrant-client")

# --------------------------------------------------------------------------
# DNS cache: resolve the Qdrant host once at startup, then pin the result
# so flaky home-router DNS can't break connections mid-run.
# --------------------------------------------------------------------------
_qdrant_host = urllib.parse.urlparse(QDRANT_URL).hostname or ""
_dns_cache: dict[str, list] = {}

_orig_getaddrinfo = socket.getaddrinfo

def _cached_getaddrinfo(host, port, *args, **kwargs):
    if host == _qdrant_host:
        if host not in _dns_cache:
            _dns_cache[host] = _orig_getaddrinfo(host, port, *args, **kwargs)
        return _dns_cache[host]
    return _orig_getaddrinfo(host, port, *args, **kwargs)

socket.getaddrinfo = _cached_getaddrinfo

SCRIPTS_DIR  = Path(__file__).resolve().parent
API_DIR      = SCRIPTS_DIR.parent
VERSES_PATH  = API_DIR / "data" / "verses.json"

COLLECTION   = "gita_verses"
MODEL_NAME   = "voyage-multilingual-2"
EMBED_DIM    = 1024
BATCH_SIZE   = 8   # conservative to stay within Voyage rate limits

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"


def embed_batch(api_key: str, texts: list[str]) -> list[list[float]]:
    """Call Voyage AI REST API with exponential backoff on 429."""
    for attempt in range(6):
        resp = httpx.post(
            VOYAGE_API_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": MODEL_NAME, "input": texts, "input_type": "document"},
            timeout=60,
        )
        if resp.status_code == 429:
            wait = 2 ** attempt
            print(f"  Rate limited — waiting {wait}s …", flush=True)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        data = resp.json()
        return [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]
    raise RuntimeError("Exceeded retries on Voyage rate limit")


def make_qdrant() -> "QdrantClient":
    return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=30)


def upsert_with_retry(points: list, collection: str) -> None:
    """Upsert with a fresh client and exponential backoff on connection errors."""
    for attempt in range(5):
        try:
            make_qdrant().upsert(collection_name=collection, points=points)
            return
        except Exception as e:
            wait = 2 ** attempt
            print(f"  Upsert error ({e.__class__.__name__}) — retrying in {wait}s …", flush=True)
            time.sleep(wait)
    raise RuntimeError("Exceeded retries on Qdrant upsert")


def main() -> None:
    print(f"Model:      {MODEL_NAME} ({EMBED_DIM}-dim)")
    print(f"Qdrant URL: {QDRANT_URL}")
    print()

    with open(VERSES_PATH, encoding="utf-8") as f:
        verses = json.load(f)
    print(f"Loaded {len(verses)} verses from {VERSES_PATH}\n")

    qdrant = make_qdrant()

    # Drop and recreate collection
    existing = {c.name for c in qdrant.get_collections().collections}
    if COLLECTION in existing:
        qdrant.delete_collection(COLLECTION)
        print(f"Dropped existing '{COLLECTION}' collection")
    qdrant.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
    )
    print(f"Created '{COLLECTION}' collection (dim={EMBED_DIM}, cosine)\n")

    total   = len(verses)
    upserted = 0

    for i in range(0, total, BATCH_SIZE):
        batch   = verses[i : i + BATCH_SIZE]
        texts   = [v["embedding_text"] for v in batch]
        vectors = embed_batch(VOYAGE_API_KEY, texts)

        points = [
            PointStruct(
                id=verse["chapter"] * 1000 + verse["verse"],
                vector=vector,
                payload={
                    "id":      verse["id"],
                    "chapter": verse["chapter"],
                    "verse":   verse["verse"],
                    "sanskrit": verse["sanskrit"],
                    "hindi":   verse["hindi"],
                    "english": verse["english"],
                    "themes":  verse["themes"],
                },
            )
            for verse, vector in zip(batch, vectors)
        ]

        upsert_with_retry(points, COLLECTION)
        upserted += len(points)

        done = min(i + BATCH_SIZE, total)
        print(f"Embedded {done}/{total}", flush=True)

        # Voyage free tier = 3 RPM → 21s between batches
        if done < total:
            time.sleep(21)

    print(f"\nUpserted {upserted} points into '{COLLECTION}'")

    # Verify
    info  = qdrant.get_collection(COLLECTION)
    count = info.points_count
    if count != total:
        sys.exit(f"Verification failed: expected {total}, got {count}")
    print(f"Verified: {count} vectors in Qdrant Cloud ✓")
    print("\nDone. Deploy or restart Railway — /health should return verses_indexed: 701")


if __name__ == "__main__":
    main()

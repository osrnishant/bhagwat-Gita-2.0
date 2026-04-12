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

import httpx

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
except ImportError:
    sys.exit("Missing dependency: pip install qdrant-client")

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


def main() -> None:
    print(f"Model:      {MODEL_NAME} ({EMBED_DIM}-dim)")
    print(f"Qdrant URL: {QDRANT_URL}")
    print()

    with open(VERSES_PATH, encoding="utf-8") as f:
        verses = json.load(f)
    print(f"Loaded {len(verses)} verses from {VERSES_PATH}\n")

    qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

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
    points: list[PointStruct] = []

    for i in range(0, total, BATCH_SIZE):
        batch  = verses[i : i + BATCH_SIZE]
        texts  = [v["embedding_text"] for v in batch]
        vectors = embed_batch(VOYAGE_API_KEY, texts)

        for verse, vector in zip(batch, vectors):
            point_id = verse["chapter"] * 1000 + verse["verse"]
            points.append(PointStruct(
                id=point_id,
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
            ))

        done = min(i + BATCH_SIZE, total)
        print(f"Embedded {done}/{total}", flush=True)

        # Voyage free tier = 3 RPM → 21s between batches
        if done < total:
            time.sleep(21)

    qdrant.upsert(collection_name=COLLECTION, points=points)
    print(f"\nUpserted {len(points)} points into '{COLLECTION}'")

    # Verify
    info  = qdrant.get_collection(COLLECTION)
    count = info.points_count
    if count != total:
        sys.exit(f"Verification failed: expected {total}, got {count}")
    print(f"Verified: {count} vectors in Qdrant Cloud ✓")
    print("\nDone. Deploy or restart Railway — /health should return verses_indexed: 701")


if __name__ == "__main__":
    main()

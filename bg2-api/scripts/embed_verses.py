"""
Embed all 701 Gita verses and store in Qdrant local collection.

Run from repo root:
    python bg2-api/scripts/embed_verses.py

Uses intfloat/multilingual-e5-base (768-dim, CPU-friendly).
e5 models require a "passage: " prefix on documents at index time
and "query: " prefix on questions at query time.

Re-running is safe: the collection is dropped and recreated each time
so the index always reflects the current verses.json.
"""

import json
import sys
from pathlib import Path

# ── Paths derived from this file's location, not CWD ──────────────────────────
SCRIPTS_DIR  = Path(__file__).resolve().parent
API_DIR      = SCRIPTS_DIR.parent
VERSES_PATH  = API_DIR / "data" / "verses.json"
QDRANT_PATH  = API_DIR / "data" / "qdrant"

COLLECTION   = "gita_verses"
MODEL_NAME   = "intfloat/multilingual-e5-base"
EMBED_DIM    = 768
BATCH_SIZE   = 32
PRINT_EVERY  = 50

# ── Imports (fail fast with a clear message if deps missing) ───────────────────
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    sys.exit("Missing dependency: pip install sentence-transformers")

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct
except ImportError:
    sys.exit("Missing dependency: pip install qdrant-client")


def load_verses(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        verses = json.load(f)
    if not verses:
        sys.exit(f"verses.json is empty: {path}")
    print(f"Loaded {len(verses)} verses from {path}")
    return verses


def make_collection(client: QdrantClient) -> None:
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION in existing:
        client.delete_collection(COLLECTION)
        print(f"Dropped existing '{COLLECTION}' collection")
    client.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
    )
    print(f"Created '{COLLECTION}' collection (dim={EMBED_DIM}, cosine)")


def embed_and_index(
    verses: list[dict],
    model: SentenceTransformer,
    client: QdrantClient,
) -> None:
    total = len(verses)
    points: list[PointStruct] = []

    for i in range(0, total, BATCH_SIZE):
        batch = verses[i : i + BATCH_SIZE]

        # e5 models: prefix documents with "passage: " for correct representation
        texts = [f"passage: {v['embedding_text']}" for v in batch]
        vectors = model.encode(texts, normalize_embeddings=True).tolist()

        for j, (verse, vector) in enumerate(zip(batch, vectors)):
            # Use a stable integer ID: chapter * 1000 + verse
            point_id = verse["chapter"] * 1000 + verse["verse"]
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "id":        verse["id"],
                        "chapter":   verse["chapter"],
                        "verse":     verse["verse"],
                        "sanskrit":  verse["sanskrit"],
                        "hindi":     verse["hindi"],
                        "english":   verse["english"],
                        "themes":    verse["themes"],
                    },
                )
            )

        done = min(i + BATCH_SIZE, total)
        if done % PRINT_EVERY == 0 or done == total:
            print(f"Embedded {done}/{total}", flush=True)

    # Upsert in one shot — 701 points is trivially small for Qdrant
    client.upsert(collection_name=COLLECTION, points=points)
    print(f"Upserted {len(points)} points into '{COLLECTION}'")


def verify(client: QdrantClient, expected: int) -> None:
    info = client.get_collection(COLLECTION)
    count = info.points_count
    if count != expected:
        sys.exit(f"Verification failed: expected {expected} points, got {count}")
    print(f"Verified: {count} vectors in '{COLLECTION}' ✓")


def main() -> None:
    print(f"Model:   {MODEL_NAME}")
    print(f"Qdrant:  {QDRANT_PATH}")
    print()

    verses = load_verses(VERSES_PATH)

    print(f"Loading {MODEL_NAME} …")
    model = SentenceTransformer(MODEL_NAME)
    print("Model loaded\n")

    QDRANT_PATH.mkdir(parents=True, exist_ok=True)
    client = QdrantClient(path=str(QDRANT_PATH))

    make_collection(client)
    print()

    embed_and_index(verses, model, client)
    print()

    verify(client, len(verses))
    print("\nDone. Run the API server and query /health to confirm.")


if __name__ == "__main__":
    main()

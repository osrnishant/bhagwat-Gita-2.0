"""
Manual retrieval test — run from bg2-api/:

    python app/retrieval.py
    python app/retrieval.py "how to deal with anxiety"
    python app/retrieval.py "मैं बहुत चिंतित हूँ"
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running as a script without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.embedding import encode
from app.retriever import search, RETRIEVAL_THRESHOLD

QUERIES = [
    "how to deal with anxiety",
    "what is karma",
    "मैं बहुत चिंतित हूँ",
    "duty without attachment to results",
    "fear of death",
]


def run(query: str) -> None:
    print(f"\nQuery: {query!r}")
    print("─" * 60)

    vector = encode(query)
    verses, scores, low = search(vector, top_k=5)

    if not verses:
        print("  No results.")
        return

    if low:
        print(f"  ⚠  Top score {scores[0]:.3f} < threshold {RETRIEVAL_THRESHOLD} — low confidence\n")

    for verse, score in zip(verses, scores):
        flag = " ✓" if score >= RETRIEVAL_THRESHOLD else " ⚠"
        print(f"  [{score:.3f}]{flag}  {verse['id']:6s}  {verse['english'][:70]}...")


if __name__ == "__main__":
    queries = sys.argv[1:] if len(sys.argv) > 1 else QUERIES
    for q in queries:
        run(q)
    print()

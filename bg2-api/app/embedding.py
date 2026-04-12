from __future__ import annotations

import os

from sentence_transformers import SentenceTransformer

# Model is downloaded from HuggingFace Hub on first run and cached locally.
# On Railway/Heroku the cache lives in ~/.cache/huggingface/ inside the dyno.
# Set HF_HOME env var to override the cache location if needed.
MODEL_NAME = "intfloat/multilingual-e5-base"

print(f"[embedding] Loading {MODEL_NAME} from HuggingFace (cached after first run) …", flush=True)
_model = SentenceTransformer(MODEL_NAME, cache_folder=os.getenv("HF_HOME"))
print("[embedding] Model ready.", flush=True)


def encode(text: str) -> list[float]:
    """
    Embed text and return a normalized 768-dim vector.
    Applies the 'query: ' prefix required by multilingual-e5-base at query time.
    """
    return _model.encode(f"query: {text}", normalize_embeddings=True).tolist()

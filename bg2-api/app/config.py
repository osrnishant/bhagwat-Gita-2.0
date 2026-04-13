from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths relative to this file so they work regardless of CWD
APP_DIR   = Path(__file__).resolve().parent
API_DIR   = APP_DIR.parent

ANTHROPIC_API_KEY: str    = os.getenv("ANTHROPIC_API_KEY", "")
VOYAGE_API_KEY: str       = os.getenv("VOYAGE_API_KEY", "") or os.getenv("ANTHROPIC_API_KEY", "")
ELEVENLABS_API_KEY: str   = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID: str  = os.getenv("ELEVENLABS_VOICE_ID", "")
QDRANT_URL: str           = os.getenv("QDRANT_URL", "")          # set for Qdrant Cloud
QDRANT_API_KEY: str       = os.getenv("QDRANT_API_KEY", "")      # set for Qdrant Cloud
QDRANT_PATH: str          = os.getenv("QDRANT_PATH", str(API_DIR / "data" / "qdrant"))
CLAUDE_MODEL: str         = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
API_PORT: int             = int(os.getenv("API_PORT", "8000"))
ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
# Bearer token that the frontend must send in every /ask request.
# Leave empty to disable auth (local dev). Set in Railway + Vercel env vars.
API_KEY: str              = os.getenv("API_KEY", "")

EMBEDDING_MODEL      = "voyage-multilingual-2"
COLLECTION_NAME      = "gita_verses"
TOP_K                = 5
RETRIEVAL_THRESHOLD  = 0.35
MAX_TOKENS           = 400
TEMPERATURE          = 0.7

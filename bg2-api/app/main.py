import html
import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import ALLOWED_ORIGINS, EMBEDDING_MODEL
from .models import AskRequest, AskResponse, HealthResponse
from .retriever import get_vector_count

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Bhagavad Gita 2.0 API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def sanitize(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        vector_count=get_vector_count(),
        model=EMBEDDING_MODEL,
    )


@app.post("/ask", response_model=AskResponse)
@limiter.limit("10/minute")
async def ask(http_request: Request, request: AskRequest):
    from .pipeline import ask_krishna
    request.question = sanitize(request.question)
    return await ask_krishna(request)

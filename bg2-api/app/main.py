import hmac
import logging
import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import EMBEDDING_MODEL, API_KEY, ALLOWED_ORIGINS
from .embedding import encode as _preload_embedding  # noqa: F401 — triggers model load
from .models import AskRequest, AskResponse, HealthResponse
from .retriever import get_vector_count

logger = logging.getLogger(__name__)

if not API_KEY:
    logger.warning("API_KEY not set — /ask is unauthenticated. Set API_KEY in env vars for production.")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Arya API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def request_id_logger(request: Request, call_next):
    request_id = uuid.uuid4().hex[:8]
    request.state.request_id = request_id
    start = time.monotonic()
    response = await call_next(request)
    latency_ms = (time.monotonic() - start) * 1000
    logger.info(
        "rid=%s method=%s path=%s status=%d latency_ms=%.0f",
        request_id, request.method, request.url.path, response.status_code, latency_ms,
    )
    response.headers["X-Request-Id"] = request_id
    return response


@app.middleware("http")
async def bearer_auth(request: Request, call_next):
    if API_KEY and request.url.path in ("/ask", "/ask/stream") and request.method != "OPTIONS":
        auth = request.headers.get("Authorization", "")
        if not hmac.compare_digest(auth, f"Bearer {API_KEY}"):
            return JSONResponse(status_code=401, content={"error": "Unauthorized"})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"error": "Something went wrong"})


def sanitize(text: str) -> str:
    """Strip HTML tags then trim whitespace. Applied before Pydantic validation."""
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        vector_count=await get_vector_count(),
        model=EMBEDDING_MODEL,
    )


@app.post("/ask", response_model=AskResponse)
@limiter.limit("10/minute")
async def ask(request: Request, body: AskRequest):
    from .pipeline import ask_krishna
    body.question = sanitize(body.question)
    for turn in body.history:
        turn.content = sanitize(turn.content)
    return await ask_krishna(body)


@app.post("/ask/stream")
@limiter.limit("10/minute")
async def ask_stream(request: Request, body: AskRequest):
    """Server-Sent Events streaming endpoint.

    Sends:
      event: meta\\ndata: <json with verses + scores>\\n\\n
      data: <token>\\n\\n  (repeated)
      data: [DONE]\\n\\n

    Frontend should use EventSource or fetch with ReadableStream.
    """
    from .pipeline import stream_krishna
    body.question = sanitize(body.question)
    for turn in body.history:
        turn.content = sanitize(turn.content)
    return StreamingResponse(
        stream_krishna(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disables Nginx buffering in Railway/Render
        },
    )

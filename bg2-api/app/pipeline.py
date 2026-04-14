from __future__ import annotations

import asyncio
import logging
import re
import time
from pathlib import Path

from cachetools import TTLCache

from .embedding import encode
from .retriever import search
from .prompts import build_system_prompt
from .claude_client import generate, generate_stream
from .tts_client import synthesize
from .models import AskRequest, AskResponse, VerseResult

logger = logging.getLogger(__name__)

LOW_CONFIDENCE_NOTE = (
    "I searched carefully, but these are the closest matches I found "
    "to your question. They may not speak to it directly."
)

# Cache keyed on (question, language, top_k, voice) — TTL 30 min.
# Conversational requests (with history) bypass cache entirely since
# context makes each response unique.
_response_cache: TTLCache = TTLCache(maxsize=256, ttl=1800)

_LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "sa": "Sanskrit",
    "mixed": "Hindi-English mix",
}

_CASUAL_PROMPT: str = (
    Path(__file__).resolve().parent / "prompts" / "arya_casual.txt"
).read_text(encoding="utf-8").strip()

_NAME_RE = re.compile(r"\b(arya)\b", re.IGNORECASE)

_FRUSTRATION_RE = re.compile(
    r"(not what i (asked|meant|wanted)|you didn'?t answer|that'?s not helpful|"
    r"still (not|wrong)|missed the point|not relevant|that doesn'?t help|"
    r"you (ignored|missed)|wrong (answer|response)|"
    r"(woh|yeh) (galat|sahi nahi)|samjhe nahi|yeh nahi puchha)",
    re.IGNORECASE,
)

_CASUAL_RE = re.compile(
    r"^\s*("
    r"hi+|hello+|hey+|hiya|howdy|greetings|"
    r"how are you|how r u|how are u|how'?s it going|how'?re you|"
    r"what'?s up|wassup|sup|"
    r"good morning|good afternoon|good evening|good night|"
    r"thanks|thank you|thank u|thx|ty|"
    r"bye|goodbye|see you|see ya|cya|later|"
    r"ok|okay|cool|great|nice|got it|"
    r"who are you|what are you|introduce yourself|tell me about yourself|"
    r"are you (there|real|an ai|a bot)|you there|"
    r"namaste|namaskar|jai shri krishna|jai hind|"
    r"test|testing"
    r")[\s!?.]*$",
    re.IGNORECASE,
)


def _has_frustration_in_history(history: list[dict]) -> bool:
    """Return True if the most recent user turn in history shows correction signals."""
    for turn in reversed(history):
        if turn["role"] == "user":
            return bool(_FRUSTRATION_RE.search(turn["content"]))
    return False


def is_casual(question: str) -> bool:
    cleaned = _NAME_RE.sub("", question).strip()
    words = cleaned.split()
    if len(words) <= 2 and not any(
        w in cleaned.lower() for w in ["what", "why", "how", "when", "where", "should", "can"]
    ):
        return True
    return bool(_CASUAL_RE.match(cleaned))


def clean_for_tts(text: str) -> str:
    text = re.sub(r"\nCITED:.*$", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"\*+([^*\n]+)\*+", r"\1", text)
    text = re.sub(r"_([^_\n]+)_", r"\1", text)
    text = text.replace("—", ",").replace("–", ",")
    text = re.sub(r"^#+\s+", "", text, flags=re.MULTILINE)
    text = text.replace("`", "")
    return text.strip()


def extract_citations(text: str) -> set[str]:
    footer = re.search(r"CITED:\s*\[([^\]]*)\]", text, re.IGNORECASE)
    if footer:
        pairs = re.findall(r"(\d+):(\d+)", footer.group(1))
        return {f"{c}_{v}" for c, v in pairs}
    en = re.findall(r"Chapter\s+(\d+),\s+Verse\s+(\d+)", text, re.IGNORECASE)
    hi = re.findall(r"अध्याय\s+(\d+),\s+श्लोक\s+(\d+)", text)
    return {f"{c}_{v}" for c, v in en + hi}


def validate_citations(response_text: str, retrieved_verses: list[dict]) -> bool:
    cited = extract_citations(response_text)
    retrieved_ids = {v["id"] for v in retrieved_verses}
    return cited.issubset(retrieved_ids)


async def stream_krishna(request: AskRequest):
    """Streaming variant — yields SSE-formatted chunks, then a final [DONE] event.

    Format per chunk:  data: <token>\n\n
    Final event:       data: [DONE]\n\n

    Verses and scores are sent as a JSON metadata event before text streaming begins:
    event: meta\ndata: <json>\n\n
    """
    import json

    has_history = bool(request.history)
    claude_history = [{"role": t.role, "content": t.content} for t in request.history]

    # Casual path — no RAG, stream directly
    if is_casual(request.question) and not has_history:
        yield f"event: meta\ndata: {json.dumps({'verses': [], 'retrieval_scores': []})}\n\n"
        async for chunk in generate_stream(_CASUAL_PROMPT, request.question):
            # JSON-encode each chunk so embedded newlines don't break SSE framing
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"
        return

    # RAG path
    query_vector = await asyncio.to_thread(encode, request.question)
    verses, scores, low_confidence = search(query_vector, request.top_k)
    system_prompt = build_system_prompt(verses)

    # Inject correction directive if the previous user turn showed frustration
    if _has_frustration_in_history(claude_history):
        system_prompt += (
            "\n\nIMPORTANT: The user felt the previous answer missed the point. "
            "Re-read their question carefully. Give a direct, grounded response "
            "that speaks to exactly what they asked."
        )

    lang_name = _LANGUAGE_NAMES.get(request.language, "English")
    user_message = f"[Respond in: {lang_name}]\n\n{request.question}"
    if low_confidence:
        user_message = f"[Note: {LOW_CONFIDENCE_NOTE}]\n\n{user_message}"

    verse_dicts = [
        {
            "chapter": v["chapter"],
            "verse": v["verse"],
            "sanskrit": v["sanskrit"],
            "hindi": v["hindi"],
            "english": v["english"],
        }
        for v in verses
    ]
    yield f"event: meta\ndata: {json.dumps({'verses': verse_dicts, 'retrieval_scores': scores})}\n\n"

    async for chunk in generate_stream(system_prompt, user_message, history=claude_history):
        yield f"data: {json.dumps(chunk)}\n\n"

    yield "data: [DONE]\n\n"


async def ask_krishna(request: AskRequest) -> AskResponse:
    has_history = bool(request.history)

    # Only cache stateless (no-history) requests
    cache_key = (request.question.lower().strip(), request.language, request.top_k, request.voice)
    if not has_history and cache_key in _response_cache:
        return _response_cache[cache_key]

    # Build Claude history from prior turns
    claude_history = [{"role": t.role, "content": t.content} for t in request.history]

    # ── Casual / greeting path ────────────────────────────────────────────────
    if is_casual(request.question) and not has_history:
        response_text = await generate(_CASUAL_PROMPT, request.question)

        audio_url: str | None = None
        if request.voice:
            audio_url = await synthesize(clean_for_tts(response_text), language=request.language)

        result = AskResponse(
            response_text=response_text,
            verses=[],
            audio_url=audio_url,
            retrieval_scores=[],
        )
        _response_cache[cache_key] = result
        return result

    # ── RAG pipeline ──────────────────────────────────────────────────────────
    query_vector = await asyncio.to_thread(encode, request.question)
    verses, scores, low_confidence = search(query_vector, request.top_k)
    system_prompt = build_system_prompt(verses)

    # Inject correction directive if the previous user turn showed frustration
    if _has_frustration_in_history(claude_history):
        system_prompt += (
            "\n\nIMPORTANT: The user felt the previous answer missed the point. "
            "Re-read their question carefully. Give a direct, grounded response "
            "that speaks to exactly what they asked."
        )

    lang_name = _LANGUAGE_NAMES.get(request.language, "English")
    user_message = f"[Respond in: {lang_name}]\n\n{request.question}"
    if low_confidence:
        user_message = f"[Note: {LOW_CONFIDENCE_NOTE}]\n\n{user_message}"

    response_text = await generate(system_prompt, user_message, history=claude_history)

    # Validate citations — one retry max, then accept original to avoid loops
    if not validate_citations(response_text, verses):
        logger.warning("Citation validation failed — retrying with stricter prompt")
        try:
            stricter = (
                system_prompt
                + "\n\nCRITICAL: Only cite insights that appear in the WISDOM REFERENCES above."
            )
            response_text = await generate(stricter, user_message, history=claude_history)
        except Exception as exc:
            logger.error("Retry also failed: %s — using original response", exc)

    audio_url = None
    if request.voice:
        audio_url = await synthesize(clean_for_tts(response_text), language=request.language)

    verse_results = [
        VerseResult(
            chapter=v["chapter"],
            verse=v["verse"],
            sanskrit=v["sanskrit"],
            hindi=v["hindi"],
            english=v["english"],
        )
        for v in verses
    ]

    result = AskResponse(
        response_text=response_text,
        verses=verse_results,
        audio_url=audio_url,
        retrieval_scores=scores,
    )

    if not has_history:
        _response_cache[cache_key] = result
    return result

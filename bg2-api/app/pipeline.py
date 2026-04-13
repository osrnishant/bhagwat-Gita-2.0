from __future__ import annotations

import asyncio
import re
import time
from pathlib import Path

from cachetools import TTLCache

from .embedding import encode
from .retriever import search
from .prompts import build_system_prompt
from .claude_client import generate
from .tts_client import synthesize
from .models import AskRequest, AskResponse, VerseResult

LOW_CONFIDENCE_NOTE = (
    "I searched carefully, but these are the closest matches I found "
    "to your question. They may not speak to it directly."
)

# Cache full AskResponse objects keyed on (question, language, top_k).
# Corpus is static — responses don't change between deployments.
# 256 entries × ~2KB avg ≈ 512KB max memory. TTL 1 hour.
_response_cache: TTLCache = TTLCache(maxsize=256, ttl=3600)

_LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "sa": "Sanskrit",
    "mixed": "Hindi-English mix",
}

# Casual system prompt — no RAG context needed
_CASUAL_PROMPT: str = (
    Path(__file__).resolve().parent / "prompts" / "arya_casual.txt"
).read_text(encoding="utf-8").strip()

# Patterns that indicate a greeting / small talk — no Gita context needed
_CASUAL_RE = re.compile(
    r"^\s*("
    r"hi|hello|hey|hiya|howdy|greetings|"
    r"how are you|how r u|how are u|how's it going|how'?re you|"
    r"what'?s up|wassup|sup|"
    r"good morning|good afternoon|good evening|good night|"
    r"thanks|thank you|thank u|thx|ty|"
    r"bye|goodbye|see you|see ya|cya|"
    r"ok|okay|cool|great|nice|got it|"
    r"who are you|what are you|introduce yourself|tell me about yourself|"
    r"are you there|you there|hello\??|"
    r"namaste|namaskar|jai shri krishna|jai hind"
    r")[\s!?.]*$",
    re.IGNORECASE,
)


def is_casual(question: str) -> bool:
    """Return True if the question is a greeting or small talk with no need for RAG."""
    return bool(_CASUAL_RE.match(question.strip()))


def extract_citations(text: str) -> set[str]:
    """
    Parse citations from the structured CITED: footer added by the prompt.
    Format: CITED: [2:47, 6:5, 3:19]
    Falls back to scanning inline Chapter/अध्याय patterns if the footer is absent.
    Returns a set of 'chapter_verse' strings, e.g. {'2_47', '6_5'}.
    """
    footer = re.search(r"CITED:\s*\[([^\]]*)\]", text, re.IGNORECASE)
    if footer:
        pairs = re.findall(r"(\d+):(\d+)", footer.group(1))
        return {f"{c}_{v}" for c, v in pairs}

    en = re.findall(r"Chapter\s+(\d+),\s+Verse\s+(\d+)", text, re.IGNORECASE)
    hi = re.findall(r"अध्याय\s+(\d+),\s+श्लोक\s+(\d+)", text)
    return {f"{c}_{v}" for c, v in en + hi}


def validate_citations(response_text: str, retrieved_verses: list[dict]) -> bool:
    """Every cited verse must exist in the retrieved context."""
    cited = extract_citations(response_text)
    retrieved_ids = {v["id"] for v in retrieved_verses}
    return cited.issubset(retrieved_ids)


async def ask_krishna(request: AskRequest) -> AskResponse:
    start = time.monotonic()

    # Cache check — normalise key so "What is karma?" and "what is karma?"
    # share the same entry.
    cache_key = (request.question.lower().strip(), request.language, request.top_k, request.voice)
    if cache_key in _response_cache:
        return _response_cache[cache_key]

    # ── Casual / greeting path — skip RAG entirely ────────────────────────────
    if is_casual(request.question):
        response_text = await generate(_CASUAL_PROMPT, request.question)

        audio_url: str | None = None
        if request.voice:
            audio_url = await synthesize(response_text, language=request.language)

        result = AskResponse(
            response_text=response_text,
            verses=[],
            audio_url=audio_url,
            retrieval_scores=[],
        )
        _response_cache[cache_key] = result
        return result

    # ── Substantive question path — full RAG pipeline ─────────────────────────

    # 1. Embed the question — run sync Voyage client in thread pool so it
    #    doesn't block the event loop while waiting on the HTTP round-trip.
    query_vector = await asyncio.to_thread(encode, request.question)

    # 2. Retrieve top-k verses (score_threshold applied inside search())
    verses, scores, low_confidence = search(query_vector, request.top_k)

    # 3. Build system prompt with verses injected into {context}
    system_prompt = build_system_prompt(verses)

    # 4. User message: explicit language directive + question (+ low-confidence note)
    lang_name = _LANGUAGE_NAMES.get(request.language, "English")
    user_message = f"[Respond in: {lang_name}]\n\n{request.question}"
    if low_confidence:
        user_message = f"[Note: {LOW_CONFIDENCE_NOTE}]\n\n{user_message}"

    # 5. Generate via Claude
    response_text = await generate(system_prompt, user_message)

    # 6. Validate citations — retry once with a stricter reminder if invalid
    if not validate_citations(response_text, verses):
        stricter = (
            system_prompt
            + "\n\nCRITICAL: Only cite verses that appear in the CITED CONTEXT above. "
            "Do not reference any other verse numbers."
        )
        response_text = await generate(stricter, user_message)

    _ = time.monotonic() - start  # available for future latency logging

    # 7. TTS — strip the CITED footer before sending to TTS
    audio_url = None
    if request.voice:
        clean_text = re.sub(r"\nCITED:.*$", "", response_text, flags=re.IGNORECASE | re.DOTALL).strip()
        audio_url = await synthesize(clean_text, language=request.language)

    # 8. Build response
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
    _response_cache[cache_key] = result
    return result

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

# Cache full AskResponse objects keyed on (question, language, top_k, voice).
# 256 entries × ~2KB avg ≈ 512KB max memory. TTL 30 min (shorter = fresher after deploys).
_response_cache: TTLCache = TTLCache(maxsize=256, ttl=1800)

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

# Strip the app name so "hello Arya how are you" matches the same as "hello how are you"
_NAME_RE = re.compile(r"\b(arya)\b", re.IGNORECASE)

# Patterns that indicate a greeting / small talk — no Gita context needed
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


def is_casual(question: str) -> bool:
    """Return True if the question is a greeting or small talk with no need for RAG.
    Strips the app name 'Arya' first so 'hello Arya how are you' still matches.
    """
    cleaned = _NAME_RE.sub("", question).strip()
    # Also handle very short messages (under 4 words, no question words)
    words = cleaned.split()
    if len(words) <= 2 and not any(w in cleaned.lower() for w in ["what", "why", "how", "when", "where", "should", "can"]):
        return True
    return bool(_CASUAL_RE.match(cleaned))


def clean_for_tts(text: str) -> str:
    """Strip markdown and punctuation that TTS engines read aloud literally."""
    # Remove CITED footer
    text = re.sub(r"\nCITED:.*$", "", text, flags=re.IGNORECASE | re.DOTALL)
    # Strip bold/italic asterisks: *word* or **word**
    text = re.sub(r"\*+([^*\n]+)\*+", r"\1", text)
    # Strip underscores used for emphasis
    text = re.sub(r"_([^_\n]+)_", r"\1", text)
    # Em dash and en dash → natural pause (comma or period)
    text = text.replace("—", ",").replace("–", ",")
    # Hash headers
    text = re.sub(r"^#+\s+", "", text, flags=re.MULTILINE)
    # Backticks
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


async def ask_krishna(request: AskRequest) -> AskResponse:
    cache_key = (request.question.lower().strip(), request.language, request.top_k, request.voice)
    if cache_key in _response_cache:
        return _response_cache[cache_key]

    # ── Casual / greeting path — skip RAG entirely ────────────────────────────
    if is_casual(request.question):
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

    # ── Substantive question path — full RAG pipeline ─────────────────────────

    query_vector = await asyncio.to_thread(encode, request.question)
    verses, scores, low_confidence = search(query_vector, request.top_k)
    system_prompt = build_system_prompt(verses)

    lang_name = _LANGUAGE_NAMES.get(request.language, "English")
    user_message = f"[Respond in: {lang_name}]\n\n{request.question}"
    if low_confidence:
        user_message = f"[Note: {LOW_CONFIDENCE_NOTE}]\n\n{user_message}"

    response_text = await generate(system_prompt, user_message)

    if not validate_citations(response_text, verses):
        stricter = (
            system_prompt
            + "\n\nCRITICAL: Only cite insights that appear in the WISDOM REFERENCES above."
        )
        response_text = await generate(stricter, user_message)

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
    _response_cache[cache_key] = result
    return result

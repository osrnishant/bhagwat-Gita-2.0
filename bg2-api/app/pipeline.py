import re
import time

from .embedding import encode
from .retriever import search
from .prompts import KRISHNA_SYSTEM_PROMPT, build_context_prompt
from .claude_client import generate
from .models import AskRequest, AskResponse, VerseResult
from .config import RETRIEVAL_THRESHOLD

LOW_CONFIDENCE_NOTE = (
    "I searched the Gita carefully, but these verses are the closest I found "
    "to your question. They may not speak to it directly."
)


def extract_citations(text: str) -> set[str]:
    """Return set of 'chapter_verse' strings cited in the response."""
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

    # 1. Embed the question
    query_vector = encode(request.question)

    # 2. Retrieve top-k verses
    verses, scores = search(query_vector, request.top_k)

    # 3. Low-confidence check
    low_confidence = scores and scores[0] < RETRIEVAL_THRESHOLD

    # 4. Build prompt
    prompt = build_context_prompt(request.question, verses)
    if low_confidence:
        prompt = f"[Note: {LOW_CONFIDENCE_NOTE}]\n\n{prompt}"

    # 5. Generate via Claude
    response_text = await generate(KRISHNA_SYSTEM_PROMPT, prompt)

    # 6. Validate citations — retry once with a stricter reminder if invalid
    if not validate_citations(response_text, verses):
        stricter = (
            KRISHNA_SYSTEM_PROMPT
            + "\n\nCRITICAL: Only cite verses that appear in the <gita_verses> block. "
            "Do not reference any other verse numbers."
        )
        response_text = await generate(stricter, prompt)

    # 7. Build response
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

    return AskResponse(
        response_text=response_text,
        verses=verse_results,
        audio_url=None,
        retrieval_scores=scores,
    )

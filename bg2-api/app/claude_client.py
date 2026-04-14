from __future__ import annotations

import asyncio
import logging

import anthropic
from .config import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_TOKENS, TEMPERATURE

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {429, 500, 502, 503, 529}
_MAX_RETRIES = 3

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, timeout=30.0)
    return _client


async def generate(
    system_prompt: str,
    user_message: str,
    history: list[dict] | None = None,
) -> str:
    """Call Claude and return response text.

    history: list of prior turns as [{"role": "user"|"assistant", "content": str}]
    Supports conversational memory — prior turns are passed as context.
    cache_control on the system prompt enables Anthropic prompt caching (~90% cost
    reduction on system tokens, 5-min TTL, auto-refreshed on each hit).
    Retries up to 3 times on transient API errors (429, 5xx) with exponential backoff.
    """
    messages: list[dict] = []
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    for attempt in range(_MAX_RETRIES):
        try:
            response = await get_client().messages.create(
                model=CLAUDE_MODEL,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=messages,
            )

            # Guard: Claude may return tool_use or other block types in edge cases
            for block in response.content:
                if block.type == "text":
                    return block.text

            raise ValueError(f"Claude returned no text block. Stop reason: {response.stop_reason}")

        except anthropic.APIStatusError as exc:
            if exc.status_code in _RETRYABLE_STATUS and attempt < _MAX_RETRIES - 1:
                delay = 1.0 * (2 ** attempt)
                logger.warning("Claude API %s — retry %d/%d in %.1fs", exc.status_code, attempt + 1, _MAX_RETRIES - 1, delay)
                await asyncio.sleep(delay)
            else:
                raise


async def generate_stream(
    system_prompt: str,
    user_message: str,
    history: list[dict] | None = None,
):
    """Stream Claude response tokens as they arrive.

    Yields str chunks. Caller is responsible for assembling full text if needed.
    """
    messages: list[dict] = []
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    async with get_client().messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text

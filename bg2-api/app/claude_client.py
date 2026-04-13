from __future__ import annotations

import anthropic
from .config import ANTHROPIC_API_KEY, CLAUDE_MODEL, MAX_TOKENS, TEMPERATURE

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, timeout=30.0)
    return _client


async def generate(system_prompt: str, user_message: str) -> str:
    """Call Claude and return response text.

    cache_control on the system prompt block enables Anthropic prompt
    caching — the Krishna persona + verse context is re-read from cache
    on subsequent requests, saving ~90% of system-prompt token cost.
    Cache TTL is 5 minutes (ephemeral), auto-refreshed on each hit.
    """
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
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text

from __future__ import annotations

import base64
import logging

import httpx

from .config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

logger = logging.getLogger(__name__)

_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


async def synthesize(text: str) -> str | None:
    """
    Call ElevenLabs and return a base64 data URL (data:audio/mpeg;base64,...)
    so the frontend can play it without needing a file server.

    Returns None (silently) if ElevenLabs keys are not configured or the
    call fails — TTS is optional; the text response is always returned.
    """
    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        logger.debug("TTS skipped — ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID not set")
        return None

    url = _TTS_URL.format(voice_id=ELEVENLABS_VOICE_ID)
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "audio/mpeg",
                },
            )
            response.raise_for_status()
    except Exception as exc:
        logger.warning("TTS call failed: %s", exc)
        return None

    encoded = base64.b64encode(response.content).decode("ascii")
    return f"data:audio/mpeg;base64,{encoded}"

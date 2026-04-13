from __future__ import annotations

import base64
import logging

import edge_tts

logger = logging.getLogger(__name__)

# Soothing Indian female voices — auto-selected by language
_VOICES: dict[str, str] = {
    "hi":     "hi-IN-SwaraNeural",      # Hindi female
    "sa":     "hi-IN-SwaraNeural",      # Sanskrit — use Hindi voice
    "mixed":  "hi-IN-SwaraNeural",      # Hinglish — use Hindi voice
    "en":     "en-IN-NeerjaNeural",     # Indian English female
}
_DEFAULT_VOICE = "en-IN-NeerjaNeural"


async def synthesize(text: str, language: str = "en") -> str | None:
    """
    Generate speech via Microsoft Edge TTS (free, no API key).
    Returns a base64 data URL (data:audio/mpeg;base64,...) or None on failure.
    """
    voice = _VOICES.get(language, _DEFAULT_VOICE)
    try:
        communicate = edge_tts.Communicate(text, voice)
        audio = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
        if not audio:
            logger.warning("edge-tts returned empty audio for voice=%s", voice)
            return None
        encoded = base64.b64encode(bytes(audio)).decode("ascii")
        return f"data:audio/mpeg;base64,{encoded}"
    except Exception as exc:
        logger.warning("TTS failed (voice=%s): %s", voice, exc)
        return None

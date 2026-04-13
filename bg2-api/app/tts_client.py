from __future__ import annotations

import base64
import logging

import edge_tts

logger = logging.getLogger(__name__)

# Soothing Indian female voices — auto-selected by language
# NeerjaExpressive is Microsoft's affective neural voice — warmer and more natural than NeerjaNeural
_VOICES: dict[str, str] = {
    "hi":     "hi-IN-SwaraNeural",          # Hindi female
    "sa":     "hi-IN-SwaraNeural",          # Sanskrit — use Hindi voice
    "mixed":  "hi-IN-SwaraNeural",          # Hinglish — use Hindi voice
    "en":     "en-IN-NeerjaExpressiveNeural",  # Indian English female (affective, warmer)
}
_DEFAULT_VOICE = "en-IN-NeerjaExpressiveNeural"

# Slight slowdown (-8%) for a contemplative, soothing delivery
_RATE = "-8%"


async def synthesize(text: str, language: str = "en") -> str | None:
    """
    Generate speech via Microsoft Edge TTS (free, no API key).
    Returns a base64 data URL (data:audio/mpeg;base64,...) or None on failure.
    """
    voice = _VOICES.get(language, _DEFAULT_VOICE)
    try:
        communicate = edge_tts.Communicate(text, voice, rate=_RATE)
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

from __future__ import annotations

from pathlib import Path

_TEMPLATE: str = (
    Path(__file__).resolve().parent / "prompts" / "krishna_system.txt"
).read_text(encoding="utf-8").strip()


def build_system_prompt(verses: list[dict]) -> str:
    """Return the system prompt with the retrieved verse block substituted for {context}."""
    blocks = []
    for v in verses:
        blocks.append(
            f"[Chapter {v['chapter']}, Verse {v['verse']}]\n"
            f"Sanskrit: {v['sanskrit']}\n"
            f"Hindi: {v['hindi']}\n"
            f"English: {v['english']}"
        )
    return _TEMPLATE.replace("{context}", "\n\n".join(blocks))

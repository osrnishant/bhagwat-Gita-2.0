from __future__ import annotations

from pathlib import Path

_TEMPLATE: str = (
    Path(__file__).resolve().parent / "prompts" / "krishna_system.txt"
).read_text(encoding="utf-8").strip()


def build_system_prompt(verses: list[dict]) -> str:
    """Return the system prompt with the retrieved verse block substituted for {context}.

    Verse labels are stripped of 'Chapter/Verse' framing to prevent Claude from
    associating them with Krishna and leaking that name into responses.
    The chapter:verse IDs are preserved only for the CITED footer validation.
    """
    blocks = []
    for i, v in enumerate(verses, 1):
        blocks.append(
            f"[Reference {i} — id:{v['chapter']}:{v['verse']}]\n"
            f"{v['english']}\n"
            f"Hindi: {v['hindi']}"
        )
    return _TEMPLATE.replace("{context}", "\n\n".join(blocks))

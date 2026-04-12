from __future__ import annotations

from pathlib import Path

_PROMPT_FILE = Path(__file__).resolve().parent / "prompts" / "krishna_system.txt"

KRISHNA_SYSTEM_PROMPT: str = _PROMPT_FILE.read_text(encoding="utf-8").strip()


def build_context_prompt(question: str, verses: list[dict]) -> str:
    verse_blocks = []
    for v in verses:
        block = (
            f"[अध्याय {v['chapter']}, श्लोक {v['verse']}]\n"
            f"Sanskrit: {v['sanskrit']}\n"
            f"Hindi: {v['hindi']}\n"
            f"English: {v['english']}"
        )
        verse_blocks.append(block)

    return f"""<gita_verses>
{chr(10).join(verse_blocks)}
</gita_verses>

<question>
{question}
</question>"""

"""
Validate bg2-api/data/verses.json corpus integrity.

Run from repo root:
    python bg2-api/scripts/validate_corpus.py

Exits 0 if all checks pass, 1 if any fail.
"""

import json
import sys
from pathlib import Path

VERSES_PATH = Path(__file__).resolve().parent.parent / "data" / "verses.json"

# Canonical verse counts per chapter (Bhagavad Gita As It Is)
EXPECTED_VERSE_COUNTS = {
    1: 47,  2: 72,  3: 43,  4: 42,  5: 29,
    6: 47,  7: 30,  8: 28,  9: 34, 10: 42,
    11: 55, 12: 20, 13: 35, 14: 27, 15: 20,
    16: 24, 17: 28, 18: 78,
}
EXPECTED_TOTAL = sum(EXPECTED_VERSE_COUNTS.values())  # 701

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"

passed = 0
failed = 0


def ok(label: str, detail: str = "") -> None:
    global passed
    passed += 1
    suffix = f"  {detail}" if detail else ""
    print(f"  {GREEN}PASS{RESET}  {label}{suffix}")


def fail(label: str, detail: str) -> None:
    global failed
    failed += 1
    print(f"  {RED}FAIL{RESET}  {label}")
    for line in detail.splitlines():
        print(f"        {line}")


# ── Load ───────────────────────────────────────────────────────────────────────
print(f"Loading {VERSES_PATH}\n")
try:
    with open(VERSES_PATH, encoding="utf-8") as f:
        verses = json.load(f)
except FileNotFoundError:
    print(f"{RED}ERROR{RESET}  File not found: {VERSES_PATH}")
    sys.exit(1)
except json.JSONDecodeError as e:
    print(f"{RED}ERROR{RESET}  Invalid JSON: {e}")
    sys.exit(1)

print(f"  Loaded {len(verses)} verse objects\n")

# ── Check 1: Total count ───────────────────────────────────────────────────────
print("Check 1: Total verse count")
if len(verses) == EXPECTED_TOTAL:
    ok("701 verses present", f"({len(verses)})")
else:
    fail("701 verses present", f"Expected {EXPECTED_TOTAL}, got {len(verses)}")

# ── Check 2: Required fields ───────────────────────────────────────────────────
print("\nCheck 2: Required fields on every verse")
REQUIRED = ["id", "chapter", "verse", "sanskrit", "hindi", "english", "themes", "embedding_text"]
bad_fields = [
    f"{v.get('id','<no id>')} — missing: {[k for k in REQUIRED if k not in v]}"
    for v in verses
    if any(k not in v for k in REQUIRED)
]
if bad_fields:
    fail("All required fields present", "\n".join(bad_fields))
else:
    ok("All required fields present", f"({', '.join(REQUIRED)})")

# ── Check 3: No empty text fields ─────────────────────────────────────────────
print("\nCheck 3: No empty Sanskrit / Hindi / English / embedding_text")
for field in ["sanskrit", "hindi", "english", "embedding_text"]:
    empty = [v["id"] for v in verses if not str(v.get(field, "")).strip()]
    if empty:
        fail(f"No empty {field}", f"{len(empty)} verse(s): {empty[:10]}{'...' if len(empty) > 10 else ''}")
    else:
        ok(f"No empty {field}")

# ── Check 4: No duplicate IDs ─────────────────────────────────────────────────
print("\nCheck 4: No duplicate IDs")
from collections import Counter
id_counts = Counter(v.get("id") for v in verses)
dupes = {id_: n for id_, n in id_counts.items() if n > 1}
if dupes:
    fail("No duplicate IDs", f"{dupes}")
else:
    ok("No duplicate IDs")

# ── Check 5: Chapter numbers 1–18 ─────────────────────────────────────────────
print("\nCheck 5: Chapter numbers are 1–18")
bad_ch = [v["id"] for v in verses if v.get("chapter") not in range(1, 19)]
if bad_ch:
    fail("All chapters in range 1–18", f"{bad_ch}")
else:
    ok("All chapters in range 1–18")

# ── Check 6: Verse counts per chapter ─────────────────────────────────────────
print("\nCheck 6: Verse count per chapter matches canonical")
by_chapter: dict[int, list[int]] = {}
for v in verses:
    by_chapter.setdefault(v["chapter"], []).append(v["verse"])

chapter_errors = []
for ch in range(1, 19):
    expected = EXPECTED_VERSE_COUNTS[ch]
    actual   = len(by_chapter.get(ch, []))
    if actual != expected:
        chapter_errors.append(f"Ch {ch:2d}: expected {expected}, got {actual}")

if chapter_errors:
    fail("Per-chapter counts match canonical", "\n".join(chapter_errors))
else:
    ok("Per-chapter counts match canonical")

# ── Check 7: Verse numbers are sequential from 1 ──────────────────────────────
print("\nCheck 7: Verse numbers are sequential (no gaps or skips)")
seq_errors = []
for ch in range(1, 19):
    verse_nums = sorted(by_chapter.get(ch, []))
    expected_seq = list(range(1, EXPECTED_VERSE_COUNTS[ch] + 1))
    if verse_nums != expected_seq:
        missing = sorted(set(expected_seq) - set(verse_nums))
        extra   = sorted(set(verse_nums) - set(expected_seq))
        msg = f"Ch {ch:2d}:"
        if missing: msg += f" missing {missing}"
        if extra:   msg += f" extra {extra}"
        seq_errors.append(msg)

if seq_errors:
    fail("No gaps or skips in verse numbering", "\n".join(seq_errors))
else:
    ok("No gaps or skips in verse numbering")

# ── Check 8: ID format matches chapter_verse ──────────────────────────────────
print("\nCheck 8: ID format is '{chapter}_{verse}'")
bad_ids = [
    v["id"] for v in verses
    if v.get("id") != f"{v.get('chapter')}_{v.get('verse')}"
]
if bad_ids:
    fail("All IDs match '{chapter}_{verse}'", f"{bad_ids[:10]}")
else:
    ok("All IDs match '{chapter}_{verse}'")

# ── Check 9: embedding_text starts with correct prefix ────────────────────────
print("\nCheck 9: embedding_text starts with 'Chapter N Verse N:'")
bad_emb = [
    v["id"] for v in verses
    if not v.get("embedding_text", "").startswith(
        f"Chapter {v.get('chapter')} Verse {v.get('verse')}:"
    )
]
if bad_emb:
    fail("All embedding_text have correct prefix", f"{len(bad_emb)} verse(s): {bad_emb[:10]}")
else:
    ok("All embedding_text have correct prefix")

# ── Check 10: Themes is a non-empty list ──────────────────────────────────────
print("\nCheck 10: themes is a non-empty list on every verse")
bad_themes = [
    v["id"] for v in verses
    if not isinstance(v.get("themes"), list) or len(v.get("themes", [])) == 0
]
if bad_themes:
    fail("All verses have non-empty themes list", f"{len(bad_themes)} verse(s): {bad_themes[:10]}")
else:
    ok("All verses have non-empty themes list")

# ── Summary ───────────────────────────────────────────────────────────────────
total_checks = passed + failed
print(f"\n{'─' * 50}")
print(f"  {passed}/{total_checks} checks passed")
if failed == 0:
    print(f"  {GREEN}ALL CHECKS PASSED{RESET} — corpus is valid")
    sys.exit(0)
else:
    print(f"  {RED}{failed} CHECK(S) FAILED{RESET}")
    sys.exit(1)

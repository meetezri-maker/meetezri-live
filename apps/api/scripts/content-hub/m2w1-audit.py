"""
Month 2 Week 1 workbook audit — READ ONLY.

Reports exact metadata lengths, projected block counts, and the public-content ranges for the
three Content Hub assets. Writes nothing and produces no TypeScript; this is the Phase 1 audit.
"""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
DOCX = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/m2/m2.docx")
FLAGGED = Path("/tmp/m2/m2f.txt")

subprocess.run([sys.executable, str(HERE / "w2-extract.py"), str(DOCX), str(FLAGGED)], check=True)
ROWS = [line.split("|", 2) for line in FLAGGED.read_text(encoding="utf-8").split("\n")]
TEXT = [r[2].strip() if len(r) > 2 else "" for r in ROWS]


def rows(start, end):
    out = []
    for r in ROWS[start - 1 : end]:
        if len(r) < 3:
            continue
        t = r[2].strip()
        if not t:
            continue
        out.append((r[0][0] == "B", r[0][1] == "L", t))
    return out


def projected_blocks(seg):
    """One block per paragraph, with consecutive bullets collapsing into one list block."""
    n, in_list = 0, False
    for _bold, is_li, _t in seg:
        if is_li:
            if not in_list:
                n += 1
                in_list = True
        else:
            in_list = False
            n += 1
    return n


def words(seg):
    import re
    return len(re.findall(r"[A-Za-z0-9']+", " ".join(t for _b, _l, t in seg).lower()))


print("=" * 78)
print("  MONTH 2 WEEK 1 — PUBLIC CONTENT RANGES")
print("=" * 78)

RANGES = {
    "M2-W1-B001": [("article  §8", 168, 463), ("faq      §9", 465, 488)],
    "M2-W1-G001": [("intro    §8", 815, 828), ("sections §9-18", 829, 1016)],
    "M2-W1-A001": [("answers  §5-28", 1490, 1868), ("quick    §29", 1884, 1904)],
}

for ref, parts in RANGES.items():
    total_blocks, total_words, total_paras = 0, 0, 0
    print(f"\n{ref}")
    for label, a, b in parts:
        seg = rows(a, b)
        blocks = projected_blocks(seg)
        print(
            f"   {label:16} lines {a}-{b}   paragraphs={len(seg):4}  "
            f"bold={sum(1 for x in seg if x[0]):3}  bullets={sum(1 for x in seg if x[1]):3}  "
            f"blocks≈{blocks:4}  words={words(seg)}"
        )
        total_blocks += blocks
        total_words += words(seg)
        total_paras += len(seg)
    print(f"   {'TOTAL':16} paragraphs={total_paras}  blocks≈{total_blocks}  words={total_words}"
          f"   {'OK' if total_blocks <= 500 else 'EXCEEDS 500'}")

print("\n" + "=" * 78)
print("  METADATA — ACTUAL CHARACTER COUNTS")
print("=" * 78)

META = {
    "M2-W1-B001 SEO title": 491,
    "M2-W1-B001 meta description": 495,
    "M2-W1-G001 page title": 806,
    "M2-W1-G001 meta description": 809,
    "M2-W1-A001 SEO title": 2099,
    "M2-W1-A001 meta description": 2101,
}
for label, line in META.items():
    value = TEXT[line - 1]
    flag = ""
    if "meta description" in label:
        flag = "  OK (50-160)" if 50 <= len(value) <= 160 else f"  ← OUTSIDE 50-160"
    print(f"\n  {label}  [line {line}]  length={len(value)}{flag}")
    print(f"     {value}")

print("\n" + "=" * 78)
print("  SLUGS SUPPLIED BY THE WORKBOOK")
print("=" * 78)
for label, line in {
    "M2-W1-B001": 493,
    "M2-W1-G001": 812,
    "M2-W1-A001": 2103,
}.items():
    print(f"  {label}: {TEXT[line - 1]}")

print("\n" + "=" * 78)
print("  DUPLICATE-REGION SCAN (8-paragraph sliding window, whole document)")
print("=" * 78)
body = [t for t in TEXT if t]
window, seen = 8, {}
for i in range(len(body) - window + 1):
    seen.setdefault(tuple(body[i : i + window]), []).append(i)
dupes = [hits for hits in seen.values() if len(hits) > 1]
print(f"  duplicated windows: {len(dupes)}")

print("\n  public-section uniqueness:")
for marker in [
    "8. COMPLETE SEO ARTICLE",
    "9. FAQ SECTION",
    "8. GEO INTRODUCTION",
    "29. QUICK ANSWER LIBRARY",
    "40. CONTENT SAFETY GUARDRAILS",
]:
    print(f"    {marker:34} occurs {sum(1 for t in TEXT if t == marker)}×")

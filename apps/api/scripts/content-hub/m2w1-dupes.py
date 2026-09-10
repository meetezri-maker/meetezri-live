"""
Where are the Month 2 Week 1 duplicated regions? — READ ONLY.

609 duplicated 8-paragraph windows exist across the document. What matters is whether any of them
fall inside the ranges that become public body content. Operational sections legitimately repeat
(checklists, KPI tables, handoff blocks are copied per asset).
"""

from pathlib import Path

FLAGGED = Path("/tmp/m2/m2f.txt")
ROWS = [line.split("|", 2) for line in FLAGGED.read_text(encoding="utf-8").split("\n")]
TEXT = [r[2].strip() if len(r) > 2 else "" for r in ROWS]

# (label, first-line, last-line) — the ranges that would become public body content.
PUBLIC = [
    ("B001 article §8", 168, 463),
    ("B001 faq §9", 465, 488),
    ("G001 intro §8", 815, 828),
    ("G001 sections §9-18", 829, 1016),
    ("A001 answers §5-28", 1490, 1868),
    ("A001 quick §29", 1884, 1904),
]

# Index of non-empty lines, keeping their 1-based document line numbers.
indexed = [(i + 1, t) for i, t in enumerate(TEXT) if t]

window = 8
seen = {}
for i in range(len(indexed) - window + 1):
    key = tuple(t for _n, t in indexed[i : i + window])
    seen.setdefault(key, []).append(indexed[i][0])

dupes = {k: v for k, v in seen.items() if len(v) > 1}


def in_public(line):
    for label, a, b in PUBLIC:
        if a <= line <= b:
            return label
    return None


hits_in_public = []
for key, starts in dupes.items():
    labels = [in_public(s) for s in starts]
    if any(labels):
        hits_in_public.append((starts, labels, key[0]))

print(f"total duplicated windows      : {len(dupes)}")
print(f"windows touching public ranges: {len(hits_in_public)}")

if hits_in_public:
    print("\nFIRST 10 PUBLIC-RANGE DUPLICATES:")
    for starts, labels, first in hits_in_public[:10]:
        print(f"  lines {starts} {labels} :: {first[:80]!r}")
else:
    print("\nNone. Every duplicated window lies entirely in operational sections.")

# Show where the duplication actually lives, by first line of each duplicate group.
print("\nSAMPLE OF DUPLICATED OPERATIONAL CONTENT (first 8 groups):")
for key, starts in list(dupes.items())[:8]:
    print(f"  starts at lines {starts[:4]} :: {key[0][:75]!r}")

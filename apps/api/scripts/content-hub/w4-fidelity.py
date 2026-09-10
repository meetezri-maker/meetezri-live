"""
Week 4 transcription fidelity check — proves the mapping changed no words.

Two checks per asset:

  1. CONTAINMENT (strict, always applied) — every word of the workbook's publishable region
     appears in the generated module at least as many times. Nothing dropped, nothing altered.

  2. ORDER — the workbook's words appear in the generated module in their original order.
     W4-A001 is exempt from this one and only this one, because its first "Direct Answer" is
     deliberately hoisted into the `direct_answer` block at position 0 (the AEO contract requires
     exactly one, first). That moves one paragraph ahead of its heading and changes nothing else,
     so the check is re-run against a source sequence with the same hoist applied.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

MODULE = Path(sys.argv[1] if len(sys.argv) > 1 else "src/modules/content-hub/week4/week4-content.ts")
FLAGGED = Path("/tmp/w4/w4f.txt")

SRC = MODULE.read_text(encoding="utf-8")
ROWS = [line.split("|", 2) for line in FLAGGED.read_text(encoding="utf-8").split("\n")]

# Production labels and structural markers, never reader-facing copy.
SKIP_EXACT = {"Question", "Direct Answer (Featured Snippet)"}
SKIP_PREFIX = ("PART ", "Asset ID:", "FAQ ")

WORD = re.compile(r"[A-Za-z0-9']+")
LITERAL = re.compile(r'(?:t\(|question: |label: )"((?:[^"\\]|\\.)*)"')


def region(start, end):
    out = []
    for row in ROWS[start - 1 : end]:
        if len(row) < 3:
            continue
        text = row[2].strip()
        if not text or text in SKIP_EXACT or text.startswith(SKIP_PREFIX):
            continue
        out.append(text)
    return out


def words(strings):
    return WORD.findall(" ".join(strings).lower())


def emitted_words(ref):
    start = SRC.index("const " + ref.replace("-", "_"))
    end = SRC.index("\n};", start)
    literals = [json.loads('"' + m + '"') for m in LITERAL.findall(SRC[start:end])]
    return words(literals)


def is_subsequence(needle, haystack):
    it = iter(haystack)
    return all(word in it for word in needle)


CASES = [
    ("W4-B001", [(208, 505)], False),
    # Section 14 answer library plus section 16 FAQ. Section 15 is snippet-format guidance and is
    # deliberately not imported.
    ("W4-A001", [(1674, 1742), (1775, 1794)], True),
]

failures = 0
for ref, regions, hoists_direct_answer in CASES:
    source_lines = [line for a, b in regions for line in region(a, b)]

    if hoists_direct_answer:
        # Mirror the hoist: the first answer paragraph moves ahead of everything.
        source_lines = [source_lines[1]] + [source_lines[0]] + source_lines[2:]

    source_words = words(source_lines)
    out_words = emitted_words(ref)

    missing = Counter(source_words) - Counter(out_words)
    ordered = is_subsequence(source_words, out_words)

    print(f"{ref}")
    print(f"   workbook words : {len(source_words)}")
    print(f"   emitted words  : {len(out_words)}")
    print(f"   containment — no word lost or altered : {'PASS' if not missing else 'FAIL'}")
    print(f"   order preserved{' (with the documented direct-answer hoist)' if hoists_direct_answer else ''} : {'PASS' if ordered else 'FAIL'}")

    if missing:
        failures += 1
        print(f"   missing words: {dict(list(missing.items())[:10])}")
    if not ordered:
        failures += 1
        it = iter(out_words)
        for index, word in enumerate(source_words):
            if word not in it:
                print(f"   first out-of-order word at position {index}: {word!r}")
                print(f"   context: {' '.join(source_words[max(0, index - 8):index + 8])!r}")
                break

print("\nALL FIDELITY CHECKS PASSED" if failures == 0 else f"\n{failures} FIDELITY CHECK(S) FAILED")
sys.exit(1 if failures else 0)

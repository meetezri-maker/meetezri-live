"""
W4-G001 transcription fidelity check — proves the mapping changed no words.

The approved GEO article is compared against every string literal the generated asset emits, as an
ordered word sequence. Mapping may re-label a paragraph as a heading; it may not add, drop,
reorder or alter a single word.

The `key_statements` type field intentionally repeats five sentences that also appear in the body
("What Should You Remember?"), so the emitted count is expected to exceed the source count. The
check that matters is containment plus order.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

MODULE = Path(sys.argv[1] if len(sys.argv) > 1 else "src/modules/content-hub/week4/week4-content.ts")
FLAGGED = Path("/tmp/g4/g4f.txt")

SRC = MODULE.read_text(encoding="utf-8")
LINES = [line.split("|", 2)[2] if len(line.split("|", 2)) > 2 else "" for line in
         FLAGGED.read_text(encoding="utf-8").split("\n")]

WORD = re.compile(r"[A-Za-z0-9']+")
# Body literals only: `t("...")`. The CTA label and the type fields are checked separately.
BODY_LITERAL = re.compile(r't\("((?:[^"\\]|\\.)*)"\)')


def words(strings):
    return WORD.findall(" ".join(strings).lower())


start = SRC.index("const W4_G001")
end = SRC.index("\n};", start)
asset = SRC[start:end]

# The blocks array only — so `key_statements` (which legitimately repeats body sentences) and the
# type fields do not inflate the comparison.
blocks_start = asset.index("blocks: [")
blocks_end = asset.index("as ContentBody", blocks_start)
blocks_src = asset[blocks_start:blocks_end]

source_lines = [t.strip() for t in LINES if t.strip()][1:]  # drop the title
source_words = words(source_lines)

emitted = [json.loads('"' + m + '"') for m in BODY_LITERAL.findall(blocks_src)]
emitted_words = words(emitted)

missing = Counter(source_words) - Counter(emitted_words)


def is_subsequence(needle, haystack):
    it = iter(haystack)
    return all(word in it for word in needle)


ordered = is_subsequence(source_words, emitted_words)

print("W4-G001")
print(f"   source paragraphs : {len(source_lines)}")
print(f"   emitted body blocks with text : {len(emitted)}")
print(f"   source words  : {len(source_words)}")
print(f"   emitted words : {len(emitted_words)}")
print(f"   containment — no word lost or altered : {'PASS' if not missing else 'FAIL'}")
print(f"   order preserved : {'PASS' if ordered else 'FAIL'}")

failures = 0
if missing:
    failures += 1
    print(f"   missing: {dict(list(missing.items())[:10])}")
if not ordered:
    failures += 1
    it = iter(emitted_words)
    for index, word in enumerate(source_words):
        if word not in it:
            print(f"   first divergence at word {index}: {word!r}")
            print(f"   context: {' '.join(source_words[max(0, index - 8):index + 8])!r}")
            break

# Every paragraph must be present exactly once, as its own block.
if len(emitted) != len(source_lines):
    failures += 1
    print(f"   FAIL block/paragraph mismatch: {len(emitted)} vs {len(source_lines)}")
else:
    print("   one block per source paragraph : PASS")

# Type fields must be verbatim source lines.
all_lines = set(t.strip() for t in LINES if t.strip())
for label, pattern in (("citation_summary", r'citation_summary: "((?:[^"\\]|\\.)*)"'),):
    value = json.loads('"' + re.search(pattern, asset).group(1) + '"')
    ok = value in all_lines
    print(f"   {label} is a verbatim source line : {'PASS' if ok else 'FAIL'}")
    if not ok:
        failures += 1

statements = re.search(r"key_statements: \[(.*?)\]", asset, re.S).group(1)
values = [json.loads(v) for v in re.findall(r'"(?:[^"\\]|\\.)*"', statements)]
all_verbatim = all(v in all_lines for v in values)
print(f"   all {len(values)} key_statements are verbatim source lines : {'PASS' if all_verbatim else 'FAIL'}")
if not all_verbatim:
    failures += 1

print("\nALL FIDELITY CHECKS PASSED" if failures == 0 else f"\n{failures} FIDELITY CHECK(S) FAILED")
sys.exit(1 if failures else 0)

"""
Month 2 Week 1 transcription fidelity check.

For each asset: every word of the approved public source range must appear in the generated module,
the same number of times, in the same order.

Documented, approved exceptions:
  * M2-W1-B001 — the FAQ's list numbering ("1. ", "2. " …) is dropped from the question text; it is
    presentation, not wording.
  * M2-W1-G001 — only the five approved reader-facing trailing sub-blocks are imported, so the
    source range is restricted to what was approved rather than the whole section span.
  * M2-W1-A001 — the first "Direct Answer" is hoisted into the `direct_answer` block at position 0,
    which moves one paragraph ahead of its question heading. The order check is re-run against a
    source sequence with the same hoist applied, so nothing is excused, only re-sequenced.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

MODULE = Path(sys.argv[1] if len(sys.argv) > 1 else "src/modules/content-hub/month2week1/m2w1-content.ts")
FLAGGED = Path("/tmp/m2/m2f.txt")

SRC = MODULE.read_text(encoding="utf-8")
RAW = [line.split("|", 2) for line in FLAGGED.read_text(encoding="utf-8").split("\n")]

WORD = re.compile(r"[A-Za-z0-9']+")
# Every place the generator emits source text: prose, headings, inline spans, FAQ questions and
# answers, and the geo_statement fields (statement is inside t(), the other three are bare).
LITERAL = re.compile(
    r'(?:t\(|question: |text: |answer: t\(|coreMessage: |citationGoal: |examples: \[)'
    r'"((?:[^"\\]|\\.)*)"'
)


def texts(ranges, tables_only=False, skip_tables=False):
    out = []
    for a, b in ranges:
        for r in RAW[a - 1 : b]:
            if len(r) < 3:
                continue
            text = r[2].strip()
            if not text or text in ("[TABLE START]", "[TABLE END]"):
                continue
            is_table = r[1] == "TBL"
            if tables_only and not is_table:
                continue
            if skip_tables and is_table:
                continue
            if is_table:
                cells = [c.strip() for c in text.lstrip("|").split("||")]
                if cells and cells[0] in ("Field", "Question"):
                    continue
                out.extend(cells)
            else:
                out.append(text)
    return out


def words(strings):
    return WORD.findall(" ".join(strings).lower())


def asset_words(ref):
    start = SRC.index("const " + ref.replace("-", "_"))
    end = SRC.index("\n};", start)
    seg = SRC[start:end]
    blocks_start = seg.index("blocks: [")
    blocks_end = seg.index("as ContentBody", blocks_start)
    literals = [json.loads('"' + m + '"') for m in LITERAL.findall(seg[blocks_start:blocks_end])]
    return words(literals), len(literals)


def is_subsequence(needle, haystack):
    it = iter(haystack)
    return all(w in it for w in needle)


failures = 0
print("=" * 78)

# ── M2-W1-B001 ──────────────────────────────────────────────────────────────
b_src = texts([(169, 463)], skip_tables=True) + [
    # FAQ questions with the numbering removed, exactly as mapped.
    (t.split(". ", 1)[1] if t[:3].rstrip(". ").isdigit() else t)
    for t in texts([(465, 488)], skip_tables=True)
]
# ── M2-W1-G001 ──────────────────────────────────────────────────────────────
G_SECTIONS = [
    # (title line, table range, trailing range or None) — mirrors the generator exactly.
    (830, (831, 837), (839, 841)),
    (844, (845, 851), (853, 862)),
    (865, (866, 872), None),
    (880, (881, 887), None),
    (893, (894, 900), (902, 910)),
    (913, (914, 920), None),
    (925, (926, 932), None),
    (943, (944, 950), (952, 956)),
    (959, (960, 965), (967, 967)),
]

def table_values(a, b):
    """
    Value cells only — field LABELS are table scaffolding.

    Returned in the order the generator emits them on the `geo_statement` block (statement,
    examples, coreMessage, citationGoal) rather than the order the table lists them, because a
    block's property order is not content order.
    """
    found = {}
    for r in RAW[a - 1 : b]:
        if len(r) < 3 or r[1] != "TBL":
            continue
        text = r[2].strip()
        if not text or text in ("[TABLE START]", "[TABLE END]"):
            continue
        cells = [c.strip() for c in text.lstrip("|").split("||")]
        if len(cells) < 2 or cells[0] in ("Field", "Question"):
            continue
        key = {
            "GEO Statement": "statement",
            "Example": "examples",
            "Examples": "examples",
            "Example Opening": "examples",
            "Core Message": "coreMessage",
            "Citation Goal": "citationGoal",
        }.get(cells[0])
        if key:
            found[key] = cells[1]
    return [found[k] for k in ("statement", "examples", "coreMessage", "citationGoal") if k in found]

g_src = texts([(815, 828)], skip_tables=True)
for title_line, tbl, trailing in G_SECTIONS:
    g_src += texts([(title_line, title_line)], skip_tables=True)
    g_src += table_values(*tbl)
    if trailing:
        g_src += texts([(trailing[0] - 1, trailing[1])], skip_tables=True)

# ── M2-W1-A001 ──────────────────────────────────────────────────────────────
a_src_raw = [t for t in texts([(1490, 1868)], skip_tables=True)
             if "ANSWER TARGET" not in t.upper()]
a_src_raw = [t[3:].strip() if t.startswith("Q: ") else t for t in a_src_raw]
# Mirror the approved hoist: the first Direct Answer body moves ahead of everything.
try:
    da_label = a_src_raw.index("Direct Answer")
    hoisted = a_src_raw.pop(da_label + 1)
    a_src_raw.pop(da_label)  # the label itself is replaced by the direct_answer block
    a_src_raw.insert(0, hoisted)
except ValueError:
    pass
a_src = a_src_raw + texts([(1884, 1904)], tables_only=True)

CASES = [("M2-W1-B001", b_src), ("M2-W1-G001", g_src), ("M2-W1-A001", a_src)]

for ref, source_lines in CASES:
    source_words = words(source_lines)
    emitted_words, literal_count = asset_words(ref)
    missing = Counter(source_words) - Counter(emitted_words)
    ordered = is_subsequence(source_words, emitted_words)

    print(f"\n{ref}")
    print(f"   source paragraphs/cells : {len(source_lines)}")
    print(f"   emitted text literals   : {literal_count}")
    print(f"   source words            : {len(source_words)}")
    print(f"   emitted words           : {len(emitted_words)}")
    print(f"   containment — nothing lost or altered : {'PASS' if not missing else 'FAIL'}")
    print(f"   order preserved                       : {'PASS' if ordered else 'FAIL'}")
    if missing:
        failures += 1
        print(f"   missing: {dict(list(missing.items())[:12])}")
    if not ordered:
        failures += 1
        it = iter(emitted_words)
        for i, w in enumerate(source_words):
            if w not in it:
                print(f"   first divergence at word {i}: {w!r}")
                print(f"   context: {' '.join(source_words[max(0, i - 10):i + 10])!r}")
                break

# ── GEO type-field proof ────────────────────────────────────────────────────
print("\n" + "=" * 78)
print("  M2-W1-G001 TYPE-FIELD PROOF")
print("=" * 78)
g_seg = SRC[SRC.index("const M2_W1_G001"):SRC.index("\n};", SRC.index("const M2_W1_G001"))]
all_source = set(texts([(1, len(RAW))]))

core = json.loads('"' + re.search(r'core_concept: "((?:[^"\\]|\\.)*)"', g_seg).group(1) + '"')
summary = json.loads('"' + re.search(r'citation_summary: "((?:[^"\\]|\\.)*)"', g_seg).group(1) + '"')
statements_src = re.search(r"key_statements: \[(.*?)\n\],", g_seg, re.S).group(1)
statements = [json.loads(v) for v in re.findall(r'"(?:[^"\\]|\\.)*"', statements_src)]

for label, value in (("core_concept", core), ("citation_summary", summary)):
    ok = value in all_source
    print(f"  {label:18} present={bool(value)}  verbatim source line={'PASS' if ok else 'FAIL'}")
    if not ok:
        failures += 1

print(f"  key_statements     is array=True  count={len(statements)}  {'PASS' if len(statements) == 7 else 'FAIL — expected 7'}")
if len(statements) != 7:
    failures += 1
for i, st in enumerate(statements, 1):
    ok = st in all_source
    if not ok:
        failures += 1
    print(f"     {i}. [{'verbatim' if ok else 'NOT VERBATIM'}] {st[:88]}")

print("\n" + ("ALL FIDELITY CHECKS PASSED" if failures == 0 else f"{failures} CHECK(S) FAILED"))
sys.exit(1 if failures else 0)

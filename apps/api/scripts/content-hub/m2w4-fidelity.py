"""
Month 2 Week 4 source-fidelity verification.

Every word of the approved public range must appear in the generated module the same number of
times and in the same order. The checker does NOT ignore mismatches: each approved structural
transformation is re-applied to the SOURCE sequence before comparison, so a transformation is
normalized rather than excused, and anything else still fails.

Approved transformations, each modelled below:
  - A001 `direct_answer` hoisted from PART 8 to blocks[0]        -> source re-sequenced the same way
  - A001 FAQ built from 7 visible questions + their own answers  -> those words legitimately repeat
  - G001 PART 29 knowledge box -> key_takeaway points            -> same lines, different container
  - G001 PART 30 table -> table headers/rows                     -> same cells
  - G001 PART 40 -> geo_statement                                -> same sentence
  - B001 line 353 split into spans for the Talk It Out link      -> same characters
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

MODULE = Path(sys.argv[1] if len(sys.argv) > 1 else "../../src/modules/content-hub/month2week4/m2w4-content.ts")
FLAGGED = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/m2w4f.txt")

SRC = MODULE.read_text(encoding="utf-8")
RAW = [l.split("|", 2) for l in FLAGGED.read_text(encoding="utf-8").split("\n")]

WORD = re.compile(r"[A-Za-z0-9']+")
# Every public string the module emits: t("…"), plus bare question/label/title/text fields.
LITERAL = re.compile(r'(?:t\(|question: |label: |title: |text: )"((?:[^"\\]|\\.)*)"')

# Mirrors the generator exactly.
SCAFFOLDING = {
    359, 638, 657, 750, 751, 785, 793, 805, 838, 849, 878, 921, 923, 932,
    1054, 1056, 1058, 1185, 1383, 1478, 1484, 1485, 1486, 1487,
}


def line(n):
    r = RAW[n - 1]
    return r[2].strip() if len(r) > 2 else ""


def is_table(n):
    return len(RAW[n - 1]) > 1 and RAW[n - 1][1] == "TBL"


def texts(ranges, *, keep_table=False):
    out = []
    for a, b in ranges:
        for n in range(a, min(b, len(RAW)) + 1):
            if n in SCAFFOLDING:
                continue
            t = line(n)
            if not t or t.startswith("PART ") or t == "Direct Answer":
                continue
            if is_table(n):
                if not keep_table or t.startswith("[TABLE"):
                    continue
                out.extend(c.strip() for c in t.lstrip("|").split("||"))
                continue
            out.append(t)
    return out


def words(strings):
    return WORD.findall(" ".join(strings).lower())


def emitted_literals(ref):
    """Every public string the module actually emits for `ref`, in emission order.

    Table HEADERS are a bare string array rather than a `t(...)` call, so they need their own
    pass — without it the checker reports the header cells as missing source text when they are
    in fact present, which is a checker defect dressed up as a fidelity failure.
    """
    start = SRC.index("const " + ref.replace("-", "_"))
    end = SRC.index("\n};", start)
    seg = SRC[start:end]
    bs = seg.index("body: {")
    be = seg.index("as ContentBody", bs)
    region = seg[bs:be]
    lits = []
    cursor = 0
    for m in re.finditer(r'headers: \[((?:\s*"(?:[^"\\]|\\.)*"\s*,?)+)\]', region):
        lits.extend(json.loads('"' + x + '"') for x in LITERAL.findall(region[cursor:m.start()]))
        lits.extend(json.loads(x) for x in re.findall(r'"(?:[^"\\]|\\.)*"', m.group(1)))
        cursor = m.end()
    lits.extend(json.loads('"' + x + '"') for x in LITERAL.findall(region[cursor:]))
    return lits, seg


def emitted(ref):
    lits, seg = emitted_literals(ref)
    return words(lits), len(lits), seg


def is_subsequence(needle, haystack):
    it = iter(haystack)
    return all(w in it for w in needle)


# ── Public ranges, identical to the generator's ──────────────────────────────
B_RANGES = [(29, 368)]
G_RANGES = [(557, 571), (573, 584), (637, 850), (851, 933), (1055, 1057)]
# 1495 is the CTA label, which the module emits AFTER the FAQ block, so it is appended after the
# FAQ echo below rather than inside this range. Modelling it here instead would report an ordering
# failure that the module does not have.
A_RANGES = [(1186, 1192), (1195, 1381), (1384, 1394), (1479, 1483), (1490, 1494)]

TITLE_SOURCE = {"M2-W4-B001": 10, "M2-W4-G001": 633, "M2-W4-A001": 1155}

failures = 0
results = []
print("=" * 78)

# A001's hoist and FAQ are re-applied to the source sequence before comparison.
A_HOIST = line(1177) + " " + line(1178)
A_Q_PARTS = [n for n in range(1194, 1382) if line(n).startswith("PART ") and "QUESTION" in line(n)]
A_QUESTIONS = [line(p + 1) for p in A_Q_PARTS]
A_ANSWERS = {}
for i, p in enumerate(A_Q_PARTS):
    end = A_Q_PARTS[i + 1] if i + 1 < len(A_Q_PARTS) else 1382
    A_ANSWERS[line(p + 1)] = [line(n) for n in range(p + 2, end) if line(n) and line(n) != "Direct Answer"]
A_FAQ_Q = [1, 2, 7, 10, 5, 24, 22]
A_FAQ_ECHO = []
for q in A_FAQ_Q:
    A_FAQ_ECHO.append(A_QUESTIONS[q - 1])
    A_FAQ_ECHO.extend(A_ANSWERS[A_QUESTIONS[q - 1]])

for ref, ranges, prefix, suffix in (
    ("M2-W4-B001", B_RANGES, [], []),
    ("M2-W4-G001", G_RANGES, [], []),
    ("M2-W4-A001", A_RANGES, [A_HOIST], A_FAQ_ECHO + [line(1495)]),
):
    src_lines = prefix + texts(ranges, keep_table=True) + suffix
    src_words = words(src_lines)
    out_words, literal_count, _seg = emitted(ref)
    missing = Counter(src_words) - Counter(out_words)
    extra = Counter(out_words) - Counter(src_words)
    ordered = is_subsequence(src_words, out_words)
    ok = not missing and not extra and ordered
    if not ok:
        failures += 1
    results.append((ref, len(src_words), len(out_words), len(src_lines), literal_count, ok))

    print(f"\n{ref}")
    print(f"   SOURCE PUBLIC PARAGRAPHS : {len(src_lines)}")
    print(f"   REPRESENTED BLOCKS       : {literal_count}")
    print(f"   SOURCE PUBLIC WORDS      : {len(src_words)}")
    print(f"   EMITTED PUBLIC WORDS     : {len(out_words)}")
    print(f"   MISSING SOURCE TEXT      : {'none' if not missing else dict(list(missing.items())[:10])}")
    print(f"   DUPLICATED / REWRITTEN   : {'none' if not extra else dict(list(extra.items())[:10])}")
    print(f"   ORDER PRESERVED          : {'PASS' if ordered else 'FAIL'}")
    if not ordered:
        it = iter(out_words)
        for i, w in enumerate(src_words):
            if w not in it:
                print(f"   first divergence at word {i}: {w!r}")
                print(f"   context: {' '.join(src_words[max(0, i - 10):i + 10])!r}")
                break

# ── Operational leakage ──────────────────────────────────────────────────────
print("\n" + "=" * 78)
print("  OPERATIONAL CONTENT LEAKAGE GUARD")
print("=" * 78)
MARKERS = [
    "Suggested copy:", "Suggested:", "Mandatory section.", "Define carefully:",
    "Do not imply a formal therapeutic process.", "This keeps reflection practical and low-pressure.",
    "This safety section is essential.", "This keeps the topic nuanced.", "Place near top:",
    "Place high on page:", "This should be easy for AI systems to retrieve.",
    "Keep these definitions concise.", "BRAND & SAFETY GUARDRAILS", "GEO STRUCTURAL RULES",
    "INTERNAL LINKING PLAN", "FINAL TAKEAWAY", "SEO METADATA", "FULL ARTICLE", "Soft section",
    "Optional CTA:", "Optional links:", "No hard sell.", "One H1 only", "Must Not",
]
# Scanned against the EMITTED public strings, not the raw file: the module's own doc comments
# legitimately name operational sections while explaining why they were excluded, and flagging
# those would be a false positive that trains the guard to be ignored.
emitted_text = "\n".join(
    s for ref in ("M2-W4-B001", "M2-W4-G001", "M2-W4-A001") for s in emitted_literals(ref)[0]
)
leaked = [m for m in MARKERS if m in emitted_text]
print(f"  markers found in the generated module: {len(leaked)}")
for m in leaked:
    print(f"    LEAK: {m}")
if leaked:
    failures += 1

# ── B001 specifics ───────────────────────────────────────────────────────────
print("\n" + "=" * 78)
print("  M2-W4-B001 — SEO BLOG STRUCTURE")
print("=" * 78)
_w, _c, b_seg = emitted("M2-W4-B001")
b_faq = b_seg.count("type: 'faq'")
b_cta = b_seg.count("type: 'cta'")
b_link = b_seg.count("value: 'product.talk_it_out'")
print(f"  faq blocks invented      : {b_faq}  {'PASS' if b_faq == 0 else 'FAIL'}")
print(f"  cta blocks invented      : {b_cta}  {'PASS' if b_cta == 0 else 'FAIL'}")
print(f"  Talk It Out inline link  : {b_link}  {'PASS' if b_link == 1 else 'FAIL'}")
full = line(353)
print(f"  line 353 wording intact  : {'PASS' if full[len('Talk It Out'):] in b_seg and 'Talk It Out' in b_seg else 'FAIL'}")
if b_faq or b_cta or b_link != 1:
    failures += 1

# ── G001 specifics ───────────────────────────────────────────────────────────
print("\n" + "=" * 78)
print("  M2-W4-G001 — GEO STRUCTURE AND TYPE FIELDS")
print("=" * 78)
_w, _c, g_seg = emitted("M2-W4-G001")
g_full = SRC[SRC.index("const M2_W4_G001"):SRC.index("\n};", SRC.index("const M2_W4_G001"))]
core = json.loads('"' + re.search(r'core_concept: "((?:[^"\\]|\\.)*)"', g_full).group(1) + '"')
summary = json.loads('"' + re.search(r'citation_summary: "((?:[^"\\]|\\.)*)"', g_full).group(1) + '"')
checks = [
    ("core_concept == line 540", core == line(540)),
    ("citation_summary == line 922", summary == line(922)),
    ("key_statements absent", re.search(r"^\s*key_statements\s*:", g_full, re.M) is None),
    ("metaDescription is null", re.search(r"^\s*metaDescription: null,", g_full, re.M) is not None),
    ("key_takeaway blocks == 1", g_seg.count("type: 'key_takeaway'") == 1),
    ("table blocks == 1", g_seg.count("type: 'table'") == 1),
    ("geo_statement blocks == 1", g_seg.count("type: 'geo_statement'") == 1),
    ("faq blocks == 1", g_seg.count("type: 'faq'") == 1),
    ("faq items == 8", len(re.findall(r"id: \"m4g-faq-\d+\"", g_seg)) == 8),
    ("reflection list == 8 items", g_seg.count('t("What part of the conversation keeps returning?")') == 1),
    ("safety_notice blocks == 0", g_seg.count("type: 'safety_notice'") == 0),
    ("PART 27 heading present", 'What Replaying a Conversation Does Not Automatically Mean' in g_seg),
    ("PART 27 'You have OCD.' preserved", 'You have OCD.' in g_seg),
    ("ambiguous 744 preserved", 'The important distinction:' in g_seg),
    ("ambiguous 809 preserved", 'Important distinction:' in g_seg),
]
for label, ok in checks:
    print(f"  {label:38} {'PASS' if ok else 'FAIL'}")
    if not ok:
        failures += 1
print(f"  core_concept     : {core}")
print(f"  citation_summary : {summary[:90]}…")

# Table cells must survive verbatim.
tbl_src = [line(n) for n in range(865, 877) if is_table(n) and not line(n).startswith("[TABLE")]
tbl_cells = [c.strip() for t in tbl_src[1:] for c in t.lstrip("|").split("||")]
missing_cells = [c for c in tbl_cells if c and f't("{c}")' not in g_seg]
print(f"  table cells verbatim ({len(tbl_cells)})          {'PASS' if not missing_cells else f'FAIL {missing_cells[:3]}'}")
if missing_cells:
    failures += 1

# ── A001 specifics ───────────────────────────────────────────────────────────
print("\n" + "=" * 78)
print("  M2-W4-A001 — AEO STRUCTURE")
print("=" * 78)
_w, _c, a_seg = emitted("M2-W4-A001")
a_full = SRC[SRC.index("const M2_W4_A001"):SRC.index("\n};", SRC.index("const M2_W4_A001"))]
da_count = a_seg.count("type: 'direct_answer'")
da_first = a_seg.index("type: 'direct_answer'") < a_seg.index("type: 'heading'")
da = json.loads('"' + re.search(r"type: 'direct_answer', content: t\(\"((?:[^\"\\\\]|\\\\.)*)\"\)", a_seg).group(1) + '"')
emitted_h2 = [json.loads('"' + m + '"') for m in
              re.findall(r"type: 'heading', level: 2, content: t\(\"((?:[^\"\\\\]|\\\\.)*)\"\)", a_seg)]
visible_q = [q for q in emitted_h2 if q in A_ANSWERS]
faq_items = [json.loads('"' + m + '"') for m in re.findall(r'id: "m4a-faq-\d+", question: "((?:[^"\\]|\\.)*)"', a_seg)]
expected_faq = [A_QUESTIONS[q - 1] for q in A_FAQ_Q]
a_checks = [
    ("direct_answer count == 1", da_count == 1),
    ("blocks[0] is direct_answer", da_first),
    ("direct_answer == PART 8 source", da == A_HOIST),
    ("visible questions == 30", len(visible_q) == 30),
    ("question order identical", visible_q == A_QUESTIONS),
    ("no duplicate questions", len(set(visible_q)) == len(visible_q)),
    ("quick answer box present", a_seg.count("type: 'key_takeaway'") == 1),
    ("quick box != direct answer", 'Quick Answer' in a_seg and da not in a_seg.split('Quick Answer')[1]),
    ("faq blocks == 1", a_seg.count("type: 'faq'") == 1),
    ("faq items == 7", len(faq_items) == 7),
    ("faq uses visible wording", faq_items == expected_faq),
    ("cta blocks == 1", a_seg.count("type: 'cta'") == 1),
    ("safety_notice blocks == 0", a_seg.count("type: 'safety_notice'") == 0),
    ("primary_question == line 1175", json.loads('"' + re.search(r'primary_question: "((?:[^"\\]|\\.)*)"', a_full).group(1) + '"') == line(1175)),
    ("snippet_answer == PART 8 source", json.loads('"' + re.search(r'snippet_answer: "((?:[^"\\]|\\.)*)"', a_full).group(1) + '"') == A_HOIST),
]
for label, ok in a_checks:
    print(f"  {label:38} {'PASS' if ok else 'FAIL'}")
    if not ok:
        failures += 1
print(f"  direct answer: {da[:100]}…")

# The hoisted answer must not be repeated as a body paragraph.
if a_seg.count(json.dumps(A_HOIST, ensure_ascii=False)) > 2:
    print("  FAIL: hoisted direct answer repeated in the body")
    failures += 1
else:
    print("  hoist not duplicated in body           PASS")

# ── Title fields ─────────────────────────────────────────────────────────────
print("\n" + "=" * 78)
print("  TITLE FIELDS (verified separately — they are fields, not body blocks)")
print("=" * 78)
for ref, src_line in TITLE_SOURCE.items():
    start = SRC.index("const " + ref.replace("-", "_"))
    title = json.loads('"' + re.search(r'title: "((?:[^"\\]|\\.)*)"', SRC[start:]).group(1) + '"')
    ok = title == line(src_line)
    if not ok:
        failures += 1
    print(f"  {ref}: {'PASS' if ok else 'FAIL'}  (source line {src_line})")
    print(f"     {title}")

print("\n" + "=" * 78)
for ref, sw, ew, sp, rb, ok in results:
    print(f"  {ref}  source={sw}w/{sp}p  emitted={ew}w/{rb}b  {'PASS' if ok else 'FAIL'}")
print("\n" + ("ALL FIDELITY CHECKS PASSED" if failures == 0 else f"{failures} CHECK(S) FAILED"))
sys.exit(1 if failures else 0)

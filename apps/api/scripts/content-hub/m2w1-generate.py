"""
Month 2 Week 1 workbook -> `m2w1-content.ts` generator.

Prose is transcribed BY MACHINE straight out of the .docx. Nothing is rewritten, shortened,
paraphrased, reordered or expanded. The only judgement encoded is STRUCTURAL, and every structural
decision was approved in the Phase 1 audit:

  * M2-W1-B001 — §8 article (bold paragraph = h2) plus the §9 FAQ, eight numbered Q/A pairs.
    "talk something through" already appears verbatim in the approved prose, so it carries an
    INLINE route link; no wording was changed to create it.

  * M2-W1-G001 — §8 intro, then Sections 1-9. Each section's field table maps onto a
    `geo_statement` block: GEO Statement -> statement (public), Example -> examples (public),
    Core Message -> coreMessage and Citation Goal -> citationGoal (both INTERNAL, stripped by the
    serializer). Only the five approved reader-facing trailing sub-blocks are imported.
    Section 10 (entity-association metadata), §3 "Important Language Rule" and §7 "Critical
    Guardrail" are writer/knowledge-model instructions and are excluded.

  * M2-W1-A001 — the 24 answer targets, with §5 "PRIMARY ANSWER TARGET" hoisted into the single
    `direct_answer` block the AEO contract requires at position 0. §29 Quick Answer Library (14
    rows) becomes the FAQ block, which is what emits FAQPage JSON-LD.

Run:
    python3 scripts/content-hub/m2w1-generate.py <workbook.docx> <output.ts>
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
DOCX = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/m2/m2.docx")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/m2/m2w1-content.ts")
FLAGGED = Path("/tmp/m2/m2f.txt")

subprocess.run([sys.executable, str(HERE / "w2-extract.py"), str(DOCX), str(FLAGGED)], check=True)
RAW = [line.split("|", 2) for line in FLAGGED.read_text(encoding="utf-8").split("\n")]


def cell_rows(start, end):
    """Table rows in a range, as lists of cell strings."""
    out = []
    for r in RAW[start - 1 : end]:
        if len(r) < 3 or r[1] != "TBL":
            continue
        text = r[2].strip()
        if text in ("[TABLE START]", "[TABLE END]") or not text:
            continue
        cells = [c.strip() for c in text.lstrip("|").split("||")]
        out.append([c.strip() for c in cells])
    return out


def rows(start, end):
    """(bold, is_list, is_table, text) for a range, blanks dropped."""
    out = []
    for r in RAW[start - 1 : end]:
        if len(r) < 3:
            continue
        text = r[2].strip()
        if not text:
            continue
        out.append((r[0][0] == "B", r[0][1] == "L", r[1] == "TBL", text))
    return out


def line(n):
    return RAW[n - 1][2].strip()


def s(text):
    return json.dumps(text, ensure_ascii=False)


class Builder:
    def __init__(self, prefix):
        self.prefix, self.blocks, self.bullets, self.n = prefix, [], [], 0

    def _id(self, kind):
        self.n += 1
        return f"{self.prefix}-{kind}{self.n}"

    def _flush(self):
        if not self.bullets:
            return
        items = ", ".join(f"t({s(i)})" for i in self.bullets)
        self.blocks.append(f"{{ id: {s(self._id('list'))}, type: 'list', style: 'bullet', items: [{items}] }}")
        self.bullets = []

    def bullet(self, text):
        self.bullets.append(text)

    def para(self, text, inline=None):
        self._flush()
        content = inline if inline else f"t({s(text)})"
        self.blocks.append(f"{{ id: {s(self._id('p'))}, type: 'paragraph', content: {content} }}")

    def heading(self, text, level=2):
        self._flush()
        self.blocks.append(f"{{ id: {s(self._id('h'))}, type: 'heading', level: {level}, content: t({s(text)}) }}")

    def raw(self, block):
        self._flush()
        self.blocks.append(block)

    def done(self):
        self._flush()
        return self.blocks


# ─── M2-W1-B001 ─────────────────────────────────────────────────────────────
B_TITLE = line(168)
ANCHOR = "talk something through"

b = Builder("m2b")
for bold, is_li, is_tbl, text in rows(169, 463):
    if is_tbl:
        continue
    if bold:
        b.heading(text, 2)
    elif is_li:
        b.bullet(text)
    elif ANCHOR in text.lower():
        # The approved wording already contains this phrase — as "Talk something through", so the
        # match is case-insensitive and the SOURCE's own casing is what gets emitted. The sentence
        # is split into spans so the middle one carries the link; not one character changes.
        at = text.lower().index(ANCHOR)
        head, phrase, tail = text[:at], text[at : at + len(ANCHOR)], text[at + len(ANCHOR) :]
        spans = []
        if head:
            spans.append(f"{{ text: {s(head)} }}")
        spans.append(f"{{ text: {s(phrase)}, link: {{ kind: 'route', value: 'product.talk_it_out' }} }}")
        if tail:
            spans.append(f"{{ text: {s(tail)} }}")
        b.para(text, inline="[" + ", ".join(spans) + "]")
    else:
        b.para(text)

# §9 FAQ — "N. Question" then its answer, eight pairs.
faq_rows = [t for _b, _l, _tbl, t in rows(465, 488)]
if len(faq_rows) % 2 != 0:
    raise SystemExit(f"B001 FAQ: expected pairs, got {len(faq_rows)} paragraphs")
faq_items = []
for i in range(0, len(faq_rows), 2):
    question = faq_rows[i]
    # Strip the workbook's list numbering ("1. ") — presentation, not wording.
    if question[:3].rstrip(". ").isdigit():
        question = question.split(". ", 1)[1]
    faq_items.append((question, faq_rows[i + 1]))

rendered = ", ".join(
    f"{{ id: {s(f'm2b-faq-{i + 1}')}, question: {s(q)}, answer: t({s(a)}) }}"
    for i, (q, a) in enumerate(faq_items)
)
b.raw(f"{{ id: 'm2b-faq', type: 'faq', heading: 'Frequently Asked Questions', items: [{rendered}] }}")
b.raw("{ id: 'm2b-cta-talk', type: 'cta', label: 'Talk It Out', "
      "target: { kind: 'route', value: 'product.talk_it_out' } }")
B_BLOCKS = b.done()

# ─── M2-W1-G001 ─────────────────────────────────────────────────────────────
G_TITLE = line(806)
G_CORE_CONCEPT = line(773)
G_CITATION_SUMMARY = line(809)
G_KEY_STATEMENTS = [line(n) for n in (1225, 1227, 1229, 1231, 1233, 1235, 1237)]

# Section title line, table range, and the approved trailing sub-block (label, first, last).
# Sections 3 and 7 have their trailing block deliberately omitted; Section 10 is excluded entirely.
G_SECTIONS = [
    (830, 831, 837, ("Citation-Friendly Explanation", 838, 841)),
    (844, 845, 851, ("Knowledge Distinction", 852, 862)),
    (865, 866, 872, None),   # §3 trailing "Important Language Rule" — writer instruction
    (880, 881, 887, None),   # §4 trailing "Canonical Language" — not in the approved five
    (893, 894, 900, ("Knowledge Position", 901, 910)),
    (913, 914, 920, None),   # §6 trailing "Important Continuity" — not in the approved five
    (925, 926, 932, None),   # §7 trailing "Critical Guardrail" — writer instruction
    (943, 944, 950, ("Knowledge Principle", 951, 956)),
    (959, 960, 965, ("Canonical Reframe", 966, 967)),
]

g = Builder("m2g")
for _bold, _li, is_tbl, text in rows(815, 828):
    if not is_tbl:
        g.para(text)

# The workbook labels the example row inconsistently across sections — "Example" (1-3),
# "Examples" (4, 5, 7, 8), "Example Opening" (6) — and section 9 has none. Mapping only the
# singular form silently dropped five sections' examples; the fidelity check caught it.
FIELD_MAP = {
    "Core Message": "coreMessage",
    "GEO Statement": "statement",
    "Example": "examples",
    "Examples": "examples",
    "Example Opening": "examples",
    "Citation Goal": "citationGoal",
}

for section_index, (title_line, tbl_start, tbl_end, trailing) in enumerate(G_SECTIONS, start=1):
    g.heading(line(title_line), 2)

    fields = {}
    for cells in cell_rows(tbl_start, tbl_end):
        if len(cells) < 2 or cells[0] == "Field":
            continue
        key = FIELD_MAP.get(cells[0])
        if key:
            fields[key] = cells[1]
    if "statement" not in fields:
        raise SystemExit(f"G001 section {section_index}: no GEO Statement row found")

    parts = [f"id: {s(f'm2g-stmt{section_index}')}", "type: 'geo_statement'",
             f"statement: t({s(fields['statement'])})"]
    if "examples" in fields:
        parts.append(f"examples: [{s(fields['examples'])}]")
    if "coreMessage" in fields:
        parts.append(f"coreMessage: {s(fields['coreMessage'])}")
    if "citationGoal" in fields:
        parts.append(f"citationGoal: {s(fields['citationGoal'])}")
    g.raw("{ " + ", ".join(parts) + " }")

    if trailing:
        label, first, last = trailing
        g.heading(label, 3)
        for _b, is_li, is_tbl2, text in rows(first + 1, last):
            if is_tbl2:
                continue
            if is_li:
                g.bullet(text)
            else:
                g.para(text)

g.raw("{ id: 'm2g-cta-talk', type: 'cta', label: 'Talk It Out', "
      "target: { kind: 'route', value: 'product.talk_it_out' } }")
G_BLOCKS = g.done()

# ─── M2-W1-A001 ─────────────────────────────────────────────────────────────
A_PUBLIC_TITLE = "Everyday Stress, Mental Load & Emotional Resilience: Direct Answers to Common Questions"
A_SEO_TITLE = line(2099)

a = Builder("m2a")
direct_answer = None
mode = None
hoisted = False

for bold, is_li, is_tbl, text in rows(1490, 1868):
    if is_tbl:
        continue
    # Section markers like "5. PRIMARY ANSWER TARGET" / "6. ANSWER TARGET 2" are scaffolding.
    if bold and ("ANSWER TARGET" in text.upper()):
        mode = None
        continue
    if text.startswith("Q: "):
        a.heading(text[3:].strip(), 2)
        mode = None
        continue
    if bold and text in ("Direct Answer", "Expanded Answer"):
        if text == "Direct Answer" and not hoisted:
            mode, hoisted = "hoist", True
            continue
        a.heading(text, 3)
        mode = None
        continue
    if bold:
        a.heading(text, 3)
        mode = None
        continue
    if mode == "hoist":
        if direct_answer is None:
            direct_answer = text
        else:
            a.para(text)
        continue
    if is_li:
        a.bullet(text)
    else:
        a.para(text)

if direct_answer is None:
    raise SystemExit("A001: no direct answer found")

# §29 Quick Answer Library -> the FAQ block (this is what emits FAQPage JSON-LD).
quick = [c for c in cell_rows(1884, 1904) if len(c) >= 2 and c[0] != "Question"]
rendered = ", ".join(
    f"{{ id: {s(f'm2a-faq-{i + 1}')}, question: {s(q)}, answer: t({s(ans)}) }}"
    for i, (q, ans) in enumerate((c[0], c[1]) for c in quick)
)
a.raw(f"{{ id: 'm2a-faq', type: 'faq', heading: 'Quick Answers', items: [{rendered}] }}")
a.raw("{ id: 'm2a-cta-talk', type: 'cta', label: 'Talk It Out', "
      "target: { kind: 'route', value: 'product.talk_it_out' } }")

A_BLOCKS = [f"{{ id: 'm2a-direct-answer', type: 'direct_answer', content: t({s(direct_answer)}) }}"] + a.done()

# ─────────────────────────────────────────────────────────────────────────────

HEADER = '''/**
 * Month 2 Week 1 workbook -> Content Hub mapping.
 *
 * SOURCE: `Month 2 Week 1 Operational WorkBook (1).docx`.
 * Authority theme: Stress Before It Becomes Overwhelm.
 *
 * ============================================================================
 * EVERY STRING OF PROSE BELOW IS THE WORKBOOK'S OWN WORDING.
 * ============================================================================
 *
 * Transcribed mechanically by `scripts/content-hub/m2w1-generate.py`. No sentence was rewritten,
 * shortened, paraphrased, reordered or expanded. Regenerating from the same workbook reproduces
 * this file byte for byte.
 *
 * PUBLIC vs OPERATIONAL. The workbook is 3,622 paragraphs, most of it campaign strategy, KPIs,
 * image prompts, governance and handoff material. Only these ranges are reader-facing and only
 * these were imported: B001 §8 article and §9 FAQ; G001 §8 intro and Sections 1-9; A001 §5-28
 * answer targets and §29 Quick Answer Library.
 *
 * DELIBERATELY EXCLUDED FROM THE PUBLIC BODY (approved in the Phase 1 audit):
 *   - G001 §3 "Important Language Rule" and §7 "Critical Guardrail" — instructions to writers
 *     ("Do not interpret normal functioning as masking", "Do not claim small pauses treat
 *     anxiety"), not reader-facing copy.
 *   - G001 Section 10 — entity-association metadata for AI retrieval, not article prose.
 *   - G001 §4 "Canonical Language" and §6 "Important Continuity" trailing blocks, which fall
 *     outside the five approved reader-facing sub-blocks.
 *   - Every §1-7 / §10-45 strategy, KPI, monitoring, guardrail and handoff section.
 *
 * DELIBERATELY ABSENT:
 *   - `safety_notice` on all three. The workbook contains no reader-facing safety copy: A001 §40
 *     "Content Safety Guardrails" is an approved-vocabulary list for writers and G001 §35 is
 *     AI-retrieval positioning. Safety copy is never invented.
 *   - G001 `meta_description`. Its §6 sentence is 172 characters, over the 160-character limit,
 *     and is not truncated or rewritten. It is used verbatim as `citation_summary`, where no
 *     length limit applies.
 *   - Links to Journal, Mood, Habits, Sleep and Progress. Those exist only behind authentication
 *     at `/app/*`; `ROUTE_REGISTRY` excludes authenticated destinations. Their anchor phrases stay
 *     in the prose, unlinked.
 *   - The A001 §38 SEO title. The Content Hub schema has no SEO-title field distinct from
 *     `title`, so it is recorded here and in the report rather than stored.
 */

import type { Week1Asset, Week1LinkSpec } from '../week1/week1-content';
import type { ContentBody, InlineContent } from '@meetezri/shared';

/** A span of plain text. */
const t = (text: string): InlineContent => [{ text }];

/** Month 2 reuses the Week 1 asset and link contracts EXACTLY. */
export type M2W1LinkSpec = Week1LinkSpec;
export type M2W1Asset = Week1Asset;
'''


def asset(ref, ctype, label, title, slug, meta, type_fields, editorial, blocks, links, authored, missing):
    body = ",\n      ".join(blocks)
    return f'''
// ─────────────────────────────────────────────────────────────────────────────
// {ref}
// ─────────────────────────────────────────────────────────────────────────────

const {ref.replace("-", "_")}: M2W1Asset = {{
  editorialRef: {s(ref)},
  contentType: '{ctype}',
  publicLabel: '{label}',
  title: {s(title)},
  slug: {s(slug)},
  metaDescription: {meta},
  week: 1,
  pillar: 'Stress Before It Becomes Overwhelm',
  tags: ['everyday-stress', 'mental-load', 'emotional-wellbeing', 'month-2', 'week-1'],

  typeFields: {type_fields},

  // Internal only. Never serialised to a public response.
  editorial: {editorial},

  body: {{
    version: 1,
    blocks: [
      {body},
    ],
  }} as ContentBody,

  links: [
    {links}
  ],

  authoredOutsideWorkbook: {authored},
  missingFields: {missing},
}};
'''


B_TYPE_FIELDS = """{
    keywords: {
      primary: 'how to manage everyday stress',
      secondary: [
        'everyday stress',
        'managing daily stress',
        'feeling overwhelmed',
        'mental load',
        'daily stress management',
        'emotional wellbeing',
        'emotional resilience',
        'healthy routines',
        'stress and routines',
        'self-reflection',
        'managing a busy mind',
      ],
    },
    funnel_stage: 'Awareness',
  }"""

B_EDITORIAL = """{
    purpose: 'Everyday Emotional Wellbeing',
    strategy: 'Link naturally to relevant SOLACE experiences rather than forcing product promotion.',
    goal: 'Organic search authority for everyday stress and mental load.',
  }"""

G_TYPE_FIELDS = f"""{{
    core_concept: {s(G_CORE_CONCEPT)},
    citation_summary: {s(G_CITATION_SUMMARY)},
    key_statements: {json.dumps(G_KEY_STATEMENTS, ensure_ascii=False, indent=6)},
    topics: {{
      primary: 'Everyday Stress',
      secondary: ['Mental Load', 'Emotional Resilience'],
    }},
  }}"""

G_EDITORIAL = """{
    purpose: 'AI Search Authority',
    strategy: 'Knowledge resource: canonical definitions, GEO statements and citation-friendly explanations.',
    goal: 'AI Search Authority',
    geo_focus: 'AI Retrieval',
  }"""

A_TYPE_FIELDS = f"""{{
    primary_question: 'Why do I feel overwhelmed when nothing is wrong?',
    supporting_queries: [
      'What is everyday stress?',
      'What is mental load?',
      'Why does my mind feel busy?',
      'How can I manage everyday stress?',
      'What is emotional resilience?',
    ],
    snippet_answer: {s(direct_answer)},
  }}"""

A_EDITORIAL = f"""{{
    purpose: 'Answer Engine Authority',
    strategy: 'Question, direct answer, expanded answer, across 24 answer targets plus a quick answer library.',
    goal: 'Answer Engine Authority',
    aeo_signal: 'direct answer first',
    // The workbook's §38 SEO title. The schema has no SEO-title field separate from `title`, so it
    // is recorded here for the editor rather than silently dropped.
    seo_title_note: {s(A_SEO_TITLE)},
  }}"""

LINKS_B = """{ targetKind: 'content', targetRef: 'M2-W1-G001', anchorText: null, relation: 'related_content' },
    { targetKind: 'content', targetRef: 'M2-W1-A001', anchorText: null, relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'talk something through', relation: 'product' },"""

LINKS_G = """{ targetKind: 'content', targetRef: 'M2-W1-B001', anchorText: null, relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' },"""

LINKS_A = """{ targetKind: 'content', targetRef: 'M2-W1-B001', anchorText: null, relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' },"""

UNLINKED = ("'workbook link targets left UNLINKED (no public route): Journal, Mood, Habits, "
            "Sleep, Progress'")

parts = [HEADER]

parts.append(asset(
    "M2-W1-B001", "seo_blog", "Article", B_TITLE, "manage-everyday-stress-before-overwhelm",
    s(line(495)), B_TYPE_FIELDS, B_EDITORIAL, B_BLOCKS, LINKS_B,
    "['inline route link on the phrase \"talk something through\", which already appears verbatim in the approved prose', "
    "'cta block (destination from the workbook Internal Linking Plan)']",
    f"['safety_notice (workbook supplies none)', {UNLINKED}]",
))

parts.append(asset(
    "M2-W1-G001", "geo_article", "Insight", G_TITLE, "everyday-stress-mental-load-emotional-resilience",
    "null", G_TYPE_FIELDS, G_EDITORIAL, G_BLOCKS, LINKS_G,
    "['cta block (destination from the workbook Internal Linking Strategy)']",
    "['safety_notice (workbook supplies none)', "
    "'meta_description (the workbook sentence is 172 chars, over the 160 limit; left null rather than truncated)', "
    f"{UNLINKED}]",
))

parts.append(asset(
    "M2-W1-A001", "aeo_answer", "Answer", A_PUBLIC_TITLE, "everyday-stress-mental-load",
    s(line(2101)), A_TYPE_FIELDS, A_EDITORIAL, A_BLOCKS, LINKS_A,
    "['public title supplied and approved separately; the workbook §38 SEO title is kept in editorial metadata', "
    "'slug normalised from the workbook /answers/ path', "
    "'cta block (destination from the workbook Internal Linking Plan)']",
    f"['safety_notice (workbook supplies none)', {UNLINKED}, "
    "'seo_title (no schema field distinct from title)']",
))

parts.append("""
/** The three Month 2 Week 1 assets, in workbook order. */
export const M2W1_ASSETS: M2W1Asset[] = [M2_W1_B001, M2_W1_G001, M2_W1_A001];

/**
 * Content-to-content edges the workbook states EXPLICITLY (B001 §11 "Cluster Links").
 *
 * Nothing is inferred from topical similarity: these four are exactly the edges the workbook
 * names. They resolve publicly once the cluster publishes together.
 */
export const EXPECTED_CONTENT_EDGES: Array<[string, string]> = [
  ['M2-W1-B001', 'M2-W1-G001'],
  ['M2-W1-B001', 'M2-W1-A001'],
  ['M2-W1-G001', 'M2-W1-B001'],
  ['M2-W1-A001', 'M2-W1-B001'],
];
""")

OUT.write_text("".join(parts), encoding="utf-8")

print(f"wrote {OUT}")
print(f"  M2-W1-B001 blocks={len(B_BLOCKS)} faq={len(faq_items)}")
print(f"  M2-W1-G001 blocks={len(G_BLOCKS)} geo_statements=9 key_statements={len(G_KEY_STATEMENTS)}")
print(f"  M2-W1-A001 blocks={len(A_BLOCKS)} faq={len(quick)} direct_answer=1")
for name, n in (("B001", len(B_BLOCKS)), ("G001", len(G_BLOCKS)), ("A001", len(A_BLOCKS))):
    print(f"    {name}: {n} blocks — {'OK' if n <= 500 else 'EXCEEDS 500'}")

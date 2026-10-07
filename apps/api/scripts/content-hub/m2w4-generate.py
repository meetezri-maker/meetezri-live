"""
Month 2 Week 4 workbook -> `month2week4/m2w4-content.ts`.

Mechanical transcription. Every public string in the generated module is a workbook line, copied
verbatim; nothing is paraphrased, summarised or invented.

STRUCTURE IS CHOSEN BY LINE NUMBER, NOT BY HEURISTIC. Headings, scaffolding and structured blocks
are listed explicitly and every entry is asserted against its expected source text, so a workbook
edit that shifts the document aborts the generator instead of silently emitting the wrong copy.

Usage:
    python3 m2w4-extract.py "<workbook>.docx" /tmp/m2w4f.txt
    python3 m2w4-generate.py /tmp/m2w4f.txt ../../src/modules/content-hub/month2week4/m2w4-content.ts
"""

import json
import sys
from pathlib import Path

FLAGGED = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/m2w4f.txt")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "../../src/modules/content-hub/month2week4/m2w4-content.ts")

RAW = [l.split("|", 2) for l in FLAGGED.read_text(encoding="utf-8").split("\n")]


def line(n: int) -> str:
    r = RAW[n - 1]
    return r[2].strip() if len(r) > 2 else ""


def is_list(n: int) -> bool:
    return len(RAW[n - 1]) > 0 and RAW[n - 1][0][1:2] == "L"


def is_table(n: int) -> bool:
    return len(RAW[n - 1]) > 1 and RAW[n - 1][1] == "TBL"


def s(text: str) -> str:
    """A TypeScript double-quoted literal. JSON escaping is a strict subset of TS escaping."""
    return json.dumps(text, ensure_ascii=False)


def assert_lines(expectations: dict, what: str) -> None:
    for n, expected in expectations.items():
        if line(n) != expected:
            raise SystemExit(f"{what}: line {n} is {line(n)!r}, expected {expected!r}")


# ─────────────────────────────────────────────────────────────────────────────
# SCAFFOLDING — writer instructions that sit inside otherwise public ranges.
# Each is asserted, so the exclusion can never drift onto a line of real copy.
# ─────────────────────────────────────────────────────────────────────────────

SCAFFOLDING = {
    # B001
    359: "FINAL TAKEAWAY",
    # G001 — the thirteen lines the Phase 1 audit identified
    638: "Suggested copy:",
    657: "Suggested copy:",
    750: "Mandatory section.",
    751: "Suggested copy:",
    785: "Define carefully:",
    793: "Do not imply a formal therapeutic process.",
    805: "This keeps reflection practical and low-pressure.",
    838: "This safety section is essential.",
    849: "This keeps the topic nuanced.",
    878: "Use:",
    921: "Place near top:",
    923: "This should be easy for AI systems to retrieve.",
    932: "Keep these definitions concise.",
    # G001 PART 52
    1054: "Soft section:",
    1056: "Optional CTA:",
    1058: "No hard sell.",
    # A001
    1185: "Suggested:",
    1383: "Place high on page:",
    1478: "Soft section only:",
    1484: "Optional links:",
    1485: "Talk It Out.",
    1486: "Journal.",
    1487: "Related resources.",
}
assert_lines(SCAFFOLDING, "scaffolding drift")

# PRESERVED BY DECISION. Both read as reader-facing connective prose introducing the distinction
# that immediately follows, in the reader's voice — not as writer instructions. Asserted so the
# decision is visible and cannot silently change.
assert_lines(
    {744: "The important distinction:", 809: "Important distinction:"},
    "ambiguous-line drift",
)

EXCLUDED = set(SCAFFOLDING)

blocks_out = {}


class Builder:
    def __init__(self, prefix: str):
        self.prefix = prefix
        self.items: list[str] = []
        self.n = 0

    def raw(self, literal: str) -> None:
        self.items.append(literal)

    def para(self, text: str) -> None:
        self.n += 1
        self.raw(f"{{ id: {s(f'{self.prefix}-p{self.n}')}, type: 'paragraph', content: t({s(text)}) }}")

    def heading(self, text: str, level: int = 2) -> None:
        self.n += 1
        self.raw(
            f"{{ id: {s(f'{self.prefix}-h{self.n}')}, type: 'heading', level: {level}, content: t({s(text)}) }}"
        )

    def listing(self, texts: list[str], style: str = "bullet") -> None:
        self.n += 1
        rendered = ", ".join(f"t({s(x)})" for x in texts)
        self.raw(f"{{ id: {s(f'{self.prefix}-l{self.n}')}, type: 'list', style: '{style}', items: [{rendered}] }}")

    def emit_range(self, a: int, b: int, headings: dict) -> None:
        """Every public line in [a, b], in source order, as the structure the source dictates."""
        pending: list[str] = []

        def flush():
            if pending:
                self.listing(list(pending))
                pending.clear()

        for n in range(a, b + 1):
            t_ = line(n)
            if not t_ or n in EXCLUDED or t_.startswith("PART ") or t_ == "Direct Answer":
                continue
            if is_table(n):
                continue
            if is_list(n):
                pending.append(t_)
                continue
            flush()
            if n in headings:
                self.heading(t_, headings[n])
            else:
                self.para(t_)
        flush()


# ─────────────────────────────────────────────────────────────────────────────
# M2-W4-B001 — SEO Authority Blog. Public body = lines 29-368.
# ─────────────────────────────────────────────────────────────────────────────

B_H2 = [43, 58, 77, 102, 118, 139, 155, 177, 195, 213, 229, 250, 293, 314, 327, 343]
B_H3 = [253, 258, 266, 277, 284]
assert_lines(
    {
        43: "Why Do Conversations Replay in Our Minds?",
        58: "1. Something About the Conversation May Feel Unfinished",
        213: "9. Sometimes We Replay Conversations Before They Even Happen",
        343: "The SOLACE Perspective",
        253: "What actually happened?",
        284: "Do I want to give the thought somewhere to go?",
    },
    "B001 heading drift",
)
B_HEADINGS = {n: 2 for n in B_H2} | {n: 3 for n in B_H3}

# The one line whose own wording supports a visible link. The prose is NOT rewritten: the sentence
# is split into spans so "Talk It Out" carries the registry route and every character is preserved.
TALK_IT_OUT_LINE = 353
assert_lines(
    {
        TALK_IT_OUT_LINE: "Talk It Out by SOLACE is designed to give you somewhere to begin with "
        "your own words—without needing to have everything perfectly organized first."
    },
    "B001 Talk It Out drift",
)

b = Builder("m4b")
b.emit_range(29, 352, B_HEADINGS)
# L353, spans rather than a plain paragraph. Same characters, same order.
_anchor = "Talk It Out"
_rest = line(TALK_IT_OUT_LINE)[len(_anchor):]
b.n += 1
b.raw(
    f"{{ id: {s('m4b-p-talkitout')}, type: 'paragraph', content: ["
    f"{{ text: {s(_anchor)}, link: {{ kind: 'route', value: 'product.talk_it_out' }} }}, "
    f"{{ text: {s(_rest)} }}] }}"
)
b.emit_range(354, 368, B_HEADINGS)
B_BLOCKS = b.items

# ─────────────────────────────────────────────────────────────────────────────
# M2-W4-G001 — GEO Authority Resource.
# ─────────────────────────────────────────────────────────────────────────────

G_H2 = {}
# PART 8/9 definition blocks sit before the H1 in the workbook; their question lines are the
# section headings.
assert_lines(
    {557: "What is everyday reflection?", 573: "What does it mean to replay a conversation?"},
    "G001 definition drift",
)
G_H2[557] = 2
G_H2[573] = 2

# PART 14-28: the line after each PART label is that section's H2.
G_SECTION_PARTS = [636, 655, 670, 683, 694, 705, 719, 732, 748, 766, 783, 795, 807, 821, 840]
for p in G_SECTION_PARTS:
    if not line(p).startswith("PART ") or "— H2" not in line(p):
        raise SystemExit(f"G001 section drift: line {p} is {line(p)!r}")
    G_H2[p + 1] = 2
assert_lines(
    {
        637: "What Is Everyday Reflection?",
        822: "What Replaying a Conversation Does Not Automatically Mean",
        841: "Why the Same Conversation Can Affect People Differently",
    },
    "G001 H2 drift",
)

g = Builder("m4g")
g.emit_range(557, 571, G_H2)   # PART 8
g.emit_range(573, 584, G_H2)   # PART 9
g.emit_range(637, 850, G_H2)   # PART 14-28, including the PART 27 reassurance section

# PART 29 — Knowledge Summary Box -> key_takeaway. Every source line becomes a point, in order.
assert_lines({851: "PART 29 — KNOWLEDGE SUMMARY BOX", 852: "Key Takeaway"}, "G001 PART 29 drift")
G_TAKEAWAY = [line(n) for n in range(853, 863) if line(n)]
g.raw(
    f"{{ id: 'm4g-takeaway', type: 'key_takeaway', title: {s(line(852))}, points: ["
    + ", ".join(f"t({s(x)})" for x in G_TAKEAWAY)
    + "] }"
)

# PART 30 — Everyday Examples Table -> table. Header row + 8 data rows, verbatim.
assert_lines({864: "PART 30 — EVERYDAY EXAMPLES TABLE"}, "G001 PART 30 drift")
TABLE_ROWS = []
for n in range(865, 877):
    if not is_table(n):
        continue
    t_ = line(n)
    if t_.startswith("[TABLE"):
        continue
    TABLE_ROWS.append([c.strip() for c in t_.lstrip("|").split("||")])
G_HEADERS, *G_BODY_ROWS = TABLE_ROWS
if G_HEADERS != ["Situation", "What May Stay With You"] or len(G_BODY_ROWS) != 8:
    raise SystemExit(f"G001 table drift: headers={G_HEADERS} rows={len(G_BODY_ROWS)}")
g.raw(
    "{ id: 'm4g-table', type: 'table', headers: ["
    + ", ".join(s(h) for h in G_HEADERS)
    + "], rows: ["
    + ", ".join("[" + ", ".join(f"t({s(c)})" for c in row) + "]" for row in G_BODY_ROWS)
    + "] }"
)

# PART 31 — Reflection Questions -> heading + list (the source flags these as list items).
assert_lines({877: "PART 31 — REFLECTION QUESTIONS"}, "G001 PART 31 drift")
G_QUESTIONS = [line(n) for n in range(879, 887) if line(n)]
if len(G_QUESTIONS) != 8:
    raise SystemExit(f"G001 reflection questions: expected 8, got {len(G_QUESTIONS)}")
g.listing(G_QUESTIONS)

# PART 32-39 -> ONE faq block, 8 items, verbatim.
G_FAQ_PARTS = [888, 892, 896, 900, 904, 908, 912, 916]
for p in G_FAQ_PARTS:
    if "FAQ" not in line(p):
        raise SystemExit(f"G001 FAQ drift: line {p} is {line(p)!r}")
G_FAQ = [(line(p + 1), line(p + 2)) for p in G_FAQ_PARTS]
g.raw(
    "{ id: 'm4g-faq', type: 'faq', heading: 'Frequently Asked Questions', items: ["
    + ", ".join(
        f"{{ id: {s(f'm4g-faq-{i + 1}')}, question: {s(q)}, answer: t({s(a)}) }}"
        for i, (q, a) in enumerate(G_FAQ)
    )
    + "] }"
)

# PART 40 — GEO Direct Answer Block -> one geo_statement, verbatim.
assert_lines({920: "PART 40 — GEO DIRECT ANSWER BLOCK"}, "G001 PART 40 drift")
G_STATEMENT = line(922)
g.raw(f"{{ id: 'm4g-statement', type: 'geo_statement', statement: t({s(G_STATEMENT)}) }}")

# PART 41 — Featured Definitions -> term heading + definition paragraph, three pairs. No
# geo_statement here: the source is a glossary, and forcing the GEO block would add structure the
# workbook does not state.
assert_lines({925: "PART 41 — FEATURED DEFINITIONS"}, "G001 PART 41 drift")
for term_n in (926, 928, 930):
    g.heading(line(term_n), 3)
    g.para(line(term_n + 1))

# PART 52 — Product Connection -> paragraph + CTA.
assert_lines({1053: "PART 52 — PRODUCT CONNECTION"}, "G001 PART 52 drift")
g.para(line(1055))
g.raw(
    f"{{ id: 'm4g-cta', type: 'cta', label: {s(line(1057))}, "
    "target: { kind: 'route', value: 'resource_library' } }"
)
G_BLOCKS = g.items

# ─────────────────────────────────────────────────────────────────────────────
# M2-W4-A001 — AEO / FAQ Authority Resource.
# ─────────────────────────────────────────────────────────────────────────────

assert_lines(
    {1174: "PART 8 — PRIMARY TARGET QUESTION", 1175: "Why do I replay conversations in my head?"},
    "A001 PART 8 drift",
)
A_QUESTION = line(1175)
A_DIRECT_ANSWER = line(1177) + " " + line(1178)

a = Builder("m4a")
# blocks[0] — the required direct answer, hoisted from PART 8 and emitted exactly once.
a.raw(f"{{ id: 'm4a-direct', type: 'direct_answer', content: t({s(A_DIRECT_ANSWER)}) }}")
a.emit_range(1186, 1192, {})   # PART 10 page opening

# PART 11-40 — thirty questions, each an H2 followed by its own answer paragraphs.
A_Q_PARTS = [n for n in range(1194, 1382) if line(n).startswith("PART ") and "QUESTION" in line(n)]
if len(A_Q_PARTS) != 30:
    raise SystemExit(f"A001 expected 30 question parts, found {len(A_Q_PARTS)}")
A_QUESTIONS: list[str] = []
A_ANSWERS: dict[str, list[str]] = {}
for i, p in enumerate(A_Q_PARTS):
    end = A_Q_PARTS[i + 1] if i + 1 < len(A_Q_PARTS) else 1382
    q = line(p + 1)
    A_QUESTIONS.append(q)
    a.heading(q, 2)
    answers = [line(n) for n in range(p + 2, end) if line(n) and line(n) != "Direct Answer"]
    A_ANSWERS[q] = answers
    for ans in answers:
        a.para(ans)

# PART 41 — Quick Answer Box -> key_takeaway. NOT the direct answer; a separate reader-facing box.
assert_lines({1382: "PART 41 — QUICK ANSWER BOX", 1384: "Quick Answer"}, "A001 PART 41 drift")
A_QUICK = [line(n) for n in range(1385, 1395) if line(n)]
a.raw(
    f"{{ id: 'm4a-quick', type: 'key_takeaway', title: {s(line(1384))}, points: ["
    + ", ".join(f"t({s(x)})" for x in A_QUICK)
    + "] }"
)

# PART 48 — Product Connection, PART 49 — Optional CTA.
assert_lines(
    {1477: "PART 48 — PRODUCT CONNECTION", 1479: "A Place for Everyday Conversations", 1489: "PART 49 — OPTIONAL CTA"},
    "A001 PART 48/49 drift",
)
a.heading(line(1479), 2)
for n in range(1480, 1484):
    if line(n):
        a.para(line(n))
for n in range(1490, 1495):
    if line(n):
        a.para(line(n))

# PART 43 — Featured Answer Targets mapped onto the VISIBLE questions. The operational wording is
# never published; each FAQ item uses the visible question and its own source answer.
A_FAQ_MAP = [
    ("Why do I replay conversations in my head?", 1),
    ("Why do I keep thinking about what I said?", 2),
    ("Why do work conversations stay on my mind?", 7),
    ("Why do I replay text messages?", 10),
    ("Why do I think about conversations before they happen?", 5),
    ("Can positive conversations replay too?", 24),
    ("Does replaying mean I did something wrong?", 22),
]
A_TARGETS = [line(n) for n in range(1413, 1420)]
if [t for t, _ in A_FAQ_MAP] != A_TARGETS:
    raise SystemExit(f"A001 featured-target drift:\n  source={A_TARGETS}\n  mapped={[t for t, _ in A_FAQ_MAP]}")
A_FAQ_ITEMS = [(A_QUESTIONS[q - 1], " ".join(A_ANSWERS[A_QUESTIONS[q - 1]])) for _, q in A_FAQ_MAP]
a.raw(
    "{ id: 'm4a-faq', type: 'faq', heading: 'Frequently Asked Questions', items: ["
    + ", ".join(
        f"{{ id: {s(f'm4a-faq-{i + 1}')}, question: {s(q)}, answer: t({s(ans)}) }}"
        for i, (q, ans) in enumerate(A_FAQ_ITEMS)
    )
    + "] }"
)
assert_lines({1495: "Explore more everyday reflection resources from SOLACE."}, "A001 CTA drift")
a.raw(
    f"{{ id: 'm4a-cta', type: 'cta', label: {s(line(1495))}, "
    "target: { kind: 'route', value: 'resource_library' } }"
)
A_BLOCKS = a.items

# ─────────────────────────────────────────────────────────────────────────────
# Module
# ─────────────────────────────────────────────────────────────────────────────

TAGS = "['replaying-conversations', 'everyday-reflection', 'communication', 'month-2', 'week-4']"


def body(blocks: list[str]) -> str:
    inner = ",\n      ".join(blocks)
    return "{\n    version: 1,\n    blocks: [\n      " + inner + ",\n    ],\n  } as ContentBody"


HEADER = '''/**
 * Month 2 Week 4 workbook -> Content Hub mapping.
 *
 * SOURCE: `Month 2 Week 4 Operational Workbookqqq.docx`. Weekly theme "Tell Me Yours" — replaying
 * conversations, everyday reflection and communication.
 *
 * ============================================================================
 * EVERY STRING OF PROSE BELOW IS THE WORKBOOK\\'S OWN WORDING.
 * ============================================================================
 *
 * Transcribed mechanically by `scripts/content-hub/m2w4-generate.py`. Regenerating from the same
 * workbook reproduces this file byte for byte.
 *
 * EDITORIAL REFS. These are `M2-W4-*`. The bare `W4-*` refs belong to published Month 1 Week 4
 * content ("small daily habits vs motivation") and are untouched by this module.
 *
 * SCAFFOLDING. Writer instructions that sit inside otherwise public ranges ("Suggested copy:",
 * "Mandatory section.", "Do not imply a formal therapeutic process.", "This safety section is
 * essential.", "Place near top:", …) are excluded BY LINE NUMBER and each exclusion is asserted
 * against its expected text. Two borderline lines — "The important distinction:" (744) and
 * "Important distinction:" (809) — are PRESERVED: both introduce, in the reader\\'s own voice, the
 * distinction stated immediately after them.
 *
 * G001 PART 27 stays ordinary body content. "What Replaying a Conversation Does Not Automatically
 * Mean" is topical reassurance written for the reader, not a crisis or disclaimer notice, and the
 * `safety_notice` block is used across published content for crisis/disclaimer copy only.
 *
 * DELIBERATELY ABSENT:
 *   - `safety_notice` on all three. The workbook supplies no approved crisis/disclaimer copy, and
 *     its BRAND & SAFETY GUARDRAILS sections are Must/Must-Not instructions for writers. No empty
 *     placeholder is manufactured to clear the publish check.
 *   - G001 `meta_description`. The workbook value is 172 characters, over the 160 limit. Left null
 *     rather than truncated or rewritten; the original is preserved in editorial notes.
 *   - G001 `key_statements`. The workbook has no Key Statements section anywhere — the single
 *     "Key Statement" in the document belongs to B001, which is an seo_blog and requires none.
 *   - Links to Journal and Mood/Progress/Sleep/Habits, which have no registered public route, and
 *     to M2-W4-L001, which has no Content Hub record.
 */

import type { Week1Asset, Week1LinkSpec } from '../week1/week1-content';
import type { ContentBody, InlineContent } from '@meetezri/shared';

/** A span of plain text. */
const t = (text: string): InlineContent => [{ text }];

/** Month 2 Week 4 reuses the Week 1 asset and link contracts EXACTLY. */
export type M2W4LinkSpec = Week1LinkSpec;
export type M2W4Asset = Week1Asset;
'''

MODULE = f'''{HEADER}
// ─────────────────────────────────────────────────────────────────────────────
// M2-W4-B001
// ─────────────────────────────────────────────────────────────────────────────

const M2_W4_B001: M2W4Asset = {{
  editorialRef: "M2-W4-B001",
  contentType: 'seo_blog',
  publicLabel: 'Article',
  title: {s(line(10))},
  slug: "why-do-i-keep-replaying-conversations-in-my-head",
  metaDescription: {s(line(21))},
  week: 4,
  pillar: 'Everyday Wellbeing, Reflection, Communication and Self-Awareness',
  tags: {TAGS},

  typeFields: {{
    keywords: {{ primary: {s(line(14))} }},
    funnel_stage: 'Search Discovery',
  }},

  // Internal only. Never serialised to a public response.
  editorial: {{
    purpose: 'SEO Authority Blog — organic search discovery and search depth.',
    goal: 'Organic Search Traffic',
    search_intent: {s(line(18))},
    search_intent_note: {s(line(19))},
    // The schema has no field distinct from `title`, so the approved SEO title is recorded here
    // rather than dropped.
    seo_title_note: {s(line(8))},
    article_excerpt: {s(line(23))},
    key_statement: {s(line(25))},
    supporting_search_phrases: {s(line(16))},
  }},

  body: {body(B_BLOCKS)},

  links: [
    {{ targetKind: 'content', targetRef: 'M2-W4-G001', anchorText: 'everyday reflection and why conversations stay with us', relation: 'related_content' }},
    {{ targetKind: 'content', targetRef: 'M2-W4-A001', anchorText: 'common questions about replaying conversations', relation: 'related_content' }},
  ],

  authoredOutsideWorkbook: ['inline link on the workbook\\'s own "Talk It Out" wording (line 353) to the registered product.talk_it_out route; the sentence itself is unchanged'],
  missingFields: [
    'safety_notice (the workbook supplies no reader-facing crisis or disclaimer copy)',
    'cta (B001 is the one asset whose workbook section supplies no CTA label; none invented)',
    'faq (the workbook keeps FAQ authority on A001: "FAQ content should remain primarily on M2-W4-A001")',
    'seo_title (no schema field distinct from title)',
    'workbook references left UNLINKED: M2-W4-L001 (no Content Hub record), Journal and Mood/Reflection destinations (no registered public route)',
  ],
}};

// ─────────────────────────────────────────────────────────────────────────────
// M2-W4-G001
// ─────────────────────────────────────────────────────────────────────────────

const M2_W4_G001: M2W4Asset = {{
  editorialRef: "M2-W4-G001",
  contentType: 'geo_article',
  publicLabel: 'Insight',
  title: {s(line(633))},
  slug: "replaying-conversations-and-everyday-reflection",
  // 172 characters in the workbook, over the 160 limit. Left null by editorial decision; the
  // original is in `editorial.geo_meta_description_over_limit` for Admin to shorten.
  metaDescription: null,
  week: 4,
  pillar: 'Everyday Wellbeing, Reflection, Communication and Self-Awareness',
  tags: {TAGS},

  typeFields: {{
    core_concept: {s(line(540))},
    citation_summary: {s(line(922))},
    topics: {{ primary: 'Everyday Reflection', secondary: ['Replaying Conversations', 'Emotional Processing'] }},
  }},

  // Internal only. Never serialised to a public response.
  editorial: {{
    purpose: 'GEO Authority Resource — structured knowledge, AI retrieval and topic depth.',
    goal: 'AI retrieval/referral visibility',
    internal_asset_title: {s(line(540))},
    meta_title_note: {s(line(551))},
    geo_meta_description_over_limit: {s(line(554))},
    alternative_slug_note: {s(line(547))},
  }},

  body: {body(G_BLOCKS)},

  links: [
    {{ targetKind: 'content', targetRef: 'M2-W4-B001', anchorText: 'why conversations keep replaying in your head', relation: 'related_content' }},
    {{ targetKind: 'content', targetRef: 'M2-W4-A001', anchorText: 'common questions about replaying conversations', relation: 'related_content' }},
    {{ targetKind: 'content', targetRef: 'M2-W3-G001', anchorText: 'anticipation and everyday mental attention', relation: 'related_content' }},
    {{ targetKind: 'route', targetRoute: 'resource_library', anchorText: {s(line(1057))}, relation: 'resource_library' }},
  ],

  authoredOutsideWorkbook: ['cta block (label and destination from the workbook PART 52 optional CTA)'],
  missingFields: [
    'safety_notice (PART 27 is reader-facing topical reassurance, not crisis or disclaimer copy; PART 53 is a writer guardrail list. Neither is a safety notice and none is manufactured)',
    'meta_description (workbook value is 172 chars, over the 160 limit; left null by editorial decision)',
    'key_statements (the workbook has no Key Statements section; none manufactured)',
    'workbook references left UNLINKED: M2-W4-L001 (no Content Hub record), Journal (no registered public route)',
  ],
}};

// ─────────────────────────────────────────────────────────────────────────────
// M2-W4-A001
// ─────────────────────────────────────────────────────────────────────────────

const M2_W4_A001: M2W4Asset = {{
  editorialRef: "M2-W4-A001",
  contentType: 'aeo_answer',
  publicLabel: 'Answer',
  title: {s(line(1155))},
  slug: "why-do-i-replay-conversations",
  metaDescription: {s(line(1169))},
  week: 4,
  pillar: 'Everyday Wellbeing, Reflection, Communication and Self-Awareness',
  tags: {TAGS},

  typeFields: {{
    primary_question: {s(A_QUESTION)},
    snippet_answer: {s(A_DIRECT_ANSWER)},
    supporting_queries: [{", ".join(s(x) for x in A_TARGETS)}],
  }},

  // Internal only. Never serialised to a public response.
  editorial: {{
    purpose: 'AEO / FAQ Authority Resource — direct answers and search/AI visibility.',
    goal: 'Direct-answer visibility across search and AI systems',
    meta_title_note: {s(line(1166))},
    geo_meta_description_note: {s(line(1172))},
    alternative_title_note: {s(line(1153))},
    alternative_slug_note: {s(line(1161))},
  }},

  body: {body(A_BLOCKS)},

  links: [
    {{ targetKind: 'content', targetRef: 'M2-W4-B001', anchorText: 'why conversations keep replaying in your head', relation: 'related_content' }},
    {{ targetKind: 'content', targetRef: 'M2-W4-G001', anchorText: 'everyday reflection and why conversations stay with us', relation: 'related_content' }},
    {{ targetKind: 'content', targetRef: 'M2-W3-A001', anchorText: 'common questions about everyday overthinking', relation: 'related_content' }},
    {{ targetKind: 'route', targetRoute: 'resource_library', anchorText: {s(line(1495))}, relation: 'resource_library' }},
  ],

  authoredOutsideWorkbook: ['cta block (label and destination from the workbook PART 49 optional CTA)'],
  missingFields: [
    'safety_notice (the workbook supplies no reader-facing crisis or disclaimer copy)',
    'seo_title (no schema field distinct from title)',
    'workbook references left UNLINKED: M2-W4-L001 (no Content Hub record), Journal (no registered public route)',
  ],
}};

/** The three Month 2 Week 4 assets, in workbook order. */
export const M2W4_ASSETS: M2W4Asset[] = [M2_W4_B001, M2_W4_G001, M2_W4_A001];

/**
 * Content-to-content edges the workbook states explicitly.
 *
 * B001\\'s INTERNAL LINKING PLAN names G001 and A001 with anchors; G001 PART 44 names "To B001",
 * "To A001" and "To M2-W3-G001"; A001 PART 45 names "To B001", "To G001" and "To Week 3 A001".
 * No edge is inferred from shared-week membership, and the L001 references in all three are
 * skipped because no Content Hub record exists for them.
 */
export const EXPECTED_CONTENT_EDGES: Array<[string, string]> = [
  ['M2-W4-B001', 'M2-W4-G001'],
  ['M2-W4-B001', 'M2-W4-A001'],
  ['M2-W4-G001', 'M2-W4-B001'],
  ['M2-W4-G001', 'M2-W4-A001'],
  ['M2-W4-G001', 'M2-W3-G001'],
  ['M2-W4-A001', 'M2-W4-B001'],
  ['M2-W4-A001', 'M2-W4-G001'],
  ['M2-W4-A001', 'M2-W3-A001'],
];
'''

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(MODULE, encoding="utf-8")

print(f"  wrote {OUT}")
print(f"  M2-W4-B001 blocks={len(B_BLOCKS)}")
print(f"  M2-W4-G001 blocks={len(G_BLOCKS)} faq={len(G_FAQ)} table_rows={len(G_BODY_ROWS)} reflection_q={len(G_QUESTIONS)} key_statements=ABSENT (intentional)")
print(f"  M2-W4-A001 blocks={len(A_BLOCKS)} questions={len(A_QUESTIONS)} faq={len(A_FAQ_ITEMS)} direct_answer=1")
for name, n in (("B001", len(B_BLOCKS)), ("G001", len(G_BLOCKS)), ("A001", len(A_BLOCKS))):
    print(f"    {name}: {n} blocks — {'OK' if n <= 500 else 'EXCEEDS 500'}")
print("\n  A001 PART 43 -> visible question mapping:")
for (target, q), (vis, _) in zip(A_FAQ_MAP, A_FAQ_ITEMS):
    print(f"    {target}\n       -> Q{q}: {vis}")

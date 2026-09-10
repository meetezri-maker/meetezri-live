"""
Week 4 workbook -> `week4-content.ts` generator.

Prose is transcribed BY MACHINE straight out of the .docx, so every sentence in the generated
module is the workbook's own wording character for character. Nothing is rewritten, shortened,
paraphrased, reordered or removed. The only judgement encoded is STRUCTURAL.

SCOPE: W4-B001 and W4-A001 only. W4-G001 is DEFERRED and deliberately not generated — its
workbook sections are a strategy brief for producing GEO content, not GEO content, so there is no
public article to import.

Run:
    python3 scripts/content-hub/w4-generate.py <workbook.docx> <output.ts>
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
DOCX = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/w4/w4.docx")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/w4/week4-content.ts")
FLAGGED = Path("/tmp/w4/w4f.txt")

subprocess.run([sys.executable, str(HERE / "w2-extract.py"), str(DOCX), str(FLAGGED)], check=True)
LINES = FLAGGED.read_text(encoding="utf-8").split("\n")


def rows(start, end):
    """1-indexed inclusive slice as (bold, is_list, text), blank paragraphs dropped."""
    out = []
    for raw in LINES[start - 1 : end]:
        parts = raw.split("|", 2)
        if len(parts) < 3:
            continue
        flags, _style, text = parts
        text = text.strip()
        if not text:
            continue
        out.append((flags[0] == "B", flags[1] == "L", text))
    return out


def s(text):
    return json.dumps(text, ensure_ascii=False)


# ─── Workbook regions (each confirmed by eye before being written down) ──────
# W4-B001: PART 2A begins at 206, its H1 sits on 207, and PART 2B is a structural marker at 364
# that the article simply continues past. The article runs to 505; PART 3 (metadata) starts at 506.
B_BODY = rows(208, 505)

# W4-A001 section 14, "PRIMARY ANSWER LIBRARY" — five answers, each Question / Direct Answer /
# Expanded Explanation / Practical Example / Action Step. Section 15 begins at 1744.
A_LIBRARY = rows(1674, 1742)

# W4-A001 section 16, "FAQ ENGINEERING" — five FAQ N / question / answer triples. Section 17
# begins at 1795.
A_FAQ = rows(1775, 1794)

SKIP_PREFIX = ("PART ", "Asset ID:")

# W4-A001's locked answer-format labels, kept as h3 headings so the approved structure survives.
# "(Featured Snippet)" is a production note on the first one and is not shown to readers.
A_LABELS = {
    "Direct Answer (Featured Snippet)": "Direct Answer",
    "Direct Answer": "Direct Answer",
    "Expanded Explanation": "Expanded Explanation",
    "Practical Example": "Practical Example",
    "Action Step": "Action Step",
}


class Builder:
    """Accumulates blocks, flushing bullet runs into one list block."""

    def __init__(self, prefix):
        self.prefix = prefix
        self.blocks = []
        self.bullets = []
        self.n = 0

    def _id(self, kind):
        self.n += 1
        return f"{self.prefix}-{kind}{self.n}"

    def _flush(self):
        if not self.bullets:
            return
        items = ", ".join(f"t({s(i)})" for i in self.bullets)
        self.blocks.append(
            f"{{ id: {s(self._id('list'))}, type: 'list', style: 'bullet', items: [{items}] }}"
        )
        self.bullets = []

    def bullet(self, text):
        self.bullets.append(text)

    def para(self, text):
        self._flush()
        self.blocks.append(f"{{ id: {s(self._id('p'))}, type: 'paragraph', content: t({s(text)}) }}")

    def heading(self, text, level=2):
        self._flush()
        self.blocks.append(
            f"{{ id: {s(self._id('h'))}, type: 'heading', level: {level}, content: t({s(text)}) }}"
        )

    def raw(self, block):
        self._flush()
        self.blocks.append(block)

    def done(self):
        self._flush()
        return self.blocks


# ─── W4-B001 ────────────────────────────────────────────────────────────────
b = Builder("b4")
for bold, is_list, text in B_BODY:
    if text.startswith(SKIP_PREFIX):
        continue
    if bold:
        b.heading(text, 2)
    elif is_list:
        b.bullet(text)
    else:
        b.para(text)

# The workbook's internal-linking plan names Talk It Out, which is the one destination with a real
# public route. Journal, Mood Tracking, Wellness Tools, Progress Dashboard, Sleep and Brain Health
# exist only behind authentication and are deliberately left unlinked.
b.raw("{ id: 'b4-cta-talk', type: 'cta', label: 'Talk It Out', "
      "target: { kind: 'route', value: 'product.talk_it_out' } }")
B_BLOCKS = b.done()

# ─── W4-A001 ────────────────────────────────────────────────────────────────
# The first answer's "Direct Answer (Featured Snippet)" is hoisted into the single `direct_answer`
# block the AEO contract requires at position 0, exactly as Week 2 did. It is NOT repeated under
# its question heading, so no visible content is duplicated.
a = Builder("a4")
direct_answer = None
pending_question = False
mode = None
first_question_done = False

for bold, is_list, text in A_LIBRARY:
    if text.startswith(SKIP_PREFIX):
        continue

    if bold and text == "Question":
        pending_question = True
        mode = None
        continue

    if pending_question and bold:
        a.heading(text, 2)
        pending_question = False
        mode = None
        continue

    if bold and text in A_LABELS:
        label = A_LABELS[text]
        # Hoist only the FIRST direct answer; the other four stay in place under their question.
        if label == "Direct Answer" and not first_question_done:
            mode = "hoist"
            first_question_done = True
            continue
        a.heading(label, 3)
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

    if is_list:
        a.bullet(text)
    else:
        a.para(text)

if direct_answer is None:
    raise SystemExit("W4-A001: no direct answer found in the answer library")


def faq_block(block_id, heading, rowset):
    """`FAQ N` / bold question / plain answer, repeated."""
    items, question, answer = [], None, []
    for bold, _is_list, text in rowset:
        if bold and text.upper().startswith("FAQ ") and text[4:].strip().isdigit():
            if question:
                items.append((question, " ".join(answer)))
            question, answer = None, []
            continue
        if bold and question is None:
            question = text
            continue
        if not bold:
            answer.append(text)
    if question:
        items.append((question, " ".join(answer)))

    rendered = ", ".join(
        f"{{ id: {s(f'{block_id}-{i + 1}')}, question: {s(q)}, answer: t({s(ans)}) }}"
        for i, (q, ans) in enumerate(items)
    )
    return f"{{ id: {s(block_id)}, type: 'faq', heading: {s(heading)}, items: [{rendered}] }}", items


A_FAQ_BLOCK, A_FAQ_ITEMS = faq_block("a4-faq", "Frequently Asked Questions", A_FAQ)
a.raw(A_FAQ_BLOCK)
a.raw("{ id: 'a4-cta-talk', type: 'cta', label: 'Talk It Out', "
      "target: { kind: 'route', value: 'product.talk_it_out' } }")

A_BLOCKS = [
    f"{{ id: 'a4-direct-answer', type: 'direct_answer', content: t({s(direct_answer)}) }}"
] + a.done()

# ─────────────────────────────────────────────────────────────────────────────

HEADER = '''/**
 * Week 4 workbook -> Content Hub mapping.
 *
 * SOURCE: `SOLACE MONTH 1 • WEEK 4 OPERATIONAL WORKBOOK.docx`.
 * Weekly theme: Small Steps Create Lasting Change.
 *
 * ============================================================================
 * EVERY STRING OF PROSE BELOW IS THE WORKBOOK'S OWN WORDING.
 * ============================================================================
 *
 * Transcribed mechanically by `scripts/content-hub/w4-generate.py`. No sentence was rewritten,
 * shortened, paraphrased, reordered or removed, and no claim or source was added. Regenerating
 * from the same workbook reproduces this file byte for byte.
 *
 * W4-G001 IS DEFERRED AND DELIBERATELY ABSENT.
 *   Its workbook sections are a strategy brief for PRODUCING GEO content — AI query mapping,
 *   semantic architecture, knowledge-graph expansion, citation strategy, governance — not GEO
 *   content itself. The passages that read like copy are explicitly worked examples for the
 *   writing team ("This pattern improves both readability and AI retrieval"). There is no public
 *   article to import, and inventing one from a brief is not something an importer should do.
 *   Public-facing GEO copy will be supplied separately.
 *
 * NO PARAGRAPH MERGING WAS NEEDED. Week 4's prose is less fragmented than Week 3's: W4-B001 maps
 * to 273 blocks and W4-A001 to well under a hundred, both far below `CONTENT_LIMITS.maxBlocks`.
 *
 * DELIBERATELY ABSENT:
 *   - `safety_notice` on both assets. The Week 4 workbook contains no crisis, disclaimer or
 *     professional-support wording anywhere, and safety copy is never invented. Both carry a
 *     publish blocker until approved copy is added editorially.
 *   - A meta description on W4-A001. The workbook defines none; it is left null rather than
 *     authored, and reported as a publish blocker.
 *   - Links to Journal, Mood Tracking, Wellness Tools, Progress Dashboard, Sleep and Brain
 *     Health. Those exist only behind authentication at `/app/*`, and `ROUTE_REGISTRY`
 *     deliberately excludes authenticated destinations. The workbook's references stay in the
 *     prose, unlinked.
 *   - W4-A001 section 15 ("Featured Snippet Optimization"). It is framed as snippet-format
 *     guidance, and its paragraph example repeats the answer already in section 14 — importing it
 *     would duplicate visible content.
 *   - The workbook canonical (`talktosolace.ai/blog/…`). Canonicals are generated by the live
 *     Content Hub from `/resources/<slug>`.
 */

import type { Week1Asset, Week1LinkSpec } from '../week1/week1-content';
import type { ContentBody, InlineContent } from '@meetezri/shared';

/** A span of plain text. The workbook contains no inline formatting. */
const t = (text: string): InlineContent => [{ text }];

/** Week 4 reuses the Week 1 asset and link contracts EXACTLY. */
export type Week4LinkSpec = Week1LinkSpec;
export type Week4Asset = Week1Asset;
'''


def asset(ref, ctype, label, title, slug, meta, type_fields, editorial, blocks, links, authored, missing):
    body = ",\n      ".join(blocks)
    return f'''
// ─────────────────────────────────────────────────────────────────────────────
// {ref}
// ─────────────────────────────────────────────────────────────────────────────

const {ref.replace("-", "_")}: Week4Asset = {{
  editorialRef: {s(ref)},
  contentType: '{ctype}',
  publicLabel: '{label}',
  title: {s(title)},
  slug: {s(slug)},
  metaDescription: {meta},
  week: 4,
  pillar: 'Small Steps Create Lasting Change',
  // 'small-steps-create-lasting-change' is 33 characters and normaliseTags truncates at 32,
  // which silently stored 'small-steps-create-lasting-chang'. Shortened to a form that survives
  // normalisation intact. Tags are internal taxonomy, derived from the pillar as in Weeks 1-3.
  tags: ['small-steps-lasting-change', 'week-4'],

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
      primary: 'small daily habits',
      secondary: [
        'consistency over motivation',
        'healthy daily habits',
        'emotional wellbeing',
      ],
    },
    word_count_target: '2,000-2,500 Words',
    funnel_stage: 'Awareness',
  }"""

B_EDITORIAL = """{
    purpose: 'Build Organic Authority + Evergreen Search Traffic',
    strategy: 'Practical, realistic guidance rather than motivational speeches, for readers who are motivated but inconsistent.',
    expected_outcome: 'Help readers understand why sustainable personal growth comes from consistent daily habits instead of relying on temporary motivation.',
    business_goal: 'Position SOLACE as a trusted authority in emotional wellbeing, habit formation and sustainable personal growth.',
    goal: 'Build Organic Authority + Evergreen Search Traffic',
    primary_kpi: 'Organic Search Traffic',
    secondary_kpi: 'Average Time on Page, Shares & Newsletter Sign-ups',
  }"""

A_TYPE_FIELDS = f"""{{
    primary_question: 'Why is consistency more important than motivation?',
    supporting_queries: [
      "Why doesn't motivation last?",
      'How do I become more consistent?',
      'What are small daily habits?',
      'How do small habits improve emotional wellbeing?',
    ],
    snippet_answer:
      {s("Consistency is more important than motivation because motivation naturally changes from day to day, while consistency encourages repeated actions regardless of how you feel.")},
  }}"""

A_EDITORIAL = """{
    purpose: 'Make SOLACE content the preferred answer for direct questions about habits, motivation and emotional wellbeing.',
    strategy: 'Answer-first: direct answer, expanded explanation, practical example, action step.',
    goal: 'Answer Engine Authority',
    target_engines: [
      'Google AI Overviews',
      'Bing Copilot',
      'ChatGPT',
      'Gemini',
      'Claude',
      'Perplexity',
      'Siri',
      'Alexa',
    ],
    business_goal: 'Position SOLACE as a trusted source of clear, concise and actionable answers that are easily retrieved by answer engines.',
    aeo_signal: 'direct answer first',
  }"""

LINKS_B = """{ targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' },"""
LINKS_A = """{ targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' },"""

UNLINKED = (
    "'workbook link targets left UNLINKED (no public route): Journal, Mood Tracking, "
    "Wellness Tools, Progress Dashboard, Sleep, Brain Health'"
)

parts = [HEADER]

parts.append(asset(
    "W4-B001", "seo_blog", "Article",
    "Why Small Daily Habits Create Bigger Life Changes Than Motivation Ever Will",
    "small-daily-habits-vs-motivation",
    s("Discover why small daily habits are more powerful than motivation alone. Learn practical ways to build consistency, strengthen emotional wellbeing and create lasting personal growth."),
    B_TYPE_FIELDS, B_EDITORIAL, B_BLOCKS, LINKS_B,
    "['cta block (destination taken from the workbook Internal Linking Plan)']",
    f"['safety_notice (workbook supplies none)', {UNLINKED}, "
    "'meta description is 182 chars, over the 160-character publish limit (preserved verbatim by instruction)']",
))

parts.append(asset(
    "W4-A001", "aeo_answer", "Answer",
    "Questions About Small Daily Habits, Motivation and Consistency",
    "questions-about-small-daily-habits-motivation-and-consistency",
    "null",
    A_TYPE_FIELDS, A_EDITORIAL, A_BLOCKS, LINKS_A,
    "['title and slug (the workbook defines neither; both approved explicitly before ingestion)', "
    "'cta block (destination taken from the workbook Internal Linking Plan)']",
    f"['safety_notice (workbook supplies none)', {UNLINKED}, "
    "'meta_description (the workbook defines none; left null by instruction)']",
))

parts.append("""
/**
 * The Week 4 assets being ingested, in workbook order.
 *
 * W4-G001 is absent on purpose — see the deferral note at the top of this file. When its public
 * GEO copy is written it joins this array; nothing else here needs to change.
 */
export const WEEK4_ASSETS: Week4Asset[] = [W4_B001, W4_A001];

/**
 * Content-to-content edges, as [source, target] pairs.
 *
 * EMPTY BY DESIGN. W4-B001's internal-linking plan names product features only, and W4-A001's
 * sections name no sibling Week 4 assets. The cluster relationship the other weeks carry runs
 * through W4-G001, which is deferred, so no content link is asserted rather than inferring one
 * from topical similarity.
 */
export const EXPECTED_CONTENT_EDGES: Array<[string, string]> = [];
""")

OUT.write_text("".join(parts), encoding="utf-8")

print(f"wrote {OUT}")
print(f"  W4-B001 blocks={len(B_BLOCKS)} faq=0 cta=1")
print(f"  W4-A001 blocks={len(A_BLOCKS)} faq={len(A_FAQ_ITEMS)} cta=1 direct_answer=1")
print("  W4-G001 DEFERRED — not generated")
for name, n in (("W4-B001", len(B_BLOCKS)), ("W4-A001", len(A_BLOCKS))):
    print(f"    {name}: {n} blocks — {'OK' if n <= 500 else 'EXCEEDS 500'}")

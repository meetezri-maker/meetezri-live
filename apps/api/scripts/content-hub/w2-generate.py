"""
Week 2 workbook -> `week2-content.ts` generator.

The prose is transcribed BY MACHINE, straight out of the .docx, so the body text in the generated
module is the workbook's own wording character for character. Nothing here rewrites, shortens or
"improves" a sentence; the only judgement encoded is STRUCTURAL — which paragraph is a heading,
which run of bullets is one list, and where the duplicated article section stops.

Run:
    python3 scripts/content-hub/w2-generate.py <workbook.docx> <output.ts>

Read-only with respect to the workbook and the database.
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
DOCX = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/w2/w2.docx")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/w2/week2-content.ts")
FLAGGED = Path("/tmp/w2/w2f.txt")

# Re-extract so the generator never runs against a stale dump.
subprocess.run([sys.executable, str(HERE / "w2-extract.py"), str(DOCX), str(FLAGGED)], check=True)
LINES = FLAGGED.read_text(encoding="utf-8").split("\n")


def rows(start, end):
    """1-indexed inclusive slice, as (bold, is_list, text)."""
    out = []
    for raw in LINES[start - 1 : end]:
        flags, _style, text = raw.split("|", 2)
        text = text.strip()
        if not text:
            continue
        out.append((flags[0] == "B", flags[1] == "L", text))
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Workbook regions. Line numbers refer to the flagged dump; every one of them was
# read and confirmed by eye before being written down here.
# ─────────────────────────────────────────────────────────────────────────────

# W2-B001. The workbook repeats the opening of the article verbatim: lines 147-276 appear again
# as 277-406. Only the FIRST copy is imported; 277-406 are dropped as the duplication.
B_PROSE = rows(148, 276) + rows(407, 649)
# 650 and 966 are the FAQ section HEADINGS ("Frequently Asked Questions (SEO)", "Related
# Questions"). They are bold, so including them would be parsed as a fifth question with no answer.
B_FAQ = rows(651, 662)

G_PROSE = rows(829, 965)
G_FAQ = rows(967, 977)

A_BODY = rows(1260, 1521)

# Bold paragraphs inside W2-B001's article that are pull-quotes, not section headings. Both are
# preceded by a line ending in a colon, and both read as quoted speech in the workbook.
B_QUOTES = {
    # The workbook wraps this one in literal quotation marks; they are part of the text.
    '"Why did this moment matter to me?"',
    "To create a space where people can talk through what they're carrying, whether it's something difficult, something exciting, or simply something that matters to them.",
}

# W2-G001 sub-headings. The workbook nests these under a parent section, so they map to h3/h4
# rather than h2 — preserving the hierarchy it actually specifies.
G_H3 = {
    "1. They Don't Want To Burden Others",
    "2. They Minimise Their Own Experiences",
    "3. They Assume They Won't Be Understood",
    "4. Silence Becomes A Habit",
    "5. They Prefer To Think First",
    "6. They Don't Know How To Start",
    "Misconception 1",
    "Misconception 2",
    "Misconception 3",
}
G_H4 = {"Reality"}
# Bold statements that are the misconception itself, not a heading.
G_PLAIN = {
    "People only keep painful emotions inside.",
    "Talking is only important during difficult times.",
    "If someone isn't talking, they don't want to.",
}

# W2-A001 format scaffolding. These are the workbook's production labels for its locked answer
# format, not reader-facing copy — the same treatment "H1" and "Section 1" get in the structure
# sections. Every piece of ANSWER content they label is imported.
A_LABELS = {"Short Answer", "Expanded Answer"}


def s(text):
    """A TypeScript string literal, escaped by json.dumps."""
    return json.dumps(text, ensure_ascii=False)


class Builder:
    """Accumulates blocks, flushing runs of bullets into one list block."""

    def __init__(self, prefix):
        self.prefix = prefix
        self.blocks = []
        self.pending = []
        self.n = 0

    def _id(self, kind):
        self.n += 1
        return f"{self.prefix}-{kind}{self.n}"

    def flush_list(self):
        if not self.pending:
            return
        items = ", ".join(f"t({s(item)})" for item in self.pending)
        self.blocks.append(
            f"{{ id: {s(self._id('list'))}, type: 'list', style: 'bullet', items: [{items}] }}"
        )
        self.pending = []

    def bullet(self, text):
        self.pending.append(text)

    def para(self, text):
        self.flush_list()
        self.blocks.append(f"{{ id: {s(self._id('p'))}, type: 'paragraph', content: t({s(text)}) }}")

    def heading(self, text, level=2):
        self.flush_list()
        self.blocks.append(
            f"{{ id: {s(self._id('h'))}, type: 'heading', level: {level}, content: t({s(text)}) }}"
        )

    def quote(self, text):
        self.flush_list()
        self.blocks.append(f"{{ id: {s(self._id('q'))}, type: 'quote', content: t({s(text)}) }}")

    def takeaways(self, title, points):
        self.flush_list()
        rendered = ", ".join(f"t({s(p)})" for p in points)
        self.blocks.append(
            f"{{ id: {s(self._id('take'))}, type: 'key_takeaway', title: {s(title)}, points: [{rendered}] }}"
        )

    def raw(self, block):
        self.flush_list()
        self.blocks.append(block)

    def done(self):
        self.flush_list()
        return self.blocks


def faq_block(block_id, heading, rowset):
    """A bold question followed by its answer paragraph(s), repeated."""
    items = []
    question = None
    answer = []
    for bold, _is_list, text in rowset:
        if bold:
            if question:
                items.append((question, " ".join(answer)))
            question, answer = text, []
        else:
            answer.append(text)
    if question:
        items.append((question, " ".join(answer)))

    rendered = ", ".join(
        f"{{ id: {s(f'{block_id}-{i + 1}')}, question: {s(q)}, answer: t({s(a)}) }}"
        for i, (q, a) in enumerate(items)
    )
    return (
        f"{{ id: {s(block_id)}, type: 'faq', heading: {s(heading)}, items: [{rendered}] }}",
        len(items),
    )


# ─── W2-B001 ────────────────────────────────────────────────────────────────
b = Builder("b2")
for bold, _is_list, text in B_PROSE:
    if bold and text in B_QUOTES:
        b.quote(text)
    elif bold:
        b.heading(text, 2)
    else:
        b.para(text)
b_faq, b_faq_count = faq_block("b2-faq", "Frequently Asked Questions", B_FAQ)
b.raw(b_faq)
b.raw(
    "{ id: 'b2-cta', type: 'cta', label: 'Talk It Out', "
    "target: { kind: 'route', value: 'product.talk_it_out' } }"
)
B_BLOCKS = b.done()

# ─── W2-G001 ────────────────────────────────────────────────────────────────
g = Builder("g2")
takeaway_mode = False
takeaway_points = []
for bold, is_list, text in G_PROSE:
    if bold and text == "Key Takeaways":
        takeaway_mode = True
        continue
    if takeaway_mode:
        if is_list:
            takeaway_points.append(text)
            continue
        takeaway_mode = False
    if bold and text in G_PLAIN:
        g.para(text)
    elif bold and text in G_H4:
        g.heading(text, 4)
    elif bold and text in G_H3:
        g.heading(text, 3)
    elif bold:
        g.heading(text, 2)
    elif is_list:
        g.bullet(text)
    else:
        g.para(text)
if takeaway_points:
    g.takeaways("Key Takeaways", takeaway_points)
g_faq, g_faq_count = faq_block("g2-faq", "Related Questions", G_FAQ)
g.raw(g_faq)
g.raw(
    "{ id: 'g2-cta', type: 'cta', label: \"Talk through what's on your mind\", "
    "target: { kind: 'route', value: 'product.talk_it_out' } }"
)
G_BLOCKS = g.done()
G_KEY_STATEMENTS = takeaway_points

# ─── W2-A001 ────────────────────────────────────────────────────────────────
# Structure: Question N / question / Short Answer / Expanded Answer / Key Takeaways /
# Related Questions, twelve times. The FIRST question's short answer is hoisted into the single
# `direct_answer` block the AEO contract requires at position 0.
a = Builder("a2")
direct_answer = None
mode = None
pending_takeaways = []
question_index = 0
first_question = None
questions_seen = []

i = 0
while i < len(A_BODY):
    bold, is_list, text = A_BODY[i]

    if bold and text.startswith("Question ") and text[9:].strip().isdigit():
        if pending_takeaways:
            a.takeaways("Key Takeaways", pending_takeaways)
            pending_takeaways = []
        question_index += 1
        mode = "question"
        i += 1
        continue

    if mode == "question" and bold:
        questions_seen.append(text)
        if first_question is None:
            first_question = text
        a.heading(text, 2)
        mode = None
        i += 1
        continue

    if bold and text in A_LABELS:
        if pending_takeaways:
            a.takeaways("Key Takeaways", pending_takeaways)
            pending_takeaways = []
        mode = "short" if text == "Short Answer" else "expanded"
        i += 1
        continue

    if bold and text == "Key Takeaways":
        mode = "takeaways"
        i += 1
        continue

    if bold and text == "Related Questions":
        if pending_takeaways:
            a.takeaways("Key Takeaways", pending_takeaways)
            pending_takeaways = []
        a.heading(text, 3)
        mode = "related"
        i += 1
        continue

    if mode == "takeaways" and is_list:
        pending_takeaways.append(text)
        i += 1
        continue

    if mode == "related" and is_list:
        a.bullet(text)
        i += 1
        continue

    if mode == "short" and question_index == 1 and direct_answer is None:
        direct_answer = text
        i += 1
        continue

    a.para(text)
    i += 1

if pending_takeaways:
    a.takeaways("Key Takeaways", pending_takeaways)

a.raw(
    "{ id: 'a2-cta', type: 'cta', label: \"Talk through what's on your mind\", "
    "target: { kind: 'route', value: 'product.talk_it_out' } }"
)
A_BLOCKS = [
    f"{{ id: 'a2-direct-answer', type: 'direct_answer', content: t({s(direct_answer)}) }}"
] + a.done()

# ─────────────────────────────────────────────────────────────────────────────

HEADER = '''/**
 * Week 2 workbook -> Content Hub mapping.
 *
 * SOURCE: `SOLACE  Week 2nd Operational Workbook.docx`, assets W2-B001, W2-G001, W2-A001.
 *
 * ============================================================================
 * EVERY STRING OF PROSE BELOW IS THE WORKBOOK'S OWN WORDING.
 * ============================================================================
 *
 * The body text was transcribed mechanically from the .docx by
 * `scripts/content-hub/w2-generate.py`, so no sentence has been rewritten, shortened, expanded or
 * restyled, and no statistic, clinical claim or source was added. Regenerating from the same
 * workbook reproduces this file byte for byte.
 *
 * DEDUPLICATION (the workbook's one known defect):
 *   W2-B001 contains its opening section TWICE. Paragraphs 147-276 of the document reappear
 *   verbatim as 277-406 — 130 paragraphs, from the H1 "Why Do We Keep Things To Ourselves?"
 *   through "...And maybe they deserve conversations too." The FIRST copy is imported and the
 *   second is dropped. The article then continues from "The Cost of Carrying Everything Alone".
 *   No other duplication exists anywhere in the workbook: an 8-paragraph sliding-window scan over
 *   all 1,694 paragraphs found exactly this one repeated region.
 *
 * AUTHORED OUTSIDE WORKBOOK (each one is recorded on its asset):
 *   1. W2-A001 `title` — the workbook gives the AEO page no H1. Derived from its own SEO Title by
 *      dropping the " | SOLACE" brand suffix.
 *   2. One `cta` block per asset, built from the workbook's Internal Linking Strategy: the target
 *      is the destination it names (Talk It Out) and the label is the anchor text it specifies.
 *
 * DELIBERATELY ABSENT:
 *   - A `safety_notice` block on all three assets. The Week 2 workbook contains no crisis,
 *     disclaimer or professional-support wording of any kind, and inventing clinical language is
 *     not something an importer should do. All three therefore carry a publish blocker until an
 *     editor adds one.
 *
 * Block ids are stable and human-readable, so a re-run updates the same blocks rather than
 * churning revisions.
 */

import type { Week1Asset, Week1LinkSpec } from '../week1/week1-content';
import type { ContentBody, InlineContent } from '@meetezri/shared';

/** A span of plain text. The workbook contains no inline formatting. */
const t = (text: string): InlineContent => [{ text }];

/**
 * Week 2 reuses the Week 1 asset and link contracts EXACTLY — same fields, same link spec, same
 * importer helpers. Aliasing rather than redeclaring is deliberate: if the two ever drift, this
 * file stops compiling instead of quietly importing against a stale shape.
 */
export type Week2LinkSpec = Week1LinkSpec;
export type Week2Asset = Week1Asset;
'''


def asset(
    ref,
    content_type,
    public_label,
    title,
    slug,
    meta,
    type_fields,
    editorial,
    blocks,
    links,
    authored,
    missing,
):
    body = ",\n      ".join(blocks)
    return f'''
// ─────────────────────────────────────────────────────────────────────────────
// {ref}
// ─────────────────────────────────────────────────────────────────────────────

const {ref.replace("-", "_")}: Week2Asset = {{
  editorialRef: {s(ref)},
  contentType: '{content_type}',
  publicLabel: '{public_label}',
  title: {s(title)},
  slug: {s(slug)},
  metaDescription: {meta},
  week: 2,
  pillar: 'Someone To Talk To',
  tags: ['someone-to-talk-to', 'week-2'],

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
      primary: 'someone to talk to',
      secondary: [
        'why do people keep things to themselves',
        'everyday conversations',
        'meaningful conversations',
        'emotional wellbeing',
        'talking through your thoughts',
        'feeling understood',
        'human connection',
        "why we don't open up",
        'overthinking conversations',
      ],
    },
    word_count_target: '2,500-3,000 words',
    funnel_stage: 'Awareness',
  }"""

B_EDITORIAL = """{
    purpose: 'Establish SOLACE as an authority on everyday conversations and emotional wellbeing while building long-term search visibility.',
    strategy: 'Begin with something almost everyone has experienced rather than with stress, anxiety or depression, so the article is relatable before it introduces deeper ideas.',
    search_intent: 'Informational',
    user_state: 'Reflective, curious, often independent, sometimes isolated, not necessarily in crisis',
    goal: 'Organic Traffic',
    business_goal: 'Establish SOLACE as an authority on everyday conversations and emotional wellbeing while building long-term search visibility.',
    primary_kpi: 'Organic Traffic',
    secondary_kpi: 'Time on Page',
  }"""

G_TYPE_FIELDS = f"""{{
    core_concept: 'Why people keep things to themselves',
    supporting_concepts: [
      'Human Connection',
      'Meaningful Conversations',
      'Emotional Wellbeing',
      'Everyday Conversations',
      'Reflection',
      'Communication',
      'Self-awareness',
      'Belonging',
      'Personal Growth',
    ],
    citation_summary:
      {s("People keep things to themselves for many reasons, including not wanting to burden others, believing their thoughts are not important enough, assuming they won't be understood, or becoming accustomed to handling experiences privately. This behaviour is common and applies not only to difficult emotions but also to everyday thoughts, achievements, memories and moments. Meaningful conversations help strengthen connection, trust and emotional wellbeing by giving those experiences space to be shared.")},
    key_statements: {json.dumps(G_KEY_STATEMENTS, ensure_ascii=False, indent=6)},
    topics: {{
      primary: 'Why Do People Keep Things To Themselves?',
      secondary: ['Human Behaviour', 'Communication', 'Wellbeing'],
    }},
  }}"""

G_EDITORIAL = """{
    purpose: 'Create the most structured and trustworthy explanation of why people keep things to themselves.',
    strategy: 'Structured for retrieval: every section answers one clear concept, avoids long storytelling and prioritises clarity.',
    goal: 'AI Search Visibility',
    target_engines: ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'Copilot'],
    business_goal: 'Establish SOLACE as a trusted authority that AI assistants can confidently reference when explaining why people keep thoughts, emotions and experiences to themselves.',
    primary_kpi: 'AI citations',
    secondary_kpi: 'Organic impressions',
    geo_focus: 'AI Retrieval',
    citation_friendly: 'Yes',
  }"""

A_TYPE_FIELDS = f"""{{
    primary_question: 'Why do people keep things to themselves?',
    supporting_queries: [
      'Is it normal to want someone to talk to?',
      'Why are everyday conversations important?',
      "Why don't people open up?",
      'What makes a conversation meaningful?',
      'Is it healthy to keep everything inside?',
      'Why do people feel unheard?',
      'Why do people overthink conversations?',
      'How can I become more comfortable talking?',
      'Why do small conversations matter?',
      'Can talking support emotional wellbeing?',
      "What's the difference between privacy and isolation?",
    ],
    snippet_answer:
      {s("People often keep things to themselves because they don't want to burden others, believe their thoughts aren't important enough, or simply become used to handling experiences privately. This is common and doesn't only apply to difficult emotions.")},
  }}"""

A_EDITORIAL = """{
    purpose: 'Answer the questions people actually ask about everyday conversations, immediately and independently of any other section.',
    strategy: 'Answer-first: short answer, expanded answer, key takeaways, related questions.',
    goal: 'AI Answer Visibility',
    target_engines: [
      'Google AI Overviews',
      'ChatGPT',
      'Gemini',
      'Claude',
      'Perplexity',
      'Voice Assistants',
    ],
    business_goal: 'Position SOLACE as a trusted answer source for everyday conversation and emotional wellbeing questions.',
    primary_kpi: 'AI Answer Citations',
    secondary_kpi: 'Featured Snippets',
    aeo_signal: 'direct answer in first block',
  }"""

LINKS_B = """{ targetKind: 'content', targetRef: 'W2-G001', anchorText: null, relation: 'related_content' },
    { targetKind: 'content', targetRef: 'W2-A001', anchorText: null, relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' },"""

LINKS_G = """{ targetKind: 'content', targetRef: 'W2-B001', anchorText: null, relation: 'related_content' },
    { targetKind: 'content', targetRef: 'W2-A001', anchorText: null, relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: "Talk through what's on your mind", relation: 'product' },"""

LINKS_A = """{ targetKind: 'content', targetRef: 'W2-B001', anchorText: null, relation: 'related_content' },
    { targetKind: 'content', targetRef: 'W2-G001', anchorText: null, relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: "Talk through what's on your mind", relation: 'product' },"""

parts = [HEADER]

parts.append(
    asset(
        "W2-B001",
        "seo_blog",
        "Article",
        "Why Do We Keep Things To Ourselves?",
        "why-do-we-keep-things-to-ourselves",
        s(
            "Discover why people keep thoughts, achievements and everyday moments to themselves, and how meaningful conversations can strengthen connection."
        ),
        B_TYPE_FIELDS,
        B_EDITORIAL,
        B_BLOCKS,
        LINKS_B,
        "['cta block (target and label taken from the workbook Internal Linking Plan)']",
        "['safety_notice (workbook supplies none)']",
    )
)

parts.append(
    asset(
        "W2-G001",
        "geo_article",
        "Insight",
        "Why Do People Keep Things To Themselves?",
        "why-do-people-keep-things-to-themselves",
        s(
            "Learn why people keep thoughts, feelings, achievements and everyday experiences to themselves, and how meaningful conversations can strengthen connection and emotional wellbeing."
        ),
        G_TYPE_FIELDS,
        G_EDITORIAL,
        G_BLOCKS,
        LINKS_G,
        "['cta block (target and label taken from the workbook Internal Linking Strategy)']",
        "['safety_notice (workbook supplies none)']",
    )
)

parts.append(
    asset(
        "W2-A001",
        "aeo_answer",
        "Answer",
        "Why Do People Keep Things to Themselves? Questions Answered",
        "questions-about-everyday-conversations",
        s(
            "Find clear answers to common questions about meaningful conversations, emotional wellbeing, and why people often keep thoughts and experiences to themselves."
        ),
        A_TYPE_FIELDS,
        A_EDITORIAL,
        A_BLOCKS,
        LINKS_A,
        "['title (derived from the workbook SEO Title; the workbook gives this page no H1)', "
        "'cta block (target and label taken from the workbook Internal Linking Strategy)']",
        "['safety_notice (workbook supplies none)']",
    )
)

parts.append(
    """
/** The three Week 2 assets, in workbook order. */
export const WEEK2_ASSETS: Week2Asset[] = [W2_B001, W2_G001, W2_A001];

/**
 * Content-to-content edges the workbook's ecosystem section describes, as [source, target] pairs.
 *
 * The workbook states that the Week 2 assets "create a layered authority strategy where the same
 * core idea is expressed in different formats without duplication", and that the GEO page
 * "complements, rather than replaces, the Week 2 blog". Those are the relationships recorded here;
 * no link to Week 1 is created, because the workbook names none.
 */
export const EXPECTED_CONTENT_EDGES: Array<[string, string]> = [
  ['W2-B001', 'W2-G001'],
  ['W2-B001', 'W2-A001'],
  ['W2-G001', 'W2-B001'],
  ['W2-G001', 'W2-A001'],
  ['W2-A001', 'W2-B001'],
  ['W2-A001', 'W2-G001'],
];
"""
)

OUT.write_text("".join(parts), encoding="utf-8")

print(f"wrote {OUT}")
print(f"  W2-B001 blocks={len(B_BLOCKS)} faq={b_faq_count}")
print(f"  W2-G001 blocks={len(G_BLOCKS)} faq={g_faq_count} key_statements={len(G_KEY_STATEMENTS)}")
print(f"  W2-A001 blocks={len(A_BLOCKS)} questions={len(questions_seen)}")
print(f"  dropped as duplication: workbook paragraphs 277-406 ({len(rows(277, 406))} non-empty)")

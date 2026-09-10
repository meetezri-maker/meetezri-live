"""
Week 3 workbook -> `week3-content.ts` generator.

The prose is transcribed BY MACHINE straight out of the .docx, so every sentence in the generated
module is the workbook's own wording character for character. Nothing is rewritten, shortened,
paraphrased, reordered or removed. The only judgement encoded is STRUCTURAL.

PARAGRAPH MERGING (approved decision 1). The workbook writes one sentence per paragraph, which
puts W3-G001 at 504 blocks and W3-A001 at 613 against a hard `CONTENT_LIMITS.maxBlocks` of 500.
Consecutive PLAIN sentence-paragraphs under the same heading are therefore joined into one
paragraph with a single space. No word changes and no sentence moves. Headings, list items,
question headings, Quick Answers, Explanations, Practical Examples, Related Questions and FAQ
items all remain separate blocks. W3-B001 fits without merging and is left at one block per
sentence, preserving its deliberate rhythm.

Run:
    python3 scripts/content-hub/w3-generate.py <workbook.docx> <output.ts>
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
DOCX = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/w3/w3.docx")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/w3/week3-content.ts")
FLAGGED = Path("/tmp/w3/w3f.txt")

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
B_BODY = rows(141, 536)          # PART 2A article, after the "H1" label and the title
# Section 14, "FAQ SECTION (SEO)". Unlike every other question list in this workbook these are
# NOT bold — they are plain paragraphs alternating question, answer, question, answer. The region
# stops at 638; 640 begins section 15 (Featured Snippet Target), which is not FAQ material.
B_FAQ = rows(625, 638)
G_BODY = rows(861, 1654)         # PART 2.1 .. 2.5, after the page H1 on line 860
A_BODY = rows(2015, 3013)        # PART 2.1 .. 2.5, the 25 answers

# Structural markers that are workbook scaffolding, never reader-facing copy.
SKIP_EXACT = {"Asset ID: W3-A001", "Asset ID: W3-G001", "Asset ID: W3-B001"}
SKIP_PREFIX = ("PART 2.", "PART 3", "PART 1", "QUESTION ")

# W3-A001's locked answer-format labels. Kept as h3 headings so the approved structure survives.
A_LABELS = {"Quick Answer (40–60 Words)": "Quick Answer", "Explanation": "Explanation",
            "Practical Example": "Practical Example", "Related Questions": "Related Questions"}


class Builder:
    """Accumulates blocks, flushing bullet runs into one list and merging paragraph runs."""

    def __init__(self, prefix, merge):
        self.prefix = prefix
        self.merge = merge
        self.blocks = []
        self.bullets = []
        self.para_run = []
        self.n = 0

    def _id(self, kind):
        self.n += 1
        return f"{self.prefix}-{kind}{self.n}"

    def _flush_bullets(self):
        if not self.bullets:
            return
        items = ", ".join(f"t({s(i)})" for i in self.bullets)
        self.blocks.append(f"{{ id: {s(self._id('list'))}, type: 'list', style: 'bullet', items: [{items}] }}")
        self.bullets = []

    def _flush_paras(self):
        if not self.para_run:
            return
        if self.merge:
            # One block per RUN: the sentences are joined in order, unchanged.
            text = " ".join(self.para_run)
            self.blocks.append(f"{{ id: {s(self._id('p'))}, type: 'paragraph', content: t({s(text)}) }}")
        else:
            for line in self.para_run:
                self.blocks.append(f"{{ id: {s(self._id('p'))}, type: 'paragraph', content: t({s(line)}) }}")
        self.para_run = []

    def flush(self):
        self._flush_bullets()
        self._flush_paras()

    def bullet(self, text):
        self._flush_paras()
        self.bullets.append(text)

    def para(self, text):
        self._flush_bullets()
        self.para_run.append(text)

    def heading(self, text, level=2):
        self.flush()
        self.blocks.append(f"{{ id: {s(self._id('h'))}, type: 'heading', level: {level}, content: t({s(text)}) }}")

    def raw(self, block):
        self.flush()
        self.blocks.append(block)

    def done(self):
        self.flush()
        return self.blocks


def faq_block(block_id, heading, rowset):
    """A bold question followed by its answer paragraph(s), repeated."""
    items, question, answer = [], None, []
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
    return f"{{ id: {s(block_id)}, type: 'faq', heading: {s(heading)}, items: [{rendered}] }}", items


# ─── W3-B001 — no merging, 363 blocks fits comfortably ───────────────────────
b = Builder("b3", merge=False)
for bold, is_list, text in B_BODY:
    if text in SKIP_EXACT or text.startswith(SKIP_PREFIX):
        continue
    if bold:
        b.heading(text, 2)
    elif is_list:
        b.bullet(text)
    else:
        b.para(text)

def alternating_faq_block(block_id, heading, rowset):
    """Question, answer, question, answer … — the shape W3-B001's FAQ section actually uses."""
    if len(rowset) % 2 != 0:
        raise SystemExit(f"{block_id}: expected question/answer pairs, got {len(rowset)} lines")
    items = [(rowset[i][2], rowset[i + 1][2]) for i in range(0, len(rowset), 2)]
    rendered = ", ".join(
        f"{{ id: {s(f'{block_id}-{i + 1}')}, question: {s(q)}, answer: t({s(a)}) }}"
        for i, (q, a) in enumerate(items)
    )
    return f"{{ id: {s(block_id)}, type: 'faq', heading: {s(heading)}, items: [{rendered}] }}", items


B_FAQ_BLOCK, B_FAQ_ITEMS = alternating_faq_block("b3-faq", "Frequently Asked Questions", B_FAQ)
b.raw(B_FAQ_BLOCK)
# CTAs use the workbook's OWN anchor wording, and only for destinations that are real public
# routes. Journal / Mood Tracker / Habit Tracker / Progress Dashboard have no public route and are
# deliberately left unlinked.
b.raw("{ id: 'b3-cta-talk', type: 'cta', label: \"Talk through what's on your mind\", "
      "target: { kind: 'route', value: 'product.talk_it_out' } }")
b.raw("{ id: 'b3-cta-resources', type: 'cta', label: 'Explore more wellbeing articles', "
      "target: { kind: 'route', value: 'resource_library' } }")
B_BLOCKS = b.done()

# ─── W3-G001 — merged ────────────────────────────────────────────────────────
g = Builder("g3", merge=True)
for bold, is_list, text in G_BODY:
    if text in SKIP_EXACT or text.startswith(SKIP_PREFIX):
        continue
    if bold:
        g.heading(text, 2)
    elif is_list:
        g.bullet(text)
    else:
        g.para(text)
G_BLOCKS = g.done()

# ─── W3-A001 — merged, question architecture preserved ──────────────────────
a = Builder("a3", merge=True)
pending_question = False
for bold, is_list, text in A_BODY:
    if text in SKIP_EXACT:
        continue
    if bold and text.upper().startswith("QUESTION "):
        pending_question = True          # the NEXT bold line is the question itself
        continue
    if text.startswith(("PART 2.", "PART 3", "PART 1")):
        continue
    if pending_question and bold:
        a.heading(text, 2)               # h2 — the question
        pending_question = False
        continue
    if bold and text in A_LABELS:
        a.heading(A_LABELS[text], 3)     # h3 — Quick Answer / Explanation / …
        continue
    if bold:
        a.heading(text, 3)               # CLUSTER SUMMARY and its sub-headings
        continue
    if is_list:
        a.bullet(text)
    else:
        a.para(text)

# W3-A001's FAQ block: the ten questions section 13 names, answered with the approved Quick
# Answer copy exactly as it instructs ("Each schema answer should match the approved Quick Answer
# copy to maintain consistency"). Nothing is chosen arbitrarily.
FAQ_WANTED = [
    "What Is An Honest Conversation With Yourself?",
    "What Does It Mean To Be Honest With Yourself?",
    "What Is Self-Reflection?",
    "What Is Self-Awareness?",
    "Why Is Self-Awareness Important?",
    "How Do You Have An Honest Conversation With Yourself?",
    "How Can I Become More Self-Aware?",
    "What Is The Difference Between Self-Reflection And Overthinking?",
    "What Questions Should I Ask Myself During Self-Reflection?",
    "Can Self-Reflection Improve Emotional Wellbeing?",
]

# Walk the raw rows again to pair each question heading with its Quick Answer paragraph(s).
quick = {}
current_q, mode, buf = None, None, []
for bold, is_list, text in A_BODY:
    if bold and text.upper().startswith("QUESTION "):
        if current_q and buf:
            quick[current_q] = " ".join(buf)
        current_q, mode, buf = None, "await_q", []
        continue
    if mode == "await_q" and bold:
        current_q, mode = text, None
        continue
    if bold and text == "Quick Answer (40–60 Words)":
        mode, buf = "quick", []
        continue
    if bold:
        if mode == "quick" and buf and current_q:
            quick[current_q] = " ".join(buf)
        mode = None
        continue
    if mode == "quick" and not is_list:
        buf.append(text)
if current_q and buf and current_q not in quick:
    quick[current_q] = " ".join(buf)

missing = [q for q in FAQ_WANTED if q not in quick]
if missing:
    raise SystemExit(f"FAQ questions with no Quick Answer found: {missing}")

faq_items = ", ".join(
    f"{{ id: {s(f'a3-faq-{i + 1}')}, question: {s(q)}, answer: t({s(quick[q])}) }}"
    for i, q in enumerate(FAQ_WANTED)
)
a.raw(f"{{ id: 'a3-faq', type: 'faq', heading: 'Frequently Asked Questions', items: [{faq_items}] }}")
a.raw("{ id: 'a3-cta-talk', type: 'cta', label: \"Talk through what you're carrying\", "
      "target: { kind: 'route', value: 'product.talk_it_out' } }")
a.raw("{ id: 'a3-cta-resources', type: 'cta', label: 'Discover more wellbeing resources', "
      "target: { kind: 'route', value: 'resource_library' } }")

# The publish checklist requires an `aeo_answer` to carry exactly one `direct_answer`, first.
# The workbook designates the copy for it explicitly — section 11, "Primary Featured Snippet
# Target → Snippet Answer (40–60 Words)" — so nothing is authored here. It renders once: the
# same string also sits in `typeFields.snippet_answer`, which the serializer exposes for meta and
# JSON-LD only and `TypeIntro` never displays, so there is no duplicated visible content.
SNIPPET_ANSWER = (
    "An honest conversation with yourself is the practice of recognising your thoughts, emotions "
    "and experiences accurately without unnecessary judgment. It helps you better understand what "
    "you are feeling, identify personal needs and make more intentional decisions based on "
    "awareness rather than avoidance."
)
A_BLOCKS = [
    f"{{ id: 'a3-direct-answer', type: 'direct_answer', content: t({s(SNIPPET_ANSWER)}) }}"
] + a.done()

# ─────────────────────────────────────────────────────────────────────────────

HEADER = '''/**
 * Week 3 workbook -> Content Hub mapping.
 *
 * SOURCE: `WEEK 3 OPERATIONAL WORKBOOK.docx`, assets W3-B001, W3-G001, W3-A001.
 * Authority pillar: Honest Conversations.
 *
 * ============================================================================
 * EVERY STRING OF PROSE BELOW IS THE WORKBOOK'S OWN WORDING.
 * ============================================================================
 *
 * Transcribed mechanically by `scripts/content-hub/w3-generate.py`. No sentence was rewritten,
 * shortened, paraphrased, reordered or removed, and no statistic, claim or source was added.
 * Regenerating from the same workbook reproduces this file byte for byte.
 *
 * PARAGRAPH MERGING — the one technical transformation, and why it was required:
 *   The workbook writes one sentence per paragraph. Mapped literally that is 504 blocks for
 *   W3-G001 and 613 for W3-A001, against a hard `CONTENT_LIMITS.maxBlocks` of 500 whose breach is
 *   a validation ERROR, not a warning. Consecutive PLAIN paragraphs under the same heading are
 *   therefore joined with a single space. Word for word the prose is identical; only the
 *   paragraph boundaries move. Headings, lists, question headings, Quick Answers, Explanations,
 *   Practical Examples, Related Questions and FAQ items all remain separate blocks.
 *   W3-B001 fits without merging (363 blocks) and keeps one block per sentence.
 *
 * DELIBERATELY ABSENT:
 *   - `safety_notice` on all three. The Week 3 workbook contains no crisis, disclaimer or
 *     professional-support wording, and safety copy is never invented. Approved copy will be
 *     added editorially before approval. Each asset therefore carries a publish blocker.
 *   - Links to Journal, Mood Tracker, Habit Tracker and Progress Dashboard. Those features exist
 *     only behind authentication at `/app/*`, and `ROUTE_REGISTRY` deliberately excludes
 *     authenticated destinations. The workbook's anchor wording stays in the prose, unlinked.
 *   - An FAQ block on W3-G001. Its section 13 names six FAQ candidates but supplies no approved
 *     answer copy, and answers are not composed here.
 *   - The workbook canonical URLs (`talktosolace.ai/blog/…`, `/answers/…`). Canonicals are
 *     generated by the live Content Hub from `/resources/<slug>`.
 */

import type { Week1Asset, Week1LinkSpec } from '../week1/week1-content';
import type { ContentBody, InlineContent } from '@meetezri/shared';

/** A span of plain text. The workbook contains no inline formatting. */
const t = (text: string): InlineContent => [{ text }];

/** Week 3 reuses the Week 1 asset and link contracts EXACTLY. */
export type Week3LinkSpec = Week1LinkSpec;
export type Week3Asset = Week1Asset;
'''


def asset(ref, ctype, label, title, slug, meta, type_fields, editorial, blocks, links, authored, missing):
    body = ",\n      ".join(blocks)
    return f'''
// ─────────────────────────────────────────────────────────────────────────────
// {ref}
// ─────────────────────────────────────────────────────────────────────────────

const {ref.replace("-", "_")}: Week3Asset = {{
  editorialRef: {s(ref)},
  contentType: '{ctype}',
  publicLabel: '{label}',
  title: {s(title)},
  slug: {s(slug)},
  metaDescription: {meta},
  week: 3,
  pillar: 'Honest Conversations',
  tags: ['honest-conversations', 'week-3'],

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
      primary: 'honest conversation with yourself',
      secondary: [
        'how to be honest with yourself',
        'self-reflection',
        'self-awareness',
        'talking to yourself honestly',
        'emotional honesty',
      ],
    },
    word_count_target: '1,800-2,300 words',
    funnel_stage: 'Awareness',
  }"""

B_EDITORIAL = """{
    purpose: 'Organic Search Authority',
    strategy: 'Informational search intent, opening with a relatable everyday moment before introducing deeper ideas.',
    search_intent: 'Informational',
    goal: 'Organic Search Authority',
    primary_kpi: 'Organic Search Authority',
  }"""

G_TYPE_FIELDS = f"""{{
    core_concept: 'Honest Conversation With Yourself',
    supporting_concepts: [
      'Self-Reflection',
      'Self-Awareness',
      'Emotional Awareness',
      'Emotional Intelligence',
      'Decision-Making',
      'Personal Growth',
      'Reflection Practice',
      'Emotional Wellbeing',
      'Self-Compassion',
      'Healthy Habits',
    ],
    citation_summary:
      {s("This resource explains what honest conversations with yourself are, why they matter, how they differ from self-criticism and overthinking, and how to practice healthy self-reflection through a simple framework. It provides structured, evidence-informed guidance designed for both readers and AI knowledge systems.")},
    topics: {{
      primary: 'Honest Conversation With Yourself',
      secondary: ['Self-Reflection', 'Self-Awareness'],
    }},
  }}"""

G_EDITORIAL = """{
    purpose: 'AI Search Authority',
    strategy: 'A knowledge resource rather than a blog: definitions, comparisons, frameworks and reference summaries built for retrieval.',
    goal: 'AI Search Authority',
    geo_focus: 'AI Retrieval',
  }"""

A_TYPE_FIELDS = f"""{{
    primary_question: 'What is an honest conversation with yourself?',
    supporting_queries: [
      'What does it mean to be honest with yourself?',
      'What is self-reflection?',
      'Why is self-awareness important?',
      'How do you become more self-aware?',
      'How do you start self-reflection?',
      'What is the difference between self-reflection and overthinking?',
    ],
    snippet_answer:
      {s("An honest conversation with yourself is the practice of recognising your thoughts, emotions and experiences accurately without unnecessary judgment. It helps you better understand what you are feeling, identify personal needs and make more intentional decisions based on awareness rather than avoidance.")},
  }}"""

A_EDITORIAL = """{
    purpose: 'Answer Engine Authority',
    strategy: 'Twenty-five answers across five clusters, each following Question, Quick Answer, Explanation, Practical Example and Related Questions.',
    goal: 'Answer Engine Authority',
    target_engines: [
      'Google Featured Snippets',
      'AI Overviews',
      'ChatGPT Search',
      'Perplexity',
      'Voice Assistants',
    ],
    aeo_signal: 'quick answer first',
  }"""

# Only relationships the workbook states explicitly. Nothing is inferred from topical similarity.
LINKS_B = """{ targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: "Talk through what's on your mind", relation: 'product' },
    { targetKind: 'route', targetRoute: 'resource_library', anchorText: 'Explore more wellbeing articles', relation: 'resource_library' },"""

LINKS_G = ""

LINKS_A = """{ targetKind: 'content', targetRef: 'W3-B001', anchorText: 'Learn more about self-reflection', relation: 'related_content' },
    { targetKind: 'content', targetRef: 'W3-G001', anchorText: 'Explore the complete knowledge guide', relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: "Talk through what you're carrying", relation: 'product' },
    { targetKind: 'route', targetRoute: 'resource_library', anchorText: 'Discover more wellbeing resources', relation: 'resource_library' },"""

UNLINKED = (
    "'workbook link targets left UNLINKED (no public route): Journal, Mood Tracker, "
    "Habit Tracker, Progress Dashboard'"
)

parts = [HEADER]

parts.append(asset(
    "W3-B001", "seo_blog", "Article",
    "How to Have an Honest Conversation With Yourself (Without Judging Yourself)",
    "how-to-have-an-honest-conversation-with-yourself",
    s("Being honest with yourself doesn't have to mean being hard on yourself. Learn practical ways to build self-awareness, reflect without judgment and start meaningful conversations with yourself."),
    B_TYPE_FIELDS, B_EDITORIAL, B_BLOCKS, LINKS_B,
    "['cta blocks (labels and destinations taken from the workbook Internal Linking table)']",
    f"['safety_notice (workbook supplies none)', {UNLINKED}, "
    "'meta description is 192 chars, over the 160-character publish limit', "
    "'OG title/description have no field in the Content Hub schema']",
))

parts.append(asset(
    "W3-G001", "geo_article", "Insight",
    "Understanding Honest Conversations With Yourself: A Practical Guide to Self-Reflection",
    "understanding-honest-conversations-with-yourself",
    "null",
    G_TYPE_FIELDS, G_EDITORIAL, G_BLOCKS, LINKS_G,
    "['slug (the workbook defines none; approved separately)']",
    "['safety_notice (workbook supplies none)', "
    "'meta_description (the workbook defines no meta description; Short Summary is not labelled as one)', "
    "'faq block (section 13 names six FAQ candidates but supplies no approved answer copy)']",
))

parts.append(asset(
    "W3-A001", "aeo_answer", "Answer",
    "Questions About Honest Conversations With Yourself: Clear Answers for Self-Reflection",
    "questions-about-honest-conversations-with-yourself",
    s("Find clear answers to common questions about honest conversations with yourself, self-reflection and self-awareness. Learn practical ways to better understand your thoughts, emotions and everyday experiences."),
    A_TYPE_FIELDS, A_EDITORIAL, A_BLOCKS, LINKS_A,
    "['cta blocks (labels and destinations taken from the workbook Internal Linking Strategy table)']",
    f"['safety_notice (workbook supplies none)', {UNLINKED}, "
    "'meta description is 208 chars, over the 160-character publish limit']",
))

parts.append("""
/** The three Week 3 assets, in workbook order. */
export const WEEK3_ASSETS: Week3Asset[] = [W3_B001, W3_G001, W3_A001];

/**
 * Content-to-content edges the workbook states EXPLICITLY, as [source, target] pairs.
 *
 * Only W3-A001's section 15 names content relationships ("Learn more about self-reflection" ->
 * W3-B001, "Explore the complete knowledge guide" -> W3-G001). W3-B001 and W3-G001 name no
 * reciprocal content links, and none are inferred from topical similarity.
 */
export const EXPECTED_CONTENT_EDGES: Array<[string, string]> = [
  ['W3-A001', 'W3-B001'],
  ['W3-A001', 'W3-G001'],
];
""")

OUT.write_text("".join(parts), encoding="utf-8")

print(f"wrote {OUT}")
print(f"  W3-B001 blocks={len(B_BLOCKS)} faq={len(B_FAQ_ITEMS)}  (no merging)")
print(f"  W3-G001 blocks={len(G_BLOCKS)} faq=0  (merged)")
print(f"  W3-A001 blocks={len(A_BLOCKS)} faq={len(FAQ_WANTED)}  (merged)")
for name, n in (("W3-B001", len(B_BLOCKS)), ("W3-G001", len(G_BLOCKS)), ("W3-A001", len(A_BLOCKS))):
    print(f"    {name}: {'OK' if n <= 500 else 'STILL EXCEEDS 500'}")

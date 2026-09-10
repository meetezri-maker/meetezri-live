"""
W4-G001 (approved GEO article) -> TypeScript asset, appended to the Week 4 module.

SOURCE: `M1-W4-GEO.docx` — the approved reader-facing GEO article. The Week 4 operational
workbook's GEO sections are a strategy brief and are NOT used for the body.

Prose is transcribed BY MACHINE. Nothing is rewritten, shortened, paraphrased, reordered or
expanded. The document carries no bold, no styles and no list markup, so the ONLY structural
decision is which paragraphs are headings — and that is settled by exact string match against the
seventeen approved section titles, each of which was verified to occur exactly once.

Run:
    python3 scripts/content-hub/w4-g001-generate.py <geo.docx> <week4-content.ts>
"""

import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
DOCX = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/g4/g4.docx")
MODULE = Path(sys.argv[2] if len(sys.argv) > 2 else "src/modules/content-hub/week4/week4-content.ts")
FLAGGED = Path("/tmp/g4/g4f.txt")

subprocess.run([sys.executable, str(HERE / "w2-extract.py"), str(DOCX), str(FLAGGED)], check=True)
LINES = [line.split("|", 2)[2] if len(line.split("|", 2)) > 2 else "" for line in
         FLAGGED.read_text(encoding="utf-8").split("\n")]

TITLE = "Small Steps Create Lasting Change: How Daily Habits Build Consistency Over Time"

# The seventeen approved section titles. The five Reflection Loop stages are numbered in the
# source and nest under their parent, so they map to h3; the rest are h2.
H2 = [
    "What Does “Small Steps Create Lasting Change” Mean?",
    "Why Do Small Habits Often Work Better Than Big Changes?",
    "Motivation and Consistency Are Not the Same Thing",
    "Consistency Does Not Mean Perfection",
    "There Is No Universal Number of Days for Building a Habit",
    "The SOLACE Small-Step Reflection Loop",
    "What Small Steps Can Look Like in Everyday Life",
    "Why Reflection Makes Habits More Personal",
    "Common Misunderstandings About Small Habits",
    "Questions to Ask Yourself Before Starting a New Habit",
    "What Should You Remember?",
    "The SOLACE Perspective",
]
H3 = [
    "1. Notice",
    "2. Choose One Small Action",
    "3. Give the Action a Place in Your Day",
    "4. Repeat Without Demanding Perfection",
    "5. Reflect and Adjust",
]


def s(text):
    return json.dumps(text, ensure_ascii=False)


# ─── Verify the source before mapping it ────────────────────────────────────
body_lines = [t.strip() for t in LINES if t.strip()]
if body_lines[0] != TITLE:
    raise SystemExit(f"Unexpected first line: {body_lines[0]!r}")

for heading in H2 + H3:
    hits = [t for t in body_lines if t == heading]
    if len(hits) != 1:
        raise SystemExit(f"Heading {heading!r} occurs {len(hits)} times; expected exactly 1")

# Duplicated-region scan, same 8-paragraph sliding window used for every other week.
window = 8
seen = {}
for i in range(len(body_lines) - window + 1):
    key = tuple(body_lines[i : i + window])
    seen.setdefault(key, []).append(i)
dupes = [pos for pos, hits in seen.items() if len(hits) > 1]
if dupes:
    raise SystemExit(f"Duplicated regions found: {len(dupes)}")

# ─── Map ─────────────────────────────────────────────────────────────────────
blocks = []
counter = 0


def add(kind, payload):
    global counter
    counter += 1
    blocks.append(f"{{ id: {s(f'g4-{kind}{counter}')}, {payload} }}")


for text in body_lines[1:]:  # the title is the `title` field, not a block
    if text in H2:
        add("h", f"type: 'heading', level: 2, content: t({s(text)})")
    elif text in H3:
        add("h", f"type: 'heading', level: 3, content: t({s(text)})")
    else:
        add("p", f"type: 'paragraph', content: t({s(text)})")

# The article's closing section invites the reader to continue with SOLACE ("Talking through why
# something matters to you", "conversation, reflection..."). `/how-it-works` is the one public
# route that copy supports. The closing sentence itself is preserved verbatim as prose; no article
# wording was changed to manufacture this anchor, and `resource.links` is not relied on because
# the current renderer does not output it.
blocks.append(
    "{ id: 'g4-cta-talk', type: 'cta', label: 'Talk It Out', "
    "target: { kind: 'route', value: 'product.talk_it_out' } }"
)

# ─── GEO type fields — every value is a verbatim extraction ─────────────────
# core_concept: the article's own central concept, taken from its title.
CORE_CONCEPT = "Small Steps Create Lasting Change"

# citation_summary: the first paragraph of "What Does ... Mean?", which is the article's own
# self-contained definition of its subject. Copied verbatim, not summarised.
CITATION_SUMMARY = (
    "Small steps create lasting change when manageable actions are repeated consistently enough "
    "to become part of everyday life."
)

# key_statements: the five concise statements the article itself gives under "What Should You
# Remember?". Copied verbatim, in source order. Nothing from the operational strategy brief.
KEY_STATEMENTS = [
    "Repetition gives behaviors the opportunity to become familiar.",
    "Stable cues can make them easier to remember.",
    "Personal meaning can give you a reason to return.",
    "Reflection helps you understand whether the habit still belongs in your life.",
    "And flexibility gives you permission to continue even when the process is imperfect.",
]

for value in [CITATION_SUMMARY] + KEY_STATEMENTS:
    if value not in body_lines:
        raise SystemExit(f"Type-field value is not a verbatim source line: {value!r}")

body = ",\n      ".join(blocks)
key_statements = json.dumps(KEY_STATEMENTS, ensure_ascii=False, indent=6)

ASSET = f'''
// ─────────────────────────────────────────────────────────────────────────────
// W4-G001
//
// SOURCE: `M1-W4-GEO.docx`, the approved reader-facing GEO article — NOT the Week 4 operational
// workbook, whose GEO sections are a strategy brief for producing this content.
//
// The source document carries no bold, no paragraph styles and no list markup, so headings were
// identified by exact match against the seventeen approved section titles (each verified to occur
// exactly once) and everything else is a paragraph in source order. No list or quote structure was
// inferred, because the document asserts none.
// ─────────────────────────────────────────────────────────────────────────────

const W4_G001: Week4Asset = {{
  editorialRef: 'W4-G001',
  contentType: 'geo_article',
  publicLabel: 'Insight',
  title: {s(TITLE)},
  slug: 'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time',
  // The article supplies no meta description. Left null rather than authored.
  metaDescription: null,
  week: 4,
  pillar: 'Small Steps Create Lasting Change',
  tags: ['small-steps-lasting-change', 'week-4'],

  typeFields: {{
    // Direct extraction — the article's own title concept.
    core_concept: {s(CORE_CONCEPT)},
    // Direct extraction — the opening sentence of "What Does ... Mean?", the article's own
    // self-contained definition of its subject. Verbatim, not summarised.
    citation_summary: {s(CITATION_SUMMARY)},
    // Direct extraction — the five statements under "What Should You Remember?", verbatim and in
    // source order. Nothing from the operational strategy brief.
    key_statements: {key_statements},
  }},

  // Internal only. Never serialised to a public response.
  editorial: {{
    purpose: 'AI Search Authority',
    strategy: 'Reader-facing GEO article: definitions, comparisons, a five-stage reflection loop and a reference summary.',
    goal: 'AI Search Authority',
    geo_focus: 'AI Retrieval',
  }},

  body: {{
    version: 1,
    blocks: [
      {body},
    ],
  }} as ContentBody,

  links: [
    {{ targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' }},
  ],

  authoredOutsideWorkbook: [
    'slug (derived from the approved title with the Content Hub slug rules)',
    'cta block (the closing section supports /how-it-works; article wording unchanged)',
  ],
  missingFields: [
    'safety_notice (the approved GEO article supplies none)',
    'meta_description (the approved GEO article supplies none)',
    'featured image (not supplied)',
    'author and reviewer (not supplied)',
  ],
}};
'''

src = MODULE.read_text(encoding="utf-8")

if "const W4_G001" in src:
    start = src.index("\n// ─────────────────────────────────────────────────────────────────────────────\n// W4-G001")
    end = src.index("\n};\n", start) + len("\n};\n")
    src = src[:start] + ASSET.rstrip("\n") + "\n" + src[end:]
else:
    anchor = "\n/**\n * The Week 4 assets being ingested"
    src = src.replace(anchor, ASSET + anchor, 1)

src = src.replace(
    "export const WEEK4_ASSETS: Week4Asset[] = [W4_B001, W4_A001];",
    "export const WEEK4_ASSETS: Week4Asset[] = [W4_B001, W4_G001, W4_A001];",
)

MODULE.write_text(src, encoding="utf-8")

print(f"appended W4-G001 to {MODULE}")
print(f"  title  : {TITLE}")
print(f"  slug   : small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time")
print(f"  blocks : {len(blocks)}  (limit 500 -> {'OK' if len(blocks) <= 500 else 'EXCEEDS'})")
print(f"  headings: {len(H2)} h2 + {len(H3)} h3")
print(f"  key_statements : {len(KEY_STATEMENTS)}")
print("  duplicated regions : none")

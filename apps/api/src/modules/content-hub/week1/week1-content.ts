/**
 * Week 1 workbook → Content Hub mapping.
 *
 * SOURCE: `Blog for fisrt week ai.docx`, assets W1-A001, W1-G001, W1-B001.
 *
 * ============================================================================
 * EVERY STRING OF PROSE BELOW IS THE WORKBOOK'S OWN WORDING.
 * ============================================================================
 *
 * Nothing is rewritten, shortened, expanded, restyled or "improved". No statistics, clinical
 * claims, sources or SOLACE wording were added. The only authored values are the three marked
 * `AUTHORED OUTSIDE WORKBOOK` below, each of which exists because the CMS requires a field the
 * workbook does not supply.
 *
 * AUTHORED OUTSIDE WORKBOOK:
 *   1. W1-B001 `slug` — the workbook gives no URL slug for the blog. Uses the slug approved in
 *      CONTENT_HUB_IMPLEMENTATION_PLAN.md: `someone-to-talk-to-at-night`.
 *   2. Structural block headings that repeat the workbook's own section titles verbatim (these
 *      are mapping, not new copy).
 *   3. FAQ block heading text ("Frequently Asked Questions" / "FAQ SECTION" → the workbook's own
 *      heading for that section).
 *
 * DELIBERATELY ABSENT:
 *   - W1-B001 `metaDescription`. The workbook supplies no meta description for the blog. It is
 *     left null rather than invented, so the publish checklist reports it as a blocking gap
 *     instead of being quietly satisfied with manufactured SEO copy.
 *
 * Block ids are stable and human-readable (`a1-direct-answer`), so a re-run updates the same
 * blocks rather than regenerating ids and churning revisions.
 */

import type { ContentBody, ContentType, InlineContent } from '@meetezri/shared';

/** A span of plain text. The workbook contains no inline formatting. */
const t = (text: string): InlineContent => [{ text }];

export interface Week1LinkSpec {
  targetKind: 'content' | 'route';
  /** Editorial ref for a content target — resolved to an id in pass 2. */
  targetRef?: string;
  targetRoute?: string;
  /** Null where the workbook supplies no anchor; the renderer falls back to the target title. */
  anchorText: string | null;
  relation: string;
}

export interface Week1Asset {
  editorialRef: string;
  contentType: ContentType;
  publicLabel: string;
  title: string;
  slug: string;
  /** Null when the workbook supplies none — a deliberate, reported gap. */
  metaDescription: string | null;
  week: number;
  pillar: string;
  tags: string[];
  typeFields: Record<string, unknown>;
  editorial: Record<string, unknown>;
  body: ContentBody;
  links: Week1LinkSpec[];
  /** Fields authored outside the workbook, for the import report. */
  authoredOutsideWorkbook: string[];
  /** Fields the workbook does not supply at all. */
  missingFields: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// W1-A001 — AEO Answer
// ─────────────────────────────────────────────────────────────────────────────

const A001: Week1Asset = {
  editorialRef: 'W1-A001',
  contentType: 'aeo_answer',
  publicLabel: 'Answer',
  title: 'What Should I Do When I Have Nobody to Talk To?',
  slug: 'what-should-i-do-when-i-have-nobody-to-talk-to',
  metaDescription:
    "If you feel like you have nobody to talk to, you're not alone. Learn healthy ways to express what you're carrying, process your thoughts, and find support when you need it most.",
  week: 1,
  pillar: 'Someone To Talk To',
  tags: ['someone-to-talk-to', 'week-1'],

  typeFields: {
    primary_question: 'What should I do when I have nobody to talk to?',
    supporting_questions: [
      'Who can I talk to when I feel alone?',
      'What if I have no one to talk to?',
      'How do I deal with feeling alone?',
      'What can I do when I need to vent?',
    ],
    snippet_answer:
      "If you have nobody to talk to, try expressing your thoughts through journaling, voice notes, trusted communities, or guided reflection tools. The goal is to give your thoughts somewhere to go rather than carrying them alone. If you're in distress or concerned about your safety, seek immediate support from a trusted person, crisis service, or mental health professional.",
    primary_keyword: 'what should i do when i have nobody to talk to',
    secondary_keywords: ['who can i talk to when i feel alone', 'nobody to talk to'],
  },

  // Internal only. Never serialised to a public response.
  editorial: {
    purpose: 'Answer one question better than anyone else',
    strategy: 'Direct answer first, explanation second',
    target_engines: ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'Google AI Overviews'],
    search_intent: 'Emotional Support',
    user_state: 'Feeling alone and needing someone to talk to',
    goal: 'AI Search Visibility',
    expected_outcome: 'Become a preferred answer source for AI engines',
    business_goal: 'Capture emotional-intent searches',
    primary_kpi: 'AI Citations',
    secondary_kpi: 'Organic Visits',
    aeo_signal: 'direct answer in first paragraph',
    geo_signal: 'expression reduces emotional load',
    citation_friendly: 'Yes',
    kpi_targets: {
      ai_citations: 'Growing Monthly',
      organic_visits: 'Growing Monthly',
      time_on_page: 'High',
      internal_link_clicks: 'Medium',
      trial_visits: 'Secondary',
    },
  },

  body: {
    version: 1,
    blocks: [
      {
        id: 'a1-direct-answer',
        type: 'direct_answer',
        content: t(
          "If you feel like you have nobody to talk to, start by finding a safe way to express what you're carrying. This could be writing your thoughts down, recording a voice note, speaking with a trusted person, joining a supportive community, or using a guided reflection tool. The goal is not to solve everything immediately. The goal is to give your thoughts somewhere to go instead of carrying them alone."
        ),
      },

      { id: 'a1-h-common', type: 'heading', level: 2, content: t('Why This Feeling Is More Common Than You Think') },
      { id: 'a1-p-common-1', type: 'paragraph', content: t('Many people experience moments where they feel alone with their thoughts.') },
      { id: 'a1-p-common-2', type: 'paragraph', content: t("Sometimes it's because friends are busy.") },
      { id: 'a1-p-common-3', type: 'paragraph', content: t("Sometimes it's because they don't want to burden others.") },
      { id: 'a1-p-common-4', type: 'paragraph', content: t("Sometimes it's because they don't know how to explain what they're feeling.") },
      { id: 'a1-p-common-5', type: 'paragraph', content: t('The experience is more common than most people realize.') },
      { id: 'a1-p-common-6', type: 'paragraph', content: t('Feeling like you have nobody to talk to does not mean there is something wrong with you.') },

      { id: 'a1-h-express', type: 'heading', level: 2, content: t("Start By Expressing What You're Carrying") },
      { id: 'a1-p-express-1', type: 'paragraph', content: t('One of the hardest parts of feeling alone is carrying everything internally.') },
      { id: 'a1-p-express-2', type: 'paragraph', content: t('Healthy forms of expression may include:') },
      {
        id: 'a1-list-expression-forms',
        type: 'list',
        style: 'bullet',
        items: [
          t('Journaling'),
          t('Voice notes'),
          t('Writing letters you never send'),
          t('Talking through thoughts out loud'),
          t('Guided reflection exercises'),
        ],
      },
      { id: 'a1-p-express-3', type: 'paragraph', content: t('Expression is often the first step toward clarity.') },

      { id: 'a1-h-advice', type: 'heading', level: 2, content: t('Remember That Not Every Conversation Needs Advice') },
      { id: 'a1-p-advice-1', type: 'paragraph', content: t('Many people think they need answers.') },
      { id: 'a1-p-advice-2', type: 'paragraph', content: t('Often, they simply need space to express what they are feeling.') },
      { id: 'a1-p-advice-3', type: 'paragraph', content: t('Being heard and understood can be just as valuable as receiving advice.') },

      // Workbook section "If You Need Immediate Support", promoted to an explicit safety notice
      // as the approved plan requires. Wording is the workbook's, unchanged.
      {
        id: 'a1-safety-immediate-support',
        type: 'safety_notice',
        variant: 'crisis',
        heading: 'If You Need Immediate Support',
        content: t(
          'If you are experiencing emotional distress or are worried about your safety, contact local emergency services, a crisis line, a trusted person, or a qualified mental health professional immediately. Seeking support is a sign of strength.'
        ),
      },

      { id: 'a1-h-reframe', type: 'heading', level: 2, content: t('A Different Way To Think About The Problem') },
      { id: 'a1-p-reframe-1', type: 'paragraph', content: t('Instead of asking:') },
      { id: 'a1-quote-reframe-old', type: 'quote', content: t('Why do I have nobody to talk to?') },
      { id: 'a1-p-reframe-2', type: 'paragraph', content: t('Try asking:') },
      { id: 'a1-quote-reframe-new', type: 'quote', content: t("How can I create a safe place to express what I'm carrying right now?") },
      { id: 'a1-p-reframe-3', type: 'paragraph', content: t('That shift often creates new possibilities.') },

      { id: 'a1-h-solace', type: 'heading', level: 2, content: t('How SOLACE Approaches Reflection') },
      { id: 'a1-p-solace-1', type: 'paragraph', content: t('SOLACE was created around a simple idea:') },
      { id: 'a1-p-solace-2', type: 'paragraph', content: t('People sometimes need a place to talk things through without pressure, judgment, or expectation.') },
      { id: 'a1-p-solace-3', type: 'paragraph', content: t('Talk It Out was designed to support reflection, expression, and feeling heard.') },

      {
        id: 'a1-faq',
        type: 'faq',
        heading: 'FAQ',
        items: [
          {
            id: 'a1-faq-1',
            question: 'Is it normal to feel like I have nobody to talk to?',
            answer: t('Yes. Many people experience periods where they feel isolated or unsupported, especially during stressful or emotional times.'),
          },
          {
            id: 'a1-faq-2',
            question: 'Why do I feel more alone at night?',
            answer: t('Nighttime often removes distractions, making thoughts and emotions feel more noticeable.'),
          },
          {
            id: 'a1-faq-3',
            question: 'Does talking about problems actually help?',
            answer: t('For many people, expressing thoughts and emotions can reduce emotional pressure and improve clarity.'),
          },
          {
            id: 'a1-faq-4',
            question: "What if I don't want advice?",
            answer: t("That's okay. Sometimes the goal is not finding a solution. Sometimes it's simply expressing what's on your mind."),
          },
          {
            id: 'a1-faq-5',
            question: "What should I do if I'm overwhelmed?",
            answer: t('Focus on one step at a time. Express what you are feeling, seek support when needed, and prioritize your safety and wellbeing.'),
          },
        ],
      },

      {
        id: 'a1-cta',
        type: 'cta',
        label: 'Talk It Out',
        target: { kind: 'route', value: 'product.talk_it_out' },
        description: 'A space for guided conversation and reflection.',
      },
    ],
  },

  links: [
    { targetKind: 'content', targetRef: 'W1-B001', anchorText: 'Someone To Talk To At Night', relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' },
    { targetKind: 'route', targetRoute: 'resource_library', anchorText: 'Mental Wellness Resources', relation: 'resource_library' },
    { targetKind: 'route', targetRoute: 'pricing', anchorText: 'Pricing', relation: 'pricing' },
  ],

  authoredOutsideWorkbook: [],
  missingFields: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// W1-G001 — GEO Insight
// ─────────────────────────────────────────────────────────────────────────────

const G001: Week1Asset = {
  editorialRef: 'W1-G001',
  contentType: 'geo_article',
  publicLabel: 'Insight',
  title: 'Why Talking Through Thoughts Can Make Them Feel Lighter',
  slug: 'why-talking-through-thoughts-can-make-them-feel-lighter',
  metaDescription:
    'Many people notice that thoughts feel lighter after talking about them. Learn why expression, reflection, and verbal processing can help create emotional clarity.',
  week: 1,
  pillar: 'Someone To Talk To',
  tags: ['someone-to-talk-to', 'week-1'],

  typeFields: {
    core_concept: 'Talking through thoughts can reduce emotional pressure',
    supporting_concepts: [
      'Expression creates clarity',
      'Reflection improves understanding',
      'Thoughts often feel heavier when kept inside',
    ],
    citation_summary:
      'Talking through thoughts can make them feel lighter because expression creates distance, verbal processing creates clarity, reflection creates understanding, and being heard can reduce emotional pressure. The problem may remain, but the experience of carrying it often changes.',
    key_statements: [
      'Thoughts often feel heavier when they remain unexpressed.',
      'Expression can change how a person experiences a thought.',
      'Verbal processing helps organize thinking.',
      'Reflection can create emotional clarity.',
      'Being heard can reduce emotional pressure.',
      'Understanding is not always the same as advice.',
      'Reflection helps people process experiences more effectively.',
    ],
    primary_topic: 'Talking Through Thoughts',
    secondary_topics: ['Emotional Reflection', 'Verbal Processing'],
  },

  editorial: {
    purpose: 'Teach a concept rather than answer a question',
    strategy: 'Explain emotional processing clearly and simply',
    target_engines: ['ChatGPT', 'Gemini', 'Claude', 'Perplexity'],
    search_intent: 'Understanding',
    user_state: 'Curious why talking helps',
    goal: 'AI Citation Visibility',
    expected_outcome: 'Become a source AI systems reference when discussing emotional processing',
    business_goal: 'Build topical authority around reflection and expression',
    geo_focus: 'AI Citation Worthiness',
    citation_friendly: 'High',
    question_coverage: 'Multiple',
    positioning: 'Reflection first. Advice second.',
    geo_objective: [
      'Teach a concept',
      'Become AI-citable',
      'Support AEO pages',
      'Support SEO blogs',
      'Strengthen SOLACE authority',
    ],
    geo_objective_note:
      'It is not written to rank first. It is written to become a trusted source that AI systems can confidently reference when explaining emotional processing and reflection.',
    kpi_targets: {
      ai_citations: 'High',
      organic_discovery: 'Medium',
      internal_link_clicks: 'Medium',
      time_on_page: 'High',
      topic_authority: 'Growing Monthly',
    },
  },

  body: {
    version: 1,
    blocks: [
      {
        id: 'g1-intro',
        type: 'paragraph',
        content: t(
          "People often describe the same experience: a thought feels overwhelming while it's trapped inside their head, but somehow feels lighter after talking about it. This doesn't happen because the problem magically disappears. It happens because expression changes the way we experience what we're carrying."
        ),
      },

      { id: 'g1-h-1', type: 'heading', level: 2, content: t('Thoughts Often Feel Bigger Inside Our Heads') },
      {
        id: 'g1-statement-1',
        type: 'geo_statement',
        statement: t('Internal processing can sometimes create mental repetition, making thoughts feel larger and heavier than they appear once expressed.'),
        // INTERNAL — stripped by the serializer, never public.
        coreMessage: 'When thoughts stay internal, they can loop repeatedly without resolution.',
        citationGoal: 'Emotional processing, overthinking, reflection',
      },

      { id: 'g1-h-2', type: 'heading', level: 2, content: t('Expression Creates Distance') },
      {
        id: 'g1-statement-2',
        type: 'geo_statement',
        statement: t('Expression helps transform a thought from something we are carrying into something we can observe.'),
        examples: ['Speaking, journaling, voice notes, guided reflection'],
        coreMessage: 'Saying a thought out loud changes our relationship to it.',
      },

      { id: 'g1-h-3', type: 'heading', level: 2, content: t('Verbal Processing Creates Clarity') },
      {
        id: 'g1-statement-3',
        type: 'geo_statement',
        statement: t('Verbal processing allows thoughts to become more structured and understandable.'),
        examples: ['Conversations often reveal insights that silent thinking alone does not.'],
        coreMessage: 'Many people discover what they actually think while talking.',
      },

      { id: 'g1-h-4', type: 'heading', level: 2, content: t('Being Heard Matters') },
      {
        id: 'g1-statement-4',
        type: 'geo_statement',
        statement: t('Feeling heard can create emotional relief even when a problem has not yet been solved.'),
        clarification: t('Understanding and advice are not always the same thing.'),
        coreMessage: 'The experience of being heard can reduce emotional pressure.',
      },

      { id: 'g1-h-5', type: 'heading', level: 2, content: t('Reflection Helps People Organize Experience') },
      {
        id: 'g1-statement-5',
        type: 'geo_statement',
        statement: t('Reflection helps transform scattered thoughts into a more coherent understanding of what someone is experiencing.'),
        examples: ['Journaling, discussion, guided conversation'],
        coreMessage: 'Reflection creates meaning.',
      },

      { id: 'g1-h-6', type: 'heading', level: 2, content: t('Why This Matters During Difficult Moments') },
      {
        id: 'g1-statement-6',
        type: 'geo_statement',
        statement: t('Expression and reflection can help reduce the feeling of carrying everything alone.'),
        coreMessage: 'Emotional weight often grows in isolation.',
      },

      // Section 6's Clarification, promoted to an explicit safety notice as the approved plan
      // requires. The wording is the workbook's own; no medical language was added.
      {
        id: 'g1-safety-clarification',
        type: 'safety_notice',
        variant: 'disclaimer',
        content: t('Expression is not a replacement for professional support when needed.'),
      },

      { id: 'g1-h-solace', type: 'heading', level: 2, content: t('How SOLACE Approaches Reflection') },
      {
        id: 'g1-p-solace-1',
        type: 'paragraph',
        content: t(
          'SOLACE was built around the belief that people sometimes need a place to express thoughts, reflect on experiences, and feel heard without pressure or judgment.'
        ),
      },
      { id: 'g1-p-solace-2', type: 'paragraph', content: t('Reflection first. Advice second.') },
      { id: 'g1-p-solace-3', type: 'paragraph', content: t('Talk It Out provides a space for guided conversation and reflection.') },

      {
        id: 'g1-cta',
        type: 'cta',
        label: 'Talk It Out',
        target: { kind: 'route', value: 'product.talk_it_out' },
        description: 'A space for guided conversation and reflection.',
      },
    ],
  },

  links: [
    { targetKind: 'content', targetRef: 'W1-B001', anchorText: 'Someone To Talk To At Night', relation: 'related_content' },
    { targetKind: 'content', targetRef: 'W1-A001', anchorText: 'What Should I Do When I Have Nobody To Talk To?', relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: 'Talk It Out', relation: 'product' },
    { targetKind: 'route', targetRoute: 'resource_library', anchorText: 'Mental Wellness Resources', relation: 'resource_library' },
  ],

  authoredOutsideWorkbook: [],
  missingFields: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// W1-B001 — SEO Article
// ─────────────────────────────────────────────────────────────────────────────

const B001: Week1Asset = {
  editorialRef: 'W1-B001',
  contentType: 'seo_blog',
  publicLabel: 'Article',
  title: 'Someone to Talk to at Night When Everything Feels Loud',
  // AUTHORED OUTSIDE WORKBOOK — the workbook supplies no URL slug for this asset. This is the
  // slug approved in CONTENT_HUB_IMPLEMENTATION_PLAN.md.
  slug: 'someone-to-talk-to-at-night',
  // MISSING — the workbook supplies no meta description for this asset. Left null on purpose so
  // the publish checklist reports a blocking gap rather than accepting invented SEO copy.
  metaDescription: null,
  week: 1,
  pillar: 'Someone To Talk To',
  tags: ['someone-to-talk-to', 'week-1'],

  typeFields: {
    primary_keyword: 'someone to talk to at night',
    search_intent: 'Emotional Support',
    word_count_target: '2,200–2,500',
    funnel_stage: 'Awareness',
  },

  editorial: {
    goal: 'SEO + GEO + AEO',
    authority_pillar: 'Someone To Talk To',
    search_intent: 'Emotional Support',
    funnel_stage: 'Awareness',
    word_count_target: '2,200–2,500',
  },

  body: {
    version: 1,
    blocks: [
      { id: 'b1-intro-1', type: 'paragraph', content: t('There is something different about nighttime.') },
      { id: 'b1-intro-2', type: 'paragraph', content: t('The day is busy. Work demands attention. Messages arrive constantly. Responsibilities keep moving. There is always another task, another conversation, another distraction.') },
      { id: 'b1-intro-3', type: 'paragraph', content: t('Then night arrives.') },
      { id: 'b1-intro-4', type: 'paragraph', content: t('The notifications slow down. The conversations end. The house becomes quiet.') },
      { id: 'b1-intro-5', type: 'paragraph', content: t("And suddenly the thoughts you've been carrying all day seem much louder than they did before.") },
      { id: 'b1-intro-6', type: 'paragraph', content: t('For many people, this is the moment they begin searching for someone to talk to at night.') },
      { id: 'b1-intro-7', type: 'paragraph', content: t('Not because they are looking for advice.') },
      { id: 'b1-intro-8', type: 'paragraph', content: t('Not because they expect someone to solve their problems.') },
      { id: 'b1-intro-9', type: 'paragraph', content: t('But because carrying everything alone can feel exhausting.') },
      { id: 'b1-intro-10', type: 'paragraph', content: t("If you've ever found yourself lying awake replaying conversations, worrying about the future, or sitting with emotions you haven't shared with anyone, you're far from alone.") },
      { id: 'b1-intro-11', type: 'paragraph', content: t('The experience is more common than most people realize.') },

      { id: 'b1-h-heavier', type: 'heading', level: 2, content: t('Why Thoughts Often Feel Heavier at Night') },
      { id: 'b1-p-heavier-1', type: 'paragraph', content: t('Many people notice that thoughts become more intense after dark.') },
      { id: 'b1-p-heavier-2', type: 'paragraph', content: t('The problems themselves may not have changed.') },
      { id: 'b1-p-heavier-3', type: 'paragraph', content: t('The circumstances may be exactly the same.') },
      { id: 'b1-p-heavier-4', type: 'paragraph', content: t('What changes is the environment around us.') },
      { id: 'b1-p-heavier-5', type: 'paragraph', content: t('During the day, our attention is divided across dozens of activities. We move from task to task. We respond to messages. We focus on work. We take care of responsibilities.') },
      { id: 'b1-p-heavier-6', type: 'paragraph', content: t('At night, those distractions disappear.') },
      { id: 'b1-p-heavier-7', type: 'paragraph', content: t('When there is less external noise, internal thoughts often become easier to hear.') },
      { id: 'b1-p-heavier-8', type: 'paragraph', content: t('This is one reason people experience:') },
      {
        id: 'b1-list-night',
        type: 'list',
        style: 'bullet',
        items: [
          t('Overthinking at night'),
          t('Racing thoughts before bed'),
          t('Feelings of loneliness'),
          t('Emotional overwhelm'),
          t('Increased self-reflection'),
        ],
      },
      { id: 'b1-p-heavier-9', type: 'paragraph', content: t('The mind naturally uses quiet moments to process experiences.') },
      { id: 'b1-p-heavier-10', type: 'paragraph', content: t('Unfortunately, that process can sometimes feel overwhelming when we are carrying stress, uncertainty, grief, disappointment, or emotional pressure.') },

      { id: 'b1-h-truth', type: 'heading', level: 2, content: t('The Truth About Wanting Someone to Talk To') },
      { id: 'b1-p-truth-1', type: 'paragraph', content: t('One of the biggest misconceptions about emotional support is that people are always looking for answers.') },
      { id: 'b1-p-truth-2', type: 'paragraph', content: t('Often they are not.') },
      { id: 'b1-p-truth-3', type: 'paragraph', content: t('Many people already understand their situation.') },
      { id: 'b1-p-truth-4', type: 'paragraph', content: t('They know what happened.') },
      { id: 'b1-p-truth-5', type: 'paragraph', content: t("They know what they're worried about.") },
      { id: 'b1-p-truth-6', type: 'paragraph', content: t('They know what decision needs to be made.') },
      { id: 'b1-p-truth-7', type: 'paragraph', content: t('What they are often missing is space.') },
      { id: 'b1-p-truth-8', type: 'paragraph', content: t('Space to think.') },
      { id: 'b1-p-truth-9', type: 'paragraph', content: t('Space to reflect.') },
      { id: 'b1-p-truth-10', type: 'paragraph', content: t('Space to express what they are carrying.') },
      { id: 'b1-p-truth-11', type: 'paragraph', content: t('There is a difference between:') },
      { id: 'b1-list-difference', type: 'list', style: 'bullet', items: [t('Receiving advice'), t('Feeling heard')] },
      { id: 'b1-p-truth-12', type: 'paragraph', content: t('Advice focuses on solutions.') },
      { id: 'b1-p-truth-13', type: 'paragraph', content: t('Being heard focuses on understanding.') },
      { id: 'b1-p-truth-14', type: 'paragraph', content: t('Both have value.') },
      { id: 'b1-p-truth-15', type: 'paragraph', content: t('But they serve different needs.') },
      { id: 'b1-p-truth-16', type: 'paragraph', content: t('Sometimes a person does not need another opinion.') },
      { id: 'b1-p-truth-17', type: 'paragraph', content: t('Sometimes they simply need a place where they can finally say what has been sitting on their mind.') },

      { id: 'b1-h-inside', type: 'heading', level: 2, content: t('What Happens When You Keep Everything Inside') },
      { id: 'b1-p-inside-1', type: 'paragraph', content: t('Most people can carry emotional weight for a while.') },
      { id: 'b1-p-inside-2', type: 'paragraph', content: t('The problem is that emotional weight rarely disappears simply because we ignore it.') },
      { id: 'b1-p-inside-3', type: 'paragraph', content: t('Thoughts that remain unexpressed often continue to demand attention.') },
      { id: 'b1-p-inside-4', type: 'paragraph', content: t('People may notice:') },
      {
        id: 'b1-list-inside',
        type: 'list',
        style: 'bullet',
        items: [
          t('Increased stress'),
          t('Mental fatigue'),
          t('Difficulty concentrating'),
          t('Irritability'),
          t('Emotional exhaustion'),
          t('Trouble sleeping'),
        ],
      },
      { id: 'b1-p-inside-5', type: 'paragraph', content: t('This does not mean something is wrong.') },
      { id: 'b1-p-inside-6', type: 'paragraph', content: t('It means the mind is still trying to process what it has experienced.') },
      { id: 'b1-p-inside-7', type: 'paragraph', content: t('Imagine carrying a heavy backpack every day.') },
      { id: 'b1-p-inside-8', type: 'paragraph', content: t('At first it feels manageable.') },
      { id: 'b1-p-inside-9', type: 'paragraph', content: t('Over time the weight becomes harder to ignore.') },
      { id: 'b1-p-inside-10', type: 'paragraph', content: t('The same thing can happen emotionally.') },
      { id: 'b1-p-inside-11', type: 'paragraph', content: t('When thoughts remain trapped inside, they can feel heavier than they actually are.') },
      { id: 'b1-p-inside-12', type: 'paragraph', content: t('Not because they are growing.') },
      { id: 'b1-p-inside-13', type: 'paragraph', content: t('Because they are being carried alone.') },

      { id: 'b1-h-healthy', type: 'heading', level: 2, content: t("Healthy Ways to Talk Through What You're Carrying") },
      { id: 'b1-p-healthy-1', type: 'paragraph', content: t('Not everyone has immediate access to a friend, family member, therapist, or support system.') },
      { id: 'b1-p-healthy-2', type: 'paragraph', content: t('That reality is important to acknowledge.') },
      { id: 'b1-p-healthy-3', type: 'paragraph', content: t('Fortunately, expression can take many forms.') },

      { id: 'b1-h3-journaling', type: 'heading', level: 3, content: t('Journaling') },
      { id: 'b1-p-journaling-1', type: 'paragraph', content: t("Writing thoughts down can create distance between you and what you're experiencing.") },
      { id: 'b1-p-journaling-2', type: 'paragraph', content: t('Many people discover clarity simply by seeing their thoughts on paper.') },

      { id: 'b1-h3-voice-notes', type: 'heading', level: 3, content: t('Voice Notes') },
      { id: 'b1-p-voice-notes', type: 'paragraph', content: t('Speaking thoughts aloud, even privately, can help organize emotions and reduce mental clutter.') },

      { id: 'b1-h3-reflection-questions', type: 'heading', level: 3, content: t('Reflection Questions') },
      { id: 'b1-p-reflection-1', type: 'paragraph', content: t('Questions such as:') },
      {
        id: 'b1-list-reflection',
        type: 'list',
        style: 'bullet',
        items: [
          t('What am I feeling right now?'),
          t('What triggered this feeling?'),
          t('What do I need most today?'),
        ],
      },
      { id: 'b1-p-reflection-2', type: 'paragraph', content: t('can encourage deeper understanding.') },

      { id: 'b1-h3-trusted', type: 'heading', level: 3, content: t('Trusted Conversations') },
      { id: 'b1-p-trusted', type: 'paragraph', content: t('When possible, talking with someone you trust can provide emotional relief and perspective.') },

      { id: 'b1-h3-guided', type: 'heading', level: 3, content: t('Guided Reflection Tools') },
      { id: 'b1-p-guided', type: 'paragraph', content: t('Structured reflection experiences can help people process thoughts when they are feeling overwhelmed or unsure where to begin.') },
      { id: 'b1-p-healthy-4', type: 'paragraph', content: t('The goal is not perfection.') },
      { id: 'b1-p-healthy-5', type: 'paragraph', content: t('The goal is expression.') },

      { id: 'b1-h-nobody', type: 'heading', level: 2, content: t("What If There Isn't Anyone Available Right Now?") },
      { id: 'b1-p-nobody-1', type: 'paragraph', content: t('This is often the hardest part.') },
      { id: 'b1-p-nobody-2', type: 'paragraph', content: t('Many people experience difficult moments when:') },
      {
        id: 'b1-list-nobody',
        type: 'list',
        style: 'bullet',
        items: [
          t('Friends are asleep'),
          t('Family members are unavailable'),
          t("They don't want to burden others"),
          t("They don't feel ready to explain what they're feeling"),
        ],
      },
      { id: 'b1-p-nobody-3', type: 'paragraph', content: t('These moments can create a powerful sense of isolation.') },
      { id: 'b1-p-nobody-4', type: 'paragraph', content: t('If this happens, remember:') },
      { id: 'b1-p-nobody-5', type: 'paragraph', content: t('Being alone and feeling alone are not always the same thing.') },
      { id: 'b1-p-nobody-6', type: 'paragraph', content: t('You can still create space for reflection.') },
      { id: 'b1-p-nobody-7', type: 'paragraph', content: t("You can still acknowledge what you're carrying.") },
      { id: 'b1-p-nobody-8', type: 'paragraph', content: t('You can still give your thoughts somewhere to go.') },
      { id: 'b1-p-nobody-9', type: 'paragraph', content: t('The important thing is avoiding the belief that everything must stay trapped inside.') },
      { id: 'b1-p-nobody-10', type: 'paragraph', content: t('Even small acts of expression can make a meaningful difference.') },

      { id: 'b1-h-lighter', type: 'heading', level: 2, content: t('Why Talking Through Thoughts Can Make Them Feel Lighter') },
      { id: 'b1-p-lighter-1', type: 'paragraph', content: t('People often describe a surprising experience.') },
      { id: 'b1-p-lighter-2', type: 'paragraph', content: t('A problem feels overwhelming.') },
      { id: 'b1-p-lighter-3', type: 'paragraph', content: t('They talk about it.') },
      { id: 'b1-p-lighter-4', type: 'paragraph', content: t('The problem remains.') },
      { id: 'b1-p-lighter-5', type: 'paragraph', content: t('Yet somehow it feels lighter.') },
      { id: 'b1-p-lighter-6', type: 'paragraph', content: t('Why?') },
      { id: 'b1-p-lighter-7', type: 'paragraph', content: t("Because expression changes our relationship with what we're carrying.") },
      { id: 'b1-p-lighter-8', type: 'paragraph', content: t('When thoughts remain internal, they can become tangled together.') },
      { id: 'b1-p-lighter-9', type: 'paragraph', content: t('When thoughts are expressed, they become easier to examine.') },
      { id: 'b1-p-lighter-10', type: 'paragraph', content: t('Many people discover that they understand their own feelings better after speaking about them.') },
      { id: 'b1-p-lighter-11', type: 'paragraph', content: t('This process is often called verbal processing.') },
      { id: 'b1-p-lighter-12', type: 'paragraph', content: t('It allows thoughts to move from:') },
      { id: 'b1-quote-lighter-from', type: 'quote', content: t('I feel overwhelmed.') },
      { id: 'b1-p-lighter-13', type: 'paragraph', content: t('to') },
      { id: 'b1-quote-lighter-to', type: 'quote', content: t('I understand why I feel overwhelmed.') },
      { id: 'b1-p-lighter-14', type: 'paragraph', content: t('That shift can create clarity.') },
      { id: 'b1-p-lighter-15', type: 'paragraph', content: t('And clarity often reduces emotional pressure.') },
      { id: 'b1-p-lighter-16', type: 'paragraph', content: t('The situation may not change immediately.') },
      { id: 'b1-p-lighter-17', type: 'paragraph', content: t('But the experience of carrying it often does.') },

      { id: 'b1-h-solace', type: 'heading', level: 2, content: t('How SOLACE Approaches Reflection') },
      { id: 'b1-p-solace-1', type: 'paragraph', content: t('SOLACE was created around a simple observation:') },
      { id: 'b1-p-solace-2', type: 'paragraph', content: t("Many people are carrying thoughts they don't know where to put.") },
      { id: 'b1-p-solace-3', type: 'paragraph', content: t('Not everyone wants therapy.') },
      { id: 'b1-p-solace-4', type: 'paragraph', content: t('Not everyone is looking for advice.') },
      { id: 'b1-p-solace-5', type: 'paragraph', content: t('Not everyone has someone available exactly when they need to talk.') },
      { id: 'b1-p-solace-6', type: 'paragraph', content: t('Yet the need for reflection remains.') },
      { id: 'b1-p-solace-7', type: 'paragraph', content: t('The need for expression remains.') },
      { id: 'b1-p-solace-8', type: 'paragraph', content: t('The need to feel heard remains.') },
      { id: 'b1-p-solace-9', type: 'paragraph', content: t("That's why Talk It Out was created.") },
      { id: 'b1-p-solace-10', type: 'paragraph', content: t('Talk It Out is designed to provide a space where people can express thoughts, reflect on experiences, and process what they are carrying without pressure, judgment, or expectation.') },
      { id: 'b1-p-solace-11', type: 'paragraph', content: t('The goal is not to tell people what to think.') },
      { id: 'b1-p-solace-12', type: 'paragraph', content: t('The goal is to help them think through what they are already carrying.') },
      { id: 'b1-p-solace-13', type: 'paragraph', content: t('Because sometimes the most valuable thing is not another answer.') },
      { id: 'b1-p-solace-14', type: 'paragraph', content: t("Sometimes it's having a place to finally say what's on your mind.") },

      {
        id: 'b1-cta',
        type: 'cta',
        label: 'Talk It Out',
        target: { kind: 'route', value: 'product.talk_it_out' },
        description: 'A space for guided conversation and reflection.',
      },

      {
        id: 'b1-faq',
        type: 'faq',
        heading: 'Frequently Asked Questions',
        items: [
          {
            id: 'b1-faq-1',
            question: 'Why do my thoughts get louder at night?',
            answer: t('Nighttime often removes distractions, making thoughts and emotions easier to notice. This can make worries, concerns, and unresolved feelings feel more intense.'),
          },
          {
            id: 'b1-faq-2',
            question: 'What should I do when I have nobody to talk to?',
            // The crisis sentence from this answer is ALSO promoted to the safety notice below,
            // as the approved plan requires. The answer itself is left exactly as authored.
            answer: t("Consider healthy forms of expression such as journaling, voice notes, reflection exercises, trusted communities, or guided conversation tools. If you're in distress, seek support from a trusted person, crisis service, or qualified mental health professional."),
          },
          {
            id: 'b1-faq-3',
            question: 'Is it normal to feel lonely at night?',
            answer: t('Yes. Many people experience increased feelings of loneliness or emotional awareness during quiet nighttime hours.'),
          },
          {
            id: 'b1-faq-4',
            question: 'Does talking about problems actually help?',
            answer: t('For many people, expressing thoughts and emotions can create clarity, reduce emotional pressure, and improve understanding of what they are experiencing.'),
          },
          {
            id: 'b1-faq-5',
            question: 'Why do I overthink before bed?',
            answer: t('The mind often uses quiet periods to process experiences from the day. Without distractions, thoughts can become more noticeable and feel more intense.'),
          },
          {
            id: 'b1-faq-6',
            question: 'How can I process emotions in a healthy way?',
            answer: t('Healthy approaches include journaling, reflection, exercise, mindfulness practices, trusted conversations, and seeking professional support when appropriate.'),
          },
        ],
      },

      // Extracted verbatim from FAQ #2, as the approved plan requires. No medical or crisis
      // language beyond what the workbook already contains.
      {
        id: 'b1-safety-distress',
        type: 'safety_notice',
        variant: 'crisis',
        content: t("If you're in distress, seek support from a trusted person, crisis service, or qualified mental health professional."),
      },

      { id: 'b1-h-final', type: 'heading', level: 2, content: t('Final Thought') },
      { id: 'b1-p-final-1', type: 'paragraph', content: t("If you've been searching for someone to talk to at night, there is a good chance you're not looking for the perfect answer.") },
      { id: 'b1-p-final-2', type: 'paragraph', content: t('You may simply be looking for a place where your thoughts can exist outside your head for a while.') },
      { id: 'b1-p-final-3', type: 'paragraph', content: t('A place to reflect.') },
      { id: 'b1-p-final-4', type: 'paragraph', content: t('A place to process.') },
      { id: 'b1-p-final-5', type: 'paragraph', content: t('A place to feel heard.') },
      { id: 'b1-p-final-6', type: 'paragraph', content: t("And sometimes, that's where clarity begins.") },
    ],
  },

  // The workbook lists these destinations without an anchor/destination pairing, so anchor text
  // is null and the renderer falls back to the target title or route label. No keyword-rich
  // anchors were invented.
  links: [
    { targetKind: 'content', targetRef: 'W1-A001', anchorText: null, relation: 'related_content' },
    { targetKind: 'content', targetRef: 'W1-G001', anchorText: null, relation: 'related_content' },
    { targetKind: 'route', targetRoute: 'product.talk_it_out', anchorText: null, relation: 'product' },
    { targetKind: 'route', targetRoute: 'resource_library', anchorText: null, relation: 'resource_library' },
    { targetKind: 'route', targetRoute: 'pricing', anchorText: null, relation: 'pricing' },
  ],

  authoredOutsideWorkbook: ['slug (someone-to-talk-to-at-night — from CONTENT_HUB_IMPLEMENTATION_PLAN.md)'],
  missingFields: ['metaDescription (workbook supplies none — blocking publish gap)'],
};

export const WEEK1_ASSETS: Week1Asset[] = [A001, G001, B001];

/** The expected content→content edges, for post-import verification. */
export const EXPECTED_CONTENT_EDGES: Array<[string, string]> = [
  ['W1-A001', 'W1-B001'],
  ['W1-G001', 'W1-B001'],
  ['W1-G001', 'W1-A001'],
  ['W1-B001', 'W1-A001'],
  ['W1-B001', 'W1-G001'],
];

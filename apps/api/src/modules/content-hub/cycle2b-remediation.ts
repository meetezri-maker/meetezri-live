export type RemediationField = 'body' | 'type_fields' | 'meta_description';

export interface ExactReplacement {
  slug: string;
  field: RemediationField;
  oldValue: string | null;
  newValue: string;
  blockId?: string;
}

export const CYCLE_2B_REPLACEMENTS: readonly ExactReplacement[] = [
  {
    slug: 'someone-to-talk-to-at-night',
    field: 'meta_description',
    oldValue: 'Someone to Talk to at Night When Everything Feels Loud',
    newValue: 'Explore why thoughts can feel louder at night and find practical ways to express what you’re carrying, create space to reflect, and seek appropriate support.',
  },
  {
    slug: 'understanding-honest-conversations-with-yourself',
    field: 'type_fields',
    oldValue: 'This resource explains what honest conversations with yourself are, why they matter, how they differ from self-criticism and overthinking, and how to practice healthy self-reflection through a simple framework. It provides structured, evidence-informed guidance designed for both readers and AI knowledge systems.',
    newValue: 'This resource explains what honest conversations with yourself are, why they matter, how they differ from self-criticism and overthinking, and how to practice healthy self-reflection through a simple framework. It provides structured, practical guidance for everyday self-reflection.',
  },
  {
    slug: 'questions-about-honest-conversations-with-yourself',
    field: 'body',
    oldValue: 'This section establishes the core concepts that support the rest of the AEO knowledge base:',
    newValue: 'This section introduces the core ideas used throughout the questions below:',
  },
  {
    slug: 'small-daily-habits-vs-motivation',
    field: 'body',
    oldValue: 'SOLACE MONTH 1 • WEEK 4 OPERATIONAL WORKBOOK',
    newValue: 'Put Small Habits Into Practice',
  },
  {
    slug: 'busy-mind-attention-mental-load-questions',
    field: 'body',
    oldValue: 'This distinction is one of the most important knowledge signals in Week 2.',
    newValue: 'This distinction can make it easier to notice whether your attention has moved or your mental load has grown.',
  },
  {
    slug: 'why-do-i-overthink-small-things',
    field: 'body',
    oldValue: 'This connects directly to Week 3’s strongest theme.',
    newValue: 'Anticipation can take up much more time than the event itself.',
  },
  {
    slug: 'anticipation-and-mental-attention',
    field: 'body',
    oldValue: 'This is a key Week 3 idea.',
    newValue: 'This pattern can be easy to overlook.',
  },
  {
    slug: 'why-do-i-keep-thinking-about-small-things',
    field: 'body',
    oldValue: 'Week 3 Connection',
    blockId: 'm3a-h28',
    newValue: 'A Familiar Example',
  },
  {
    slug: 'why-do-i-keep-thinking-about-small-things',
    field: 'body',
    blockId: 'm3a-h56',
    oldValue: 'Week 3 Connection',
    newValue: 'Why Quiet Moments Bring Thoughts Back',
  },
  {
    slug: 'why-do-i-keep-thinking-about-small-things',
    field: 'body',
    blockId: 'm3a-h70',
    oldValue: 'Week 3 Connection',
    newValue: 'When an Intention Feels Like an Action',
  },
  {
    slug: 'why-do-i-keep-thinking-about-small-things',
    field: 'body',
    blockId: 'm3a-p57',
    oldValue: 'Directly supports R006.',
    newValue: 'When activity slows down, unfinished thoughts can become easier to notice.',
  },
  {
    slug: 'why-do-i-keep-thinking-about-small-things',
    field: 'body',
    blockId: 'm3a-p71',
    oldValue: 'Direct support for R002.',
    newValue: 'Mentally composing a reply can make the response feel more complete than it is.',
  },
  {
    slug: 'why-do-i-keep-thinking-about-small-things',
    field: 'body',
    oldValue: 'This aligns directly with R004:',
    newValue: 'You may rehearse a conversation many times even when the conversation itself is brief.',
  },
] as const;

export interface ContextualLinkSpec {
  targetSlug: string;
  anchorText: string;
}

const links = (first: string, firstText: string, second: string, secondText: string) => [
  { targetSlug: first, anchorText: firstText },
  { targetSlug: second, anchorText: secondText },
];

export const CYCLE_2B_CONTEXTUAL_LINKS: Readonly<Record<string, readonly ContextualLinkSpec[]>> = {
  'someone-to-talk-to-at-night': links('what-should-i-do-when-i-have-nobody-to-talk-to', 'options when nobody feels available', 'why-talking-through-thoughts-can-make-them-feel-lighter', 'why expression can create space'),
  'what-should-i-do-when-i-have-nobody-to-talk-to': links('someone-to-talk-to-at-night', 'finding someone to talk to at night', 'why-talking-through-thoughts-can-make-them-feel-lighter', 'how talking can change the weight of a thought'),
  'why-talking-through-thoughts-can-make-them-feel-lighter': links('someone-to-talk-to-at-night', 'when thoughts feel loud at night', 'what-should-i-do-when-i-have-nobody-to-talk-to', 'ways to express what you are carrying'),
  'how-to-have-an-honest-conversation-with-yourself': links('understanding-honest-conversations-with-yourself', 'understanding honest self-reflection', 'questions-about-honest-conversations-with-yourself', 'common self-reflection questions'),
  'understanding-honest-conversations-with-yourself': links('how-to-have-an-honest-conversation-with-yourself', 'a practical self-conversation approach', 'questions-about-honest-conversations-with-yourself', 'answers about honest reflection'),
  'questions-about-honest-conversations-with-yourself': links('understanding-honest-conversations-with-yourself', 'the foundations of honest self-reflection', 'how-to-have-an-honest-conversation-with-yourself', 'putting self-reflection into practice'),
  'small-daily-habits-vs-motivation': links('questions-about-small-daily-habits-motivation-and-consistency', 'questions about habits and consistency', 'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time', 'how small steps build consistency'),
  'questions-about-small-daily-habits-motivation-and-consistency': links('small-daily-habits-vs-motivation', 'why small habits can outlast motivation', 'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time', 'building change one step at a time'),
  'small-steps-create-lasting-change-how-daily-habits-build-consistency-over-time': links('small-daily-habits-vs-motivation', 'the role of small daily habits', 'questions-about-small-daily-habits-motivation-and-consistency', 'practical consistency questions'),
  'everyday-stress-mental-load': links('everyday-stress-mental-load-emotional-resilience', 'how stress and resilience relate', 'manage-everyday-stress-before-overwhelm', 'ways to respond before stress builds'),
  'everyday-stress-mental-load-emotional-resilience': links('everyday-stress-mental-load', 'understanding everyday mental load', 'manage-everyday-stress-before-overwhelm', 'making space before overwhelm'),
  'manage-everyday-stress-before-overwhelm': links('everyday-stress-mental-load', 'recognising everyday stress and mental load', 'everyday-stress-mental-load-emotional-resilience', 'everyday resilience explained'),
  'attention-switching-mental-load-everyday-wellbeing': links('busy-mind-attention-mental-load-questions', 'questions about a busy mind', 'why-does-my-mind-feel-so-busy', 'why attention can feel crowded'),
  'busy-mind-attention-mental-load-questions': links('attention-switching-mental-load-everyday-wellbeing', 'attention switching and mental load', 'why-does-my-mind-feel-so-busy', 'understanding a busy-feeling mind'),
  'why-does-my-mind-feel-so-busy': links('attention-switching-mental-load-everyday-wellbeing', 'how attention switching adds load', 'busy-mind-attention-mental-load-questions', 'common busy-mind questions'),
  'anticipation-and-mental-attention': links('why-do-i-keep-thinking-about-small-things', 'why small things stay mentally active', 'why-do-i-overthink-small-things', 'questions about everyday overthinking'),
  'why-do-i-keep-thinking-about-small-things': links('anticipation-and-mental-attention', 'how anticipation holds attention', 'why-do-i-overthink-small-things', 'understanding everyday overthinking'),
  'why-do-i-overthink-small-things': links('anticipation-and-mental-attention', 'anticipation and mental attention', 'why-do-i-keep-thinking-about-small-things', 'why small moments can linger'),
  'replaying-conversations-and-everyday-reflection': links('why-do-i-keep-replaying-conversations-in-my-head', 'why conversations replay', 'why-do-i-replay-conversations', 'common questions about replaying conversations'),
  'why-do-i-keep-replaying-conversations-in-my-head': links('replaying-conversations-and-everyday-reflection', 'replaying conversations and reflection', 'why-do-i-replay-conversations', 'answers about conversations that linger'),
  'why-do-i-replay-conversations': links('why-do-i-keep-replaying-conversations-in-my-head', 'why a conversation can keep returning', 'replaying-conversations-and-everyday-reflection', 'everyday reflection after conversations'),
  'questions-about-everyday-conversations': links('why-do-people-keep-things-to-themselves', 'why people hold things back', 'why-do-we-keep-things-to-ourselves', 'understanding unspoken thoughts'),
  'why-do-people-keep-things-to-themselves': links('questions-about-everyday-conversations', 'questions about everyday conversations', 'why-do-we-keep-things-to-ourselves', 'why thoughts can remain unspoken'),
  'why-do-we-keep-things-to-ourselves': links('why-do-people-keep-things-to-themselves', 'reasons people keep things inside', 'questions-about-everyday-conversations', 'everyday conversation questions'),
};

/** Bounded for the finite one-off plan; measured production reads averaged well under 1s/query. */
export const CYCLE_2B_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 120_000,
} as const;

/**
 * Two validation reads, five statements per changed Resource, and three statements per link source.
 * Kept explicit so the timeout budget cannot silently drift below the approved plan's workload.
 */
export const CYCLE_2B_TRANSACTION_QUERY_BUDGET =
  2
  + new Set(CYCLE_2B_REPLACEMENTS.map(({ slug }) => slug)).size * 5
  + Object.keys(CYCLE_2B_CONTEXTUAL_LINKS).length * 3;

export const FAQ_AUTHORITY_REPORT = [
  ['Does talking about problems actually help?', 'why-talking-through-thoughts-can-make-them-feel-lighter'],
  ['What is self-awareness?', 'questions-about-honest-conversations-with-yourself'],
  ['What is mental load?', 'everyday-stress-mental-load'],
  ['How can I manage everyday stress?', 'manage-everyday-stress-before-overwhelm'],
  ['What is emotional resilience?', 'everyday-stress-mental-load-emotional-resilience'],
  ['Why does waiting for a reply take so much attention?', 'why-do-i-keep-thinking-about-small-things'],
  ['Is anticipation the same as overthinking?', 'anticipation-and-mental-attention'],
] as const;

function visit(value: unknown, oldValue: string, newValue: string): { value: unknown; matches: number } {
  if (typeof value === 'string') {
    return value === oldValue ? { value: newValue, matches: 1 } : { value, matches: 0 };
  }
  if (Array.isArray(value)) {
    let matches = 0;
    const next = value.map((item) => {
      const result = visit(item, oldValue, newValue);
      matches += result.matches;
      return result.value;
    });
    return { value: next, matches };
  }
  if (value && typeof value === 'object') {
    let matches = 0;
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      const result = visit(item, oldValue, newValue);
      matches += result.matches;
      next[key] = result.value;
    }
    return { value: next, matches };
  }
  return { value, matches: 0 };
}

function countBlocks(value: unknown, blockId: string): number {
  if (Array.isArray(value)) {
    return value.reduce((count, item) => count + countBlocks(item, blockId), 0);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (record.id === blockId ? 1 : 0)
      + Object.values(record).reduce<number>((count, item) => count + countBlocks(item, blockId), 0);
  }
  return 0;
}

function visitBlock(
  value: unknown,
  oldValue: string,
  newValue: string,
  blockId: string
): { value: unknown; matches: number } {
  if (Array.isArray(value)) {
    let matches = 0;
    const next = value.map((item) => {
      const result = visitBlock(item, oldValue, newValue, blockId);
      matches += result.matches;
      return result.value;
    });
    return { value: next, matches };
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.id === blockId) return visit(value, oldValue, newValue);

    let matches = 0;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      const result = visitBlock(item, oldValue, newValue, blockId);
      matches += result.matches;
      next[key] = result.value;
    }
    return { value: next, matches };
  }
  return { value, matches: 0 };
}

/** Exact-match and idempotence gate used by both dry-run and apply modes. */
export function applyExactReplacement(current: unknown, replacement: ExactReplacement) {
  if (replacement.field === 'meta_description') {
    if (current === replacement.newValue) return { state: 'already-applied' as const, value: current };
    if (current !== replacement.oldValue) throw new Error(`baseline mismatch: ${replacement.slug}.${replacement.field}`);
    return { state: 'change' as const, value: replacement.newValue };
  }

  if (replacement.blockId) {
    const blockCount = countBlocks(current, replacement.blockId);
    if (blockCount !== 1) {
      throw new Error(
        `baseline mismatch: ${replacement.slug}.${replacement.field} block ${replacement.blockId} expected exactly one block, found ${blockCount}`
      );
    }

    const oldResult = visitBlock(
      current,
      String(replacement.oldValue),
      replacement.newValue,
      replacement.blockId
    );
    const newResult = visitBlock(
      current,
      replacement.newValue,
      replacement.newValue,
      replacement.blockId
    );
    if (oldResult.matches === 1 && newResult.matches === 0) {
      return { state: 'change' as const, value: oldResult.value };
    }
    if (oldResult.matches === 0 && newResult.matches === 1) {
      return { state: 'already-applied' as const, value: current };
    }
    throw new Error(
      `baseline mismatch: ${replacement.slug}.${replacement.field} block ${replacement.blockId} expected exactly one match`
    );
  }

  const oldResult = visit(current, String(replacement.oldValue), replacement.newValue);
  if (oldResult.matches === 1) return { state: 'change' as const, value: oldResult.value };
  const newResult = visit(current, replacement.newValue, replacement.newValue);
  if (oldResult.matches === 0 && newResult.matches === 1) return { state: 'already-applied' as const, value: current };
  throw new Error(`baseline mismatch: ${replacement.slug}.${replacement.field} expected exactly one match`);
}

export function planExactReplacements(
  current: Record<RemediationField, unknown>,
  replacements: readonly ExactReplacement[]
) {
  const values = { ...current };
  const changedFields = new Set<RemediationField>();
  for (const replacement of replacements) {
    const result = applyExactReplacement(values[replacement.field], replacement);
    values[replacement.field] = result.value;
    if (result.state === 'change') changedFields.add(replacement.field);
  }
  return { values, changedFields: [...changedFields] };
}


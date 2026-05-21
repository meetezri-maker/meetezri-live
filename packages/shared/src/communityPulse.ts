/** Sentiment score for a single post or comment (-1 negative, 0 neutral, 1 positive). */
export type CommunitySentimentScore = -1 | 0 | 1;

export type CommunityPulseSignal = {
  sentiment: CommunitySentimentScore;
  weight?: number;
};

export type CommunityPulseResult = {
  percent: number | null;
  positive: number;
  negative: number;
  neutral: number;
};

const STRONG_NEGATIVE: RegExp[] = [
  /\bnot\s+(?:\w+\s+){0,2}feel\w*\s+(?:good|great|okay|ok|fine|well|better)\b/,
  /\bnot\s+(?:feel\w*\s+)?(?:good|great|okay|ok|fine|well|better)\b/,
  /feel\w*\s+very\s+bad/,
  /feel\w*\s+(?:awful|terrible|horrible|miserable|hopeless|worthless)/,
  /feel\w*\s+bad/,
  /feel\w*\s+(?:low|down|sad|depressed|anxious|empty|numb)/,
  /(?:very|really|so)\s+bad/,
  /(?:dont|don't|do not)\s+feel\w*\s+(?:good|great|okay|ok|fine|well)/,
  /(?:cant|can't|cannot)\s+(?:cope|handle|do this|go on)/,
  /want\s+to\s+(?:die|give up|disappear)/,
  /hate\s+(?:my|this|life|myself)/,
  /worst\s+(?:day|week|month|ever)/,
  /no\s+hope/,
  /breaking\s+down/,
];

const STRONG_POSITIVE: RegExp[] = [
  /feel\w*\s+very\s+good/,
  /feel\w*\s+(?:good|great|happy|better|amazing|wonderful|fantastic|okay|ok|fine)/,
  /(?:very|really|so)\s+good/,
  /doing\s+(?:great|well|good|better)/,
  /things\s+are\s+(?:good|great|better|improving|looking up)/,
  /(?:grateful|thankful|blessed|hopeful|relieved|proud)/,
  /good\s+day/,
  /great\s+day/,
  /best\s+day/,
  /small\s+win/,
  /quiet\s+win/,
];

const POSITIVE_WORDS = [
  'good',
  'great',
  'happy',
  'better',
  'hope',
  'love',
  'calm',
  'peace',
  'grateful',
  'win',
  'progress',
  'relieved',
  'excited',
  'proud',
  'amazing',
  'wonderful',
  'fantastic',
  'awesome',
  'joy',
  'smile',
  'healing',
  'supported',
  'encouraged',
];

const NEGATIVE_WORDS = [
  'bad',
  'sad',
  'angry',
  'anxious',
  'anxiety',
  'depress',
  'lonely',
  'alone',
  'hurt',
  'pain',
  'cry',
  'crying',
  'tired',
  'exhaust',
  'overwhelm',
  'stress',
  'struggle',
  'worthless',
  'hopeless',
  'terrible',
  'awful',
  'hate',
  'worst',
  'fear',
  'panic',
  'grief',
  'numb',
  'empty',
  'down',
  'low',
  'miserable',
  'broken',
  'scared',
];

function normalizeCommunityPulseText(text: string): string {
  const stripped = (text ?? '')
    .trim()
    .replace(/^[^\w\s]+/u, '')
    .trim();
  return stripped
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Keyword-based sentiment for community posts and comments. */
export function scoreCommunityTextSentiment(text: string): CommunitySentimentScore {
  const t = normalizeCommunityPulseText(text);
  if (!t || t.length < 2) return 0;

  if (/\bnot\s+bad\b/.test(t) || /\bnot\s+too\s+bad\b/.test(t)) return 1;

  for (const pattern of STRONG_NEGATIVE) {
    if (pattern.test(t)) return -1;
  }

  for (const pattern of STRONG_POSITIVE) {
    if (pattern.test(t)) return 1;
  }

  const words = t.split(' ');
  let positive = 0;
  let negative = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? '';
    const prev = words[i - 1] ?? '';
    const negated = prev === 'not' || prev === "n't" || prev === 'never' || prev === 'no';

    const isPositive = POSITIVE_WORDS.some((p) => w === p || w.startsWith(p));
    const isNegative = NEGATIVE_WORDS.some((n) => w === n || w.startsWith(n));

    if (isPositive) {
      if (negated) negative += 1;
      else positive += 1;
    }
    if (isNegative) {
      if (negated && (w === 'bad' || w.startsWith('bad'))) positive += 1;
      else negative += 1;
    }
  }

  if (negative > positive) return -1;
  if (positive > negative) return 1;
  return 0;
}

export function sentimentSignalsFromTexts(texts: string[]): CommunityPulseSignal[] {
  return texts.map((text) => ({ sentiment: scoreCommunityTextSentiment(text) }));
}

/**
 * Community pulse from post/comment sentiment (last 7 days on API).
 * Positive signals raise the gauge; negative signals lower it.
 */
export function computeCommunityPulsePercent(args: {
  signals: CommunityPulseSignal[];
  totalPosts: number;
}): CommunityPulseResult {
  const { signals, totalPosts } = args;

  if (totalPosts <= 0 && signals.length === 0) {
    return { percent: null, positive: 0, negative: 0, neutral: 0 };
  }

  let positive = 0;
  let negative = 0;
  let neutral = 0;

  for (const signal of signals) {
    const weight = signal.weight ?? 1;
    if (signal.sentiment > 0) positive += weight;
    else if (signal.sentiment < 0) negative += weight;
    else neutral += weight;
  }

  const polar = positive + negative;
  if (polar === 0) {
    return {
      percent: signals.length > 0 ? 50 : 50,
      positive,
      negative,
      neutral,
    };
  }

  const net = (positive - negative) / polar;
  const percent = Math.round(50 + net * 38);

  return {
    percent: Math.min(100, Math.max(12, percent)),
    positive,
    negative,
    neutral,
  };
}

export function communityPulseHeadlineFromPercent(percent: number): string {
  if (percent >= 78) return 'Positive energy is growing today.';
  if (percent >= 55) return 'Support is flowing gently through the feed.';
  if (percent >= 35) return 'A calm space — room for your voice.';
  return 'The community is quietly present today.';
}

export function communityPulseDetailFromSignals(args: {
  positive: number;
  negative: number;
  neutral: number;
}): string {
  const { positive, negative, neutral } = args;
  const scored = positive + negative;

  if (scored === 0 && neutral === 0) {
    return "We'll show a gentle pulse once there's a little more conversation to reflect on.";
  }

  if (positive > 0 && negative > 0) {
    return `Based on ${positive} uplifting and ${negative} difficult ${scored === 1 ? 'message' : 'messages'} in recent posts and replies.`;
  }
  if (positive > 0) {
    return `Based on ${positive} uplifting ${positive === 1 ? 'post or reply' : 'posts and replies'} lifting the community mood.`;
  }
  if (negative > 0) {
    return `Based on ${negative} difficult ${negative === 1 ? 'post or reply' : 'posts and replies'} — kindness here can help shift the pulse.`;
  }
  if (neutral > 0) {
    return `${neutral} recent ${neutral === 1 ? 'message' : 'messages'} are steady — share how you're feeling to shape the pulse.`;
  }
  return "We'll show a gentle pulse once there's a little more conversation to reflect on.";
}

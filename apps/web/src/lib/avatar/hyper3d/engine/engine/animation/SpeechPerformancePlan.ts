/**
 * FINAL CONVERGENCE — the utterance becomes the master performance timeline.
 *
 * Every speaking pass before this inferred motion from audio after playback had
 * already started: P18 from silence boundaries, P18.2 from an energy contour
 * inside voiced runs. Both are reactive, and reactive motion cannot anticipate
 * — the head can only respond to a word after it has been said.
 *
 * A speaker knows their sentence before delivering it. So does this runtime:
 * the payload carries `text` alongside MFA-aligned phonemes. This module plans
 * the whole performance BEFORE playback, from the sentence itself, and every
 * consumer resolves against the same plan and the same audio clock.
 *
 * The alignment that makes it possible: splitting the text on punctuation
 * yields 12 clauses, and the phoneme track carries 12 silences of >= 0.14 s.
 * Those two orderings correspond, so clause boundaries can be pinned to real
 * acoustic time rather than guessed by equal spacing.
 */

/** Words that carry little stress; emphasis prefers the words around them. */
const FUNCTION_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with", "from",
  "by", "as", "is", "was", "are", "were", "be", "been", "am", "do", "does", "did", "have",
  "has", "had", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their", "this", "that", "these", "those", "then",
  "there", "here", "so", "up", "out", "if", "no", "not", "can", "will", "would", "could"
]);

/** Words that mark a turn in the argument; a speaker usually moves on these. */
const CONTRAST_WORDS = new Set([
  "but", "however", "actually", "instead", "yet", "although", "though", "because",
  "therefore", "still", "rather", "otherwise", "whereas", "while"
]);

/** Words a speaker tends to punctuate with a nod. */
const AFFIRMATION_WORDS = new Set([
  "yes", "exactly", "right", "absolutely", "definitely", "certainly", "indeed", "sure", "of course"
]);

export type ClauseEnding = "continuing" | "final" | "question" | "exclamation";
export type AnchorCharacter = "emphasis" | "contrast" | "affirmation" | "opening" | "closing";

export interface PerformanceAnchor {
  /** Audio time of the spoken syllable this anchor belongs to, in seconds. */
  at: number;
  /** 0-1. Drives how far the whole performance commits, not just the head. */
  strength: number;
  character: AnchorCharacter;
  /** The word that motivated it, so a reviewer can read WHY the head moved. */
  word: string;
}

export interface PlannedClause {
  index: number;
  text: string;
  startsAt: number;
  endsAt: number;
  ending: ClauseEnding;
  anchors: PerformanceAnchor[];
  /** Where this clause sits in the utterance, 0-1. Shapes the resting drift. */
  positionInUtterance: number;
}

export interface SpeechPerformancePlan {
  utterance: string;
  durationSeconds: number;
  clauses: PlannedClause[];
  /** True when the plan was built from text; false when only audio was available. */
  fromText: boolean;
  /** How many clauses were pinned to a real silence rather than interpolated. */
  alignedClauses: number;
}

export interface TimedPhonemeLike {
  phoneme: string;
  start_time: number;
  end_time: number;
}

const BOUNDARY_SECONDS = 0.14;

/** Voiced spans, i.e. everything between the qualifying silences. */
const voicedSpans = (phonemes: TimedPhonemeLike[], duration: number) => {
  const spans: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const p of phonemes) {
    if (p.phoneme !== "SIL" || p.end_time - p.start_time < BOUNDARY_SECONDS) continue;
    if (p.start_time - cursor > 0.12) spans.push({ start: cursor, end: p.start_time });
    cursor = p.end_time;
  }
  if (duration - cursor > 0.12) spans.push({ start: cursor, end: duration });
  return spans;
};

const endingOf = (clause: string): ClauseEnding => {
  const trimmed = clause.trim();
  if (trimmed.endsWith("?")) return "question";
  if (trimmed.endsWith("!")) return "exclamation";
  if (/[.]$/.test(trimmed)) return "final";
  return "continuing";
};

/**
 * Builds the plan.
 *
 * Clauses come from punctuation, their times from the voiced spans between real
 * silences, and words are distributed inside a clause by length — a crude
 * syllable proxy, but it is derived from the actual clause duration rather than
 * assumed, and it only has to be good enough to put an anchor on the right
 * word rather than the right phoneme.
 */
export const buildSpeechPerformancePlan = (
  text: string | undefined,
  phonemes: TimedPhonemeLike[],
  durationSeconds: number
): SpeechPerformancePlan => {
  const spans = voicedSpans(phonemes, durationSeconds);
  const clean = (text ?? "").trim();

  if (!clean || !spans.length) {
    /**
     * Acoustic fallback. Still plans ahead — one mid-span anchor per voiced
     * run — but without lexical structure every clause looks alike, which is
     * exactly the limitation the text removes.
     */
    return {
      utterance: clean,
      durationSeconds,
      fromText: false,
      alignedClauses: 0,
      clauses: spans.map((s, i) => ({
        index: i,
        text: "",
        startsAt: s.start,
        endsAt: s.end,
        ending: "continuing" as const,
        positionInUtterance: spans.length > 1 ? i / (spans.length - 1) : 0,
        anchors: [{ at: s.start + (s.end - s.start) * 0.45, strength: 0.4, character: "emphasis" as const, word: "" }]
      }))
    };
  }

  const clauseTexts = clean.split(/(?<=[,.;:!?])\s+/).filter((c) => c.trim().length > 0);
  const clauses: PlannedClause[] = [];

  /**
   * Clause-to-span alignment by monotone dynamic programming.
   *
   * Three greedy rules were tried and all three drifted, each in a different
   * direction: index-to-index breaks when a comma is not spoken with a pause;
   * merging the "weakest" boundary guesses which comma was silent and picked
   * the wrong one; cumulative word rate is thrown off by a short clause
   * delivered slowly ("Hello," is one word occupying 1.55 s).
   *
   * The assignment is monotone and every clause must land somewhere, which is
   * exactly a shortest-path problem. Cost is the squared mismatch between a
   * clause's expected duration — its share of the words times the total voiced
   * time — and the span time it receives. Solving it globally means one
   * unspoken comma costs one clause a little accuracy instead of shifting
   * everything after it.
   */
  const clauseWords = clauseTexts.map((c) => c.split(/\s+/).filter(Boolean).length);
  const totalWords = Math.max(1, clauseWords.reduce((a, b) => a + b, 0));
  const spanSeconds = spans.map((sp) => sp.end - sp.start);
  const totalSpanSeconds = Math.max(0.001, spanSeconds.reduce((a, b) => a + b, 0));
  const expected = clauseWords.map((w) => (w / totalWords) * totalSpanSeconds);

  const nC = clauseTexts.length, nS = spans.length;
  const INF = Number.POSITIVE_INFINITY;
  // cost[i][j] = best cost assigning clauses 0..i across spans 0..j, clause i in span j.
  const cost: number[][] = Array.from({ length: nC }, () => new Array(nS).fill(INF));
  const from: number[][] = Array.from({ length: nC }, () => new Array(nS).fill(-1));
  /** Clauses sharing a span split its time in proportion to their expected length. */
  const localCost = (i: number, j: number) => {
    const diff = expected[i] - spanSeconds[j];
    return diff * diff;
  };
  for (let j = 0; j < nS; j += 1) cost[0][j] = localCost(0, j) + j * 0.35;
  for (let i = 1; i < nC; i += 1) {
    for (let j = 0; j < nS; j += 1) {
      for (let k = 0; k <= j; k += 1) {
        if (!Number.isFinite(cost[i - 1][k])) continue;
        /**
         * Both directions are penalised. Reuse is allowed, because the text can
         * carry more boundaries than the delivery did — "Hello, my name is
         * David," is spoken across one span with only a 0.09 s gap at the
         * comma. Skipping is penalised harder, because a span with no clause
         * assigned means speech nothing is planned for, which left a four
         * second stretch unattributed.
         */
        const reuse = k === j ? 0.9 : 0;
        const skipped = Math.max(0, j - k - 1) * 4;
        const c = cost[i - 1][k] + localCost(i, j) + reuse + skipped;
        if (c < cost[i][j]) { cost[i][j] = c; from[i][j] = k; }
      }
    }
  }
  let best = 0;
  for (let j = 1; j < nS; j += 1) if (cost[nC - 1][j] < cost[nC - 1][best]) best = j;
  const assignment = new Array(nC).fill(0);
  assignment[nC - 1] = best;
  for (let i = nC - 1; i > 0; i -= 1) assignment[i - 1] = from[i][assignment[i]];
  const count = new Set(assignment).size;

  /**
   * Sub-spans for clauses that share one voiced span.
   *
   * The DP is allowed to put several clauses in one span, and it must be: the
   * text carries more comma boundaries than the delivery paused at. But each
   * clause was then given the WHOLE span, which had two consequences, both
   * measured on the production paragraph:
   *
   *   1. Word times were wrong for every clause in a shared span. "Sarah
   *      thanked the friendly shopkeeper" and "The quick brown fox jumped..."
   *      both spread their words across 19.94-23.72, so "friendly" landed at
   *      21.01 and "jumped" at 21.10 — 90 ms apart, when they are seconds apart
   *      in the audio.
   *   2. Worse, the clauses OVERLAPPED, and `clauseAt` resolves one clause per
   *      instant. 5 of the 20 planned anchors were therefore unreachable — the
   *      conductor could never express them — including the only `contrast`
   *      anchor in the whole utterance.
   *
   * Splitting the span in proportion to each clause's expected duration fixes
   * both. It is a change to how the DP's ASSIGNMENT is turned into times, not to
   * the DP itself: the assignment it produces is unchanged.
   */
  const sharedCounts = new Map<number, number[]>();
  for (let i = 0; i < clauseTexts.length; i += 1) {
    const list = sharedCounts.get(assignment[i]) ?? [];
    list.push(i);
    sharedCounts.set(assignment[i], list);
  }
  const subSpans: { start: number; end: number }[] = new Array(clauseTexts.length);
  for (const [spanIndex, members] of sharedCounts) {
    const sp = spans[spanIndex];
    if (members.length === 1) {
      subSpans[members[0]] = { start: sp.start, end: sp.end };
      continue;
    }
    const totalExpected = members.reduce((a, i) => a + Math.max(0.05, expected[i]), 0);
    let cursor = sp.start;
    for (const i of members) {
      const share = (Math.max(0.05, expected[i]) / totalExpected) * (sp.end - sp.start);
      subSpans[i] = { start: cursor, end: cursor + share };
      cursor += share;
    }
    // Absorb any float drift into the last member so the span is fully covered.
    subSpans[members[members.length - 1]].end = sp.end;
  }

  for (let i = 0; i < clauseTexts.length; i += 1) {
    const span = subSpans[i];
    const words = clauseTexts[i].split(/\s+/).map((w) => w.replace(/[^A-Za-z'-]/g, "")).filter(Boolean);
    if (!words.length) continue;
    const weights = words.map((w) => Math.max(1, w.length));
    const total = weights.reduce((a, b) => a + b, 0);
    const spanSeconds = Math.max(0.001, span.end - span.start);

    // Word times, proportional to length within the clause's real duration.
    let acc = 0;
    const timed = words.map((w, wi) => {
      const startFrac = acc / total;
      acc += weights[wi];
      const endFrac = acc / total;
      return {
        word: w,
        lower: w.toLowerCase(),
        at: span.start + (startFrac + endFrac) / 2 * spanSeconds,
        fraction: (startFrac + endFrac) / 2
      };
    });

    const anchors: PerformanceAnchor[] = [];
    for (const t of timed) {
      if (CONTRAST_WORDS.has(t.lower)) {
        anchors.push({ at: t.at, strength: 0.85, character: "contrast", word: t.word });
      } else if (AFFIRMATION_WORDS.has(t.lower)) {
        anchors.push({ at: t.at, strength: 0.9, character: "affirmation", word: t.word });
      }
    }
    /**
     * Nuclear stress. In an unmarked English clause the main stress falls on
     * the LAST content word, which is where a speaker's head most reliably
     * commits. Length breaks ties, so "backpack" wins over "up".
     */
    const content = timed.filter((t) => !FUNCTION_WORDS.has(t.lower));
    if (content.length) {
      const nuclear = content[content.length - 1];
      const already = anchors.some((a) => Math.abs(a.at - nuclear.at) < 0.18);
      if (!already) {
        const ending = endingOf(clauseTexts[i]);
        anchors.push({
          at: nuclear.at,
          strength: ending === "final" || ending === "exclamation" ? 0.8 : ending === "question" ? 0.7 : 0.55,
          character: ending === "continuing" ? "emphasis" : "closing",
          word: nuclear.word
        });
      }
      // A long clause carries a secondary stress earlier on.
      if (spanSeconds > 2.2 && content.length > 3) {
        const early = content[Math.max(0, Math.floor(content.length * 0.35))];
        if (anchors.every((a) => Math.abs(a.at - early.at) > 0.5)) {
          anchors.push({ at: early.at, strength: 0.4, character: "emphasis", word: early.word });
        }
      }
    }
    anchors.sort((a, b) => a.at - b.at);

    clauses.push({
      index: i,
      text: clauseTexts[i],
      startsAt: span.start,
      endsAt: span.end,
      ending: endingOf(clauseTexts[i]),
      positionInUtterance: clauseTexts.length > 1 ? i / (clauseTexts.length - 1) : 0,
      anchors
    });
  }

  return { utterance: clean, durationSeconds, fromText: true, alignedClauses: count, clauses };
};

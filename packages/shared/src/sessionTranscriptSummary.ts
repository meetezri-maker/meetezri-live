export const SOLACE_TRANSCRIPT_LABEL = "Solace";

export interface TranscriptMessage {
  role: string;
  content: string;
}

const TOPIC_RULES: { topic: string; keywords: string[] }[] = [
  { topic: "anxiety", keywords: ["anxiety", "anxious", "panic", "panicking", "worry", "worried", "overthinking"] },
  { topic: "stress", keywords: ["stress", "stressed", "overwhelmed", "pressure", "burnout"] },
  { topic: "sleep", keywords: ["sleep", "insomnia", "nightmare", "tired", "fatigue", "rest"] },
  { topic: "depression", keywords: ["depressed", "depression", "hopeless", "empty", "sad", "numb"] },
  { topic: "work", keywords: ["work", "job", "boss", "colleague", "meeting", "deadline", "project"] },
  { topic: "career", keywords: ["developer", "interview", "coding", "react", "programming", "hire", "career"] },
  { topic: "relationships", keywords: ["relationship", "partner", "wife", "husband", "boyfriend", "girlfriend", "family"] },
  { topic: "self-esteem", keywords: ["confidence", "self-esteem", "worth", "good enough", "imposter"] },
  { topic: "grief", keywords: ["grief", "loss", "passed away", "funeral", "bereaved"] },
  { topic: "history", keywords: ["history", "pakistan", "coup", "military", "government", "politics"] },
  { topic: "crisis", keywords: ["suicidal", "self-harm", "kill myself", "end it", "hurt myself"] },
];

const TRIVIAL_USER_PATTERNS: RegExp[] = [
  /^you can hear me\.?$/i,
  /^can you hear me\??$/i,
  /^hello[!.]?$/i,
  /^hi[!.]?$/i,
  /^hey[!.]?$/i,
  /^okay[!.]?$/i,
  /^ok[!.]?$/i,
  /^yes[!.]?$/i,
  /^no[!.]?$/i,
  /^thanks?[!.]?$/i,
  /^thank you[!.]?$/i,
  /^i am doing good\.?$/i,
  /^i'm doing good\.?$/i,
  /^doing good\.?$/i,
  /^good[!.]?$/i,
  /^test(ing)?[!.]?$/i,
];

function normalizeTextForTopics(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function formatTopicLabel(topic: string): string {
  return topic.replace(/-/g, " ");
}

function isTrivialUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return true;
  return TRIVIAL_USER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isUserRole(role: string | undefined): boolean {
  const r = role?.toLowerCase();
  return r === "user" || r === "human";
}

export function transcriptSpeakerLabel(role: string): string {
  return isUserRole(role) ? "You" : SOLACE_TRANSCRIPT_LABEL;
}

export function formatTranscriptLine(role: string, content: string): string {
  return `[${transcriptSpeakerLabel(role)}] ${content}`;
}

export function formatTranscriptForSummary(messages: TranscriptMessage[]): string {
  return messages
    .filter((m) => m.content?.trim())
    .map((m) => {
      const label = isUserRole(m.role) ? "User" : SOLACE_TRANSCRIPT_LABEL;
      return `${label}: ${m.content.trim()}`;
    })
    .join("\n");
}

function deriveTopicsFromMessages(messages: TranscriptMessage[]): string[] {
  const allText = normalizeTextForTopics(messages.map((m) => m.content).join(" "));
  const userText = normalizeTextForTopics(
    messages.filter((m) => isUserRole(m.role)).map((m) => m.content).join(" ")
  );

  const scores = new Map<string, number>();
  for (const rule of TOPIC_RULES) {
    let count = 0;
    for (const keyword of rule.keywords) {
      const normalizedKeyword = normalizeTextForTopics(keyword);
      if (!normalizedKeyword) continue;
      const pattern = new RegExp(
        `\\b${normalizedKeyword.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
        "g"
      );
      count += (allText.match(pattern) || []).length;
    }
    if (count > 0) scores.set(rule.topic, count);
  }

  const topics = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);

  if (topics.length > 0) return topics;

  const stop = new Set([
    "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "at", "by", "from", "as",
    "is", "are", "was", "were", "be", "been", "being", "i", "me", "my", "mine", "you", "your", "yours",
    "we", "our", "ours", "they", "their", "them", "he", "she", "it", "this", "that", "these", "those",
    "just", "really", "very", "so", "not", "no", "yes", "yeah", "ok", "okay", "like", "feel", "feels",
    "feeling", "felt", "think", "thinking", "know", "about", "tell", "then", "can", "could", "would",
    "should", "have", "has", "had", "will", "what", "when", "where", "how", "why", "who",
  ]);

  const freq = new Map<string, number>();
  for (const word of userText.split(" ")) {
    if (!word || word.length < 4) continue;
    if (stop.has(word)) continue;
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word);
}

function pickKeyUserTurns(messages: string[], max = 4): string[] {
  if (messages.length === 0) return [];
  if (messages.length <= max) return messages;

  const indices = new Set<number>([0, messages.length - 1]);
  if (messages.length > 2) indices.add(Math.floor(messages.length / 2));
  if (messages.length > 5) {
    indices.add(Math.floor(messages.length / 4));
    indices.add(Math.floor((3 * messages.length) / 4));
  }

  return [...indices]
    .sort((a, b) => a - b)
    .slice(0, max)
    .map((i) => messages[i])
    .filter(Boolean);
}

function clauseFromUserMessage(msg: string): string {
  let text = msg.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  const lower = text.toLowerCase();

  if (
    lower.startsWith("i ") ||
    lower.startsWith("i'm ") ||
    lower.startsWith("i've ") ||
    lower.startsWith("i'd ") ||
    lower.startsWith("i'll ")
  ) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  return `you talked about "${truncate(text, 90)}"`;
}

function formatTopicsNaturally(topics: string[]): string {
  const labels = topics.map(formatTopicLabel);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function buildNarrativeFromTurns(turns: string[]): string {
  if (turns.length === 0) return "";
  const clauses = turns.map(clauseFromUserMessage);

  if (clauses.length === 1) {
    return `You focused on ${clauses[0]}.`;
  }
  if (clauses.length === 2) {
    return `You began by ${clauses[0]}, then ${clauses[1]}.`;
  }

  const last = clauses[clauses.length - 1];
  const middle = clauses.slice(1, -1).map((c) => `then ${c}`).join(", ");
  return `You began by ${clauses[0]}, ${middle}, and finally ${last}.`;
}

/**
 * Heuristic summary from the full transcript (fallback when AI is unavailable).
 */
export function deriveSessionSummaryFromTranscript(messages: TranscriptMessage[]): string {
  const nonEmpty = messages.filter((m) => m.content?.trim());
  if (nonEmpty.length === 0) return "No summary available for this talk.";

  const userMessages = nonEmpty
    .filter((m) => isUserRole(m.role))
    .map((m) => m.content.trim());

  const substantiveUser = userMessages.filter((m) => !isTrivialUserMessage(m));
  const analysisUser = substantiveUser.length > 0 ? substantiveUser : userMessages;
  const topics = deriveTopicsFromMessages(nonEmpty);
  const keyTurns = pickKeyUserTurns(analysisUser, 4);

  const parts: string[] = [];
  const topicStr = formatTopicsNaturally(topics);
  if (topicStr) {
    parts.push(`In this talk, you explored ${topicStr}.`);
  }

  const narrative = buildNarrativeFromTurns(keyTurns);
  if (narrative) parts.push(narrative);

  if (parts.length > 0) return parts.join(" ");

  const firstAssistant = nonEmpty.find((m) => !isUserRole(m.role))?.content.trim();
  if (firstAssistant) return truncate(firstAssistant, 280);

  return "No summary available for this talk.";
}

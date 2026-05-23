/** Native emoji for mood label (keyword match, or first grapheme emoji if the label already contains one). */
export function moodEmojiForLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "🙂";

  try {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
      const seg = new Intl.Segmenter("en", { granularity: "grapheme" });
      for (const { segment } of seg.segment(trimmed)) {
        if (/\p{Extended_Pictographic}/u.test(segment)) return segment;
      }
    } else if (/\p{Extended_Pictographic}/u.test(trimmed)) {
      const m = trimmed.match(/\p{Extended_Pictographic}/gu);
      if (m?.[0]) return m[0];
    }
  } catch {
    /* engine without Unicode property escapes */
  }

  const s = trimmed.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ");
  if (/\b(love|loving|loved)\b/.test(s)) return "🥰";
  if (/\b(happy|joy|great|good|grateful|hopeful|content|cheerful|glad)\b/.test(s))
    return "😊";
  if (/\b(excited|awesome|energized|pumped|elated|thrilled)\b/.test(s)) return "🤩";
  if (/\b(sad|down|blue|depressed|grieving|lonely|gloomy|melancholy)\b/.test(s))
    return "😢";
  if (/\b(angry|mad|furious|frustrated|irritated|rage|annoyed)\b/.test(s))
    return "😠";
  if (/\b(anxious|worried|stressed|nervous|overwhelm|panic|uneasy)\b/.test(s))
    return "😰";
  if (/\b(calm|peaceful|relaxed|okay|ok|fine|steady|serene)\b/.test(s)) return "😌";
  if (/\b(neutral|meh|unsure|mixed|indifferent)\b/.test(s)) return "😐";
  if (/\b(tired|exhausted|sleepy|burnt|weary|fatigue)\b/.test(s)) return "😴";
  if (/\b(bad|rough|terrible|awful|low|cry|crying)\b/.test(s)) return "😭";
  if (/\b(sick|ill|unwell)\b/.test(s)) return "🤒";
  if (/\b(confused|lost)\b/.test(s)) return "😕";

  return "🙂";
}

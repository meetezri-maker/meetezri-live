export interface CommunityPostShareBar {
  label: string;
  value: number;
  displayValue?: string;
}

export interface CommunityPostShareVisual {
  gaugeValue: number;
  gaugeLabel: string;
  title: string;
  bars: CommunityPostShareBar[];
}

const SOLACE_SHARE_HEADER = /sharing from my solace journey/i;

const GROWTH_SCORE_LINE_RE =
  /(?:📈\s*)?(?:my\s+)?growth\s+score[^:\n]*:\s*(\d+)\s*\/\s*100/i;

const AREA_LINE_RE = /^[\s•\-*]*(.+?)\s*:\s*(\d+)\s*%?\s*$/;

const EMOTIONAL_CONSISTENCY_RE =
  /💫\s*Emotional consistency:\s*positive mood on\s*(\d+)\s*of\s*(\d+)\s*days\s*\((\d+)%\)/i;

const ACHIEVEMENTS_HEADER_RE = /🏆\s*Achievements I'm proud of:/i;

const STREAK_PATTERNS = [
  /📅\s*Mood streak:.*?(\d+)\s*days/i,
  /🌟\s*Positive mood streak:\s*(\d+)\s*days/i,
  /🔥\s*Longest streak:\s*(\d+)\s*days/i,
  /Longest mood streak:.*?(\d+)\s*consecutive days/i,
] as const;

const WELLNESS_PCT_RE = /💜\s*Wellness focus:\s*.+?\s*—\s*(\d+)%/i;

const WELLNESS_SESSIONS_RE = /🧘\s*Wellness:\s*(\d+)\s*guided session/i;

const WELLNESS_TOOL_RE = /✨\s*Wellness\s*—\s*(.+?):\s*(\d+)\s*session/i;

const SLEEP_QUALITY_RE = /quality\s*(\d+)%/i;

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function parseGrowthBars(content: string): {
  overallScore: number | null;
  areas: CommunityPostShareBar[];
  stripAreaKeys: Set<string>;
} {
  const scoreMatch = content.match(GROWTH_SCORE_LINE_RE);
  const overallScore = scoreMatch ? Number(scoreMatch[1]) : null;
  const areas: CommunityPostShareBar[] = [];
  const stripAreaKeys = new Set<string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || GROWTH_SCORE_LINE_RE.test(trimmed)) continue;
    const match = trimmed.match(AREA_LINE_RE);
    if (!match) continue;
    const label = match[1]!.trim();
    const value = Math.min(100, Math.max(0, Number(match[2])));
    if (!Number.isFinite(value)) continue;
    stripAreaKeys.add(normalizeLabel(label));
    areas.push({ label, value, displayValue: `${value}%` });
  }

  return {
    overallScore:
      overallScore != null && Number.isFinite(overallScore)
        ? Math.min(100, Math.max(0, Math.round(overallScore)))
        : null,
    areas,
    stripAreaKeys,
  };
}

function postHasShareMetrics(text: string): boolean {
  if (SOLACE_SHARE_HEADER.test(text)) return true;
  if (GROWTH_SCORE_LINE_RE.test(text)) return true;
  if (EMOTIONAL_CONSISTENCY_RE.test(text)) return true;
  if (ACHIEVEMENTS_HEADER_RE.test(text)) return true;
  if (SLEEP_QUALITY_RE.test(text)) return true;
  if (WELLNESS_PCT_RE.test(text) || WELLNESS_SESSIONS_RE.test(text)) return true;
  return STREAK_PATTERNS.some((p) => p.test(text));
}

/** Parse metrics from post body text for the feed wheel chart. */
export function parseCommunityPostShare(content: string): CommunityPostShareVisual | null {
  const text = (content ?? "").trim();
  if (!text || !postHasShareMetrics(text)) return null;

  const bars: CommunityPostShareBar[] = [];
  let gaugeValue: number | null = null;
  let gaugeLabel = "";
  let title = "My progress";

  const growth = parseGrowthBars(text);
  if (growth.overallScore != null || growth.areas.length > 0) {
    title = "Growth score";
    gaugeValue = growth.overallScore ?? Math.round(
      growth.areas.reduce((s, a) => s + a.value, 0) / Math.max(growth.areas.length, 1),
    );
    gaugeLabel = "Growth / 100";
    bars.push(...growth.areas);
  }

  const consistency = text.match(EMOTIONAL_CONSISTENCY_RE);
  if (consistency) {
    const positive = Number(consistency[1]);
    const total = Number(consistency[2]);
    const pct = Math.min(100, Math.max(0, Number(consistency[3])));
    if (gaugeValue == null) {
      gaugeValue = pct;
      gaugeLabel = `${positive}/${total} days`;
      title = "Emotional consistency";
    }
    bars.push({
      label: "Positive mood days",
      value: pct,
      displayValue: `${positive}/${total}`,
    });
  }

  const achievementsIdx = text.search(ACHIEVEMENTS_HEADER_RE);
  if (achievementsIdx >= 0) {
    const afterHeader = text.slice(achievementsIdx).split("\n").slice(1);
    const milestones: string[] = [];
    for (const line of afterHeader) {
      const trimmed = line.trim();
      if (!trimmed) break;
      const bullet = trimmed.match(/^[\s•\-*]+\s*(.+)$/);
      if (!bullet) break;
      milestones.push(bullet[1]!.trim());
    }
    if (milestones.length > 0) {
      if (gaugeValue == null) {
        gaugeValue = Math.min(100, milestones.length * 25);
        gaugeLabel = `${milestones.length} unlocked`;
        title = "Achievements";
      }
      for (const milestone of milestones) {
        bars.push({
          label: milestone.length > 28 ? `${milestone.slice(0, 27)}…` : milestone,
          value: 100,
        });
      }
    }
  }

  let streakDays: number | null = null;
  for (const pattern of STREAK_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      streakDays = Number(m[1]);
      break;
    }
  }
  if (streakDays != null && Number.isFinite(streakDays)) {
    const days = streakDays;
    const pct = Math.min(100, Math.round((days / 30) * 100));
    if (gaugeValue == null) {
      gaugeValue = pct;
      gaugeLabel = `${days} day streak`;
      title = "Streak";
    }
    bars.push({ label: "Current streak", value: pct, displayValue: `${days}d` });
  }

  const wellnessPct = text.match(WELLNESS_PCT_RE);
  if (wellnessPct) {
    const pct = Number(wellnessPct[1]);
    if (gaugeValue == null) {
      gaugeValue = pct;
      gaugeLabel = "Wellness focus";
      title = "Wellness";
    }
    bars.push({ label: "Focus area", value: pct, displayValue: `${pct}%` });
  }

  const wellnessSessions = text.match(WELLNESS_SESSIONS_RE);
  if (wellnessSessions) {
    const count = Number(wellnessSessions[1]);
    const pct = Math.min(100, count * 12);
    if (gaugeValue == null) {
      gaugeValue = pct;
      gaugeLabel = `${count} sessions`;
      title = "Wellness";
    }
    bars.push({ label: "Guided sessions", value: pct, displayValue: String(count) });
  }

  for (const line of text.split("\n")) {
    const tool = line.trim().match(WELLNESS_TOOL_RE);
    if (!tool) continue;
    const count = Number(tool[2]);
    const pct = Math.min(100, count * 15);
    bars.push({
      label: tool[1]!.trim(),
      value: pct,
      displayValue: `${count}`,
    });
  }

  const sleepMatch = text.match(SLEEP_QUALITY_RE);
  if (sleepMatch) {
    const pct = Number(sleepMatch[1]);
    if (gaugeValue == null) {
      gaugeValue = pct;
      gaugeLabel = "Sleep quality";
      title = "Sleep";
    }
    bars.push({ label: "Sleep quality", value: pct, displayValue: `${pct}%` });
  }

  if (bars.length === 0 && gaugeValue == null) return null;

  return {
    gaugeValue: gaugeValue ?? bars[0]!.value,
    gaugeLabel: gaugeLabel || `${bars[0]!.displayValue ?? bars[0]!.value}%`,
    title,
    bars,
  };
}

/** Full post text stays visible; chart is parsed separately from the same content. */
export function communityPostShareFromContent(content: string): CommunityPostShareVisual | null {
  return parseCommunityPostShare(content);
}

/** Bar colors aligned with Progress → Top Areas of Growth. */
export function shareBarStyle(label: string, index: number): {
  barClass: string;
  dotClass: string;
  glow: string;
} {
  const key = normalizeLabel(label);
  if (key.includes("emotional") || key.includes("positive mood")) {
    return {
      barClass: "bg-gradient-to-r from-purple-500 to-purple-400",
      dotClass: "bg-purple-400",
      glow: "rgba(168, 85, 247, 0.5)",
    };
  }
  if (key.includes("consistency") || key.includes("streak")) {
    return {
      barClass: "bg-gradient-to-r from-pink-500 to-pink-400",
      dotClass: "bg-pink-400",
      glow: "rgba(236, 72, 153, 0.45)",
    };
  }
  if (key.includes("reflection") || key.includes("journal")) {
    return {
      barClass: "bg-gradient-to-r from-cyan-500 to-cyan-400",
      dotClass: "bg-cyan-400",
      glow: "rgba(34, 211, 238, 0.45)",
    };
  }
  if (key.includes("mindfulness") || key.includes("wellness") || key.includes("session")) {
    return {
      barClass: "bg-gradient-to-r from-amber-500 to-amber-400",
      dotClass: "bg-amber-400",
      glow: "rgba(251, 191, 36, 0.45)",
    };
  }
  if (key.includes("sleep")) {
    return {
      barClass: "bg-gradient-to-r from-green-500 to-green-400",
      dotClass: "bg-green-400",
      glow: "rgba(74, 222, 128, 0.45)",
    };
  }
  const palette = [
    { barClass: "bg-gradient-to-r from-violet-500 to-fuchsia-400", dotClass: "bg-violet-400", glow: "rgba(192, 132, 252, 0.45)" },
    { barClass: "bg-gradient-to-r from-indigo-500 to-violet-400", dotClass: "bg-indigo-400", glow: "rgba(129, 140, 248, 0.45)" },
    { barClass: "bg-gradient-to-r from-fuchsia-500 to-pink-400", dotClass: "bg-fuchsia-400", glow: "rgba(232, 121, 249, 0.45)" },
  ];
  return palette[index % palette.length]!;
}

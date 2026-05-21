import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Brain,
  Briefcase,
  Check,
  CircleHelp,
  Cloud,
  Gauge,
  Heart,
  HelpCircle,
  Info,
  ListTodo,
  Loader2,
  Lock,
  MessageCircle,
  Orbit,
  Play,
  Shield,
  Sparkles,
  Target,
  Users,
  Waves,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { SolaceSupportStrip } from "@/app/solace";
import type { HelpPath, LoadItem, MentalClimate } from "./brainHealthPersistedTypes";
import {
  CHOICES_BY_STEP,
  choiceIdFromLoads,
  GUIDED_QUESTIONS,
  GUIDED_STEP_COUNT,
  type ReflectionChoice,
  type ReflectionIconKey,
} from "./reflectionFlowConfig";
import {
  BrainHealthRightRail,
  type BrainHealthClarityRange,
  type BrainHealthRailTimeFilter,
} from "./BrainHealthRightRail";
import {
  computeClarityPercent,
  computeCognitiveEnergy,
  computeFocusWindow,
  computeMentalRecovery,
  buildClarityChartSeries,
  dailySparklinePoints,
  hasBrainHealthReflectionSignal,
  parseMoodEntries,
  parseSessions,
  parseSleepEntries,
  railFilterDayCount,
  rangeStartForClarity,
  rangeStartForFilter,
  sessionCountSparkline,
} from "./brainHealthRailMetrics";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { BRAIN_HEALTH_IMAGES } from "@/lib/solace/brainHealthImages";

type ExcludeHelpNull = "clear_head" | "slow_down" | "hold_together";
type SaveStatus = "idle" | "saving" | "saved" | "error";

type BrainHealthSettingsPayload = {
  mentalClimate: MentalClimate;
  selectedLoads: LoadItem[];
  selectedPath: ExcludeHelpNull | null;
  reflectionChoices?: Record<number, string>;
  reflectionFlowComplete?: boolean;
  usagePattern?: Record<string, unknown>;
  updatedAt: string;
};

const CLIMATE_STORAGE_KEY = "ezri_mental_climate";
const LOADS_STORAGE_KEY = "ezri_selected_loads";
const USAGE_STORAGE_KEY = "ezri_usage_pattern";
const PATH_STORAGE_KEY = "ezri_selected_path";

const CLIMATES: Array<{ id: MentalClimate; label: string; line: string; sub: string }> = [
  {
    id: "overfull",
    label: "Overfull",
    line: "Your mind feels a little overfull today.",
    sub: "Not broken. Just carrying too much at once.",
  },
  {
    id: "scattered",
    label: "Scattered",
    line: "Your attention is getting pulled in too many directions.",
    sub: "It's hard to land anywhere.",
  },
  {
    id: "heavy",
    label: "Heavy",
    line: "Everything feels heavier than it should.",
    sub: "Even simple things take effort.",
  },
  {
    id: "clear",
    label: "Clear",
    line: "Your mind feels open and steady.",
    sub: "This is a good space to use well.",
  },
  {
    id: "foggy",
    label: "Foggy",
    line: "Things feel unclear and a bit slow.",
    sub: "Like your thoughts are not fully landing.",
  },
  {
    id: "restless",
    label: "Restless",
    line: "Your mind will not sit still.",
    sub: "There is a constant internal movement.",
  },
  {
    id: "steady",
    label: "Steady",
    line: "You feel balanced right now.",
    sub: "Nothing is pulling too hard.",
  },
];

const LOAD_ITEMS: LoadItem[] = [
  "Too many open loops",
  "Decision fatigue",
  "Emotional carryover",
  "Pressure to keep up",
  "Mental clutter",
  "Social drain",
];

const INSIGHT_BY_LOAD: Partial<Record<LoadItem, string>> = {
  "Too many open loops": "You're not overwhelmed, you have too many unfinished thoughts.",
  "Decision fatigue": "Your mind is tired of deciding, not thinking.",
  "Mental clutter": "You do not need more effort, you need less noise.",
  "Pressure to keep up": "You're carrying pressure that is not helping you move forward.",
  "Emotional carryover": "Something from earlier is still sitting with you.",
};

const CLIMATE_AURA: Record<MentalClimate, string> = {
  clear: "from-sky-100/50 via-transparent to-cyan-100/30 dark:from-sky-900/25 dark:to-cyan-950/20",
  foggy: "from-slate-200/50 via-transparent to-zinc-200/35 dark:from-slate-800/30 dark:to-zinc-900/20",
  heavy: "from-violet-200/45 via-transparent to-slate-300/35 dark:from-violet-900/25 dark:to-slate-900/35",
  scattered: "from-amber-100/45 via-transparent to-rose-100/35 dark:from-amber-900/20 dark:to-rose-950/20",
  overfull: "from-primary/20 via-fuchsia-200/20 to-orange-100/25 dark:from-primary/20 dark:to-orange-900/20",
  steady: "from-emerald-100/45 via-transparent to-sky-100/35 dark:from-emerald-900/20 dark:to-sky-900/20",
  restless: "from-indigo-100/45 via-transparent to-violet-100/35 dark:from-indigo-900/20 dark:to-violet-900/25",
};

const HELP_PATHS: Array<{ id: ExcludeHelpNull; label: string }> = [
  { id: "clear_head", label: "Clear my head" },
  { id: "slow_down", label: "Slow me down" },
  { id: "hold_together", label: "Help me hold it together" },
];

const EZRI_RESPONSE: Record<ExcludeHelpNull, string> = {
  clear_head: "You've been carrying too many unfinished thoughts. Let's reduce the mental weight.",
  slow_down: "You don't need to speed up. You need to soften the pace.",
  hold_together: "You're doing more than it looks. Let's stabilize things first.",
};

const NEXT_STEP: Record<ExcludeHelpNull, string> = {
  clear_head: "Close one open loop.",
  slow_down: "Reduce inputs for 10 minutes.",
  hold_together: "Focus on just one thing.",
};

const REFLECTION_ICONS: Record<ReflectionIconKey, LucideIcon> = {
  loops: Orbit,
  overthink: Brain,
  info: Info,
  heart: Heart,
  decision: Target,
  clutter: ListTodo,
  other: HelpCircle,
  bell: Bell,
  weight: Waves,
  list: ListTodo,
  sparkle: Sparkles,
  battery: Zap,
  help: HelpCircle,
  gauge: Gauge,
  cloud: Cloud,
  pin: Target,
  message: MessageCircle,
  orbit: Orbit,
  briefcase: Briefcase,
  users: Users,
  mist: Cloud,
  shield: Shield,
};

function getTimeBasedDefaultClimate(): MentalClimate {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "clear";
  if (hour >= 12 && hour < 18) return "steady";
  if (hour >= 18 && hour < 22) return "overfull";
  return "heavy";
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function buildInsight(loads: LoadItem[]): string {
  for (const item of loads) {
    if (INSIGHT_BY_LOAD[item]) return INSIGHT_BY_LOAD[item]!;
  }
  return "Your mind is asking for a lighter load right now.";
}

/** Local-only boosts from wizard choice ids for live mental state. */
function wizardChoiceBoosts(choices: Record<number, string>): { loops: number; fatigue: number; info: number; emotional: number } {
  const b = { loops: 0, fatigue: 0, info: 0, emotional: 0 };
  const v = Object.values(choices);
  for (const id of v) {
    if (!id) continue;
    if (id.startsWith("q1-")) {
      if (id === "q1-loops" || id === "q1-overthink" || id === "q1-clutter") b.loops += 10;
      if (id === "q1-decision" || id === "q1-overthink") b.fatigue += 8;
      if (id === "q1-info") b.info += 12;
      if (id === "q1-emotional") b.emotional += 14;
      if (id === "q1-other") b.fatigue += 4;
    }
    if (id.startsWith("q2-")) {
      b.fatigue += 6;
      if (id === "q2-interrupt") b.info += 8;
      if (id === "q2-emotion") b.emotional += 10;
      if (id === "q2-tasks") b.loops += 10;
    }
    if (id.startsWith("q3-")) {
      b.emotional += 3;
      if (id === "q3-input") b.info += 6;
    }
    if (id.startsWith("q4-")) {
      if (id === "q4-hard" || id === "q4-murky" || id === "q4-loud") b.fatigue += 8;
      if (id === "q4-fog") b.loops += 4;
    }
    if (id.startsWith("q5-")) {
      b.loops += 5;
      if (id === "q5-future" || id === "q5-control") b.emotional += 8;
    }
  }
  return b;
}

export function BrainHealthPage() {
  const { user, profile } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [mentalClimate, setMentalClimate] = useState<MentalClimate>(getTimeBasedDefaultClimate);
  const [selectedLoads, setSelectedLoads] = useState<LoadItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<HelpPath>(null);
  const [returnLineVisible, setReturnLineVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hydrated, setHydrated] = useState(false);
  const [reflectionStep, setReflectionStep] = useState(0);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState(0);
  const [reflectionFlowComplete, setReflectionFlowComplete] = useState(false);
  const [railTimeFilter, setRailTimeFilter] = useState<BrainHealthRailTimeFilter>("today");
  const [clarityRange, setClarityRange] = useState<BrainHealthClarityRange>("week");
  const [localChoiceByStep, setLocalChoiceByStep] = useState<Record<number, string>>({});
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const { data: moodsRaw } = useQuery({
    queryKey: ["moods", "me", user?.id],
    queryFn: () => api.moods.getMyMoods(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const { data: sleepRaw } = useQuery({
    queryKey: ["sleep", "entries", user?.id],
    queryFn: () => api.sleep.getEntries(),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const { data: sessionsRaw } = useQuery({
    queryKey: queryKeys.sessions.list({ status: "completed", limit: 50 }),
    queryFn: () => api.sessions.list({ status: "completed", limit: 50 }),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const moodEntries = useMemo(() => {
    const rows = parseMoodEntries(moodsRaw);
    return [...rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [moodsRaw]);
  const sleepEntries = useMemo(() => parseSleepEntries(sleepRaw), [sleepRaw]);
  const sessionEntries = useMemo(() => parseSessions(sessionsRaw), [sessionsRaw]);

  const returnLineTimer = useRef<number | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const liveMentalStateRef = useRef<HTMLElement | null>(null);
  const saveTimer = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const activeClimate = useMemo(() => CLIMATES.find((c) => c.id === mentalClimate) ?? CLIMATES[0], [mentalClimate]);
  const derivedInsight = useMemo(() => buildInsight(selectedLoads), [selectedLoads]);

  const brainLoad = useMemo(() => {
    const count = selectedLoads.length;
    const noise = Math.min(
      100,
      24 + count * 22 + (mentalClimate === "scattered" ? 12 : 0) + (mentalClimate === "overfull" ? 8 : 0)
    );
    const pressure = Math.min(
      100,
      20 + count * 20 + (mentalClimate === "heavy" ? 18 : 0) + (mentalClimate === "restless" ? 10 : 0)
    );
    const clarityBase = count > 2 ? 34 : count > 1 ? 50 : 66;
    const climatePenalty =
      mentalClimate === "foggy" || mentalClimate === "overfull"
        ? 10
        : mentalClimate === "clear" || mentalClimate === "steady"
          ? -8
          : 0;
    const clarity = Math.max(12, Math.min(90, clarityBase - climatePenalty));
    return { noise, pressure, clarity };
  }, [mentalClimate, selectedLoads]);

  const wizardBoosts = useMemo(() => wizardChoiceBoosts(localChoiceByStep), [localChoiceByStep]);

  const hasReflectionSignal = useMemo(
    () =>
      hasBrainHealthReflectionSignal({
        selectedLoadsCount: selectedLoads.length,
        reflectionChoicesCount: Object.keys(localChoiceByStep).length,
        reflectionFlowComplete,
        selectedPath: Boolean(selectedPath),
        moodsInPeriod: moodEntries.filter((m) => {
          const d = new Date(m.created_at);
          return !Number.isNaN(d.getTime()) && d >= rangeStartForFilter("last_week");
        }).length,
        sleepLogsInPeriod: sleepEntries.filter((e) => {
          const d = new Date(e.wake_time);
          return !Number.isNaN(d.getTime()) && d >= rangeStartForFilter("last_week");
        }).length,
      }),
    [
      selectedLoads.length,
      localChoiceByStep,
      reflectionFlowComplete,
      selectedPath,
      moodEntries,
      sleepEntries,
    ]
  );

  const focusWindowLines = useMemo(
    () => computeFocusWindow(sessionEntries, moodEntries, railTimeFilter),
    [sessionEntries, moodEntries, railTimeFilter]
  );

  const focusSparklinePoints = useMemo(() => {
    const start = rangeStartForFilter(railTimeFilter);
    const days = railFilterDayCount(railTimeFilter);
    const sessionLine = sessionCountSparkline(sessionEntries, start, days);
    const hasSessions = sessionLine.some((p) => p > 0.15);
    if (hasSessions) return sessionLine;
    return dailySparklinePoints(moodEntries, start, days);
  }, [moodEntries, railTimeFilter, sessionEntries]);

  const clarityChartSeries = useMemo(
    () => buildClarityChartSeries(moodEntries, clarityRange),
    [clarityRange, moodEntries]
  );

  const liveMental = useMemo(() => {
    const { noise, clarity } = brainLoad;
    const stressSignal = wizardBoosts.loops + wizardBoosts.fatigue + wizardBoosts.emotional;

    let res: { title: string; body: string; tags: string[] };

    if (stressSignal >= 28 && noise >= 52) {
      res = {
        title: "Mentally overloaded",
        body: "Your mind is carrying more than it can easily process. Some rest, release, and reset will help.",
        tags: ["High Mental Load", "Low Clarity"],
      };
    } else if (noise >= 58) {
      res = {
        title: "Carrying a lot",
        body: "There is real weight here — not failure, just load. Small releases add up.",
        tags: ["Elevated load", clarity < 52 ? "Clarity soft" : "Clarity steady"].filter(Boolean) as string[],
      };
    } else if (clarity >= 72 && noise <= 42) {
      res = {
        title: "Steadier than it may feel",
        body: "Even quiet focus counts. You do not have to feel sharp to be okay right now.",
        tags: ["Breathing room", "Gentle focus"],
      };
    } else {
      res = {
        title: activeClimate.label,
        body: `${activeClimate.line} ${activeClimate.sub}`,
        tags: [activeClimate.label, mentalClimate === "foggy" || mentalClimate === "heavy" ? "Needs softness" : "In motion"],
      };
    }

    if (reflectionFlowComplete) {
      return {
        ...res,
        body: `${res.body} You've completed this guided round — stay as long as you need.`,
        tags: [...res.tags.filter((t) => t !== "Reflection complete"), "Reflection complete"],
      };
    }
    return res;
  }, [activeClimate, brainLoad, mentalClimate, reflectionFlowComplete, wizardBoosts]);

  const cognitiveEnergy = useMemo(
    () => computeCognitiveEnergy(moodEntries, mentalClimate, railTimeFilter),
    [mentalClimate, moodEntries, railTimeFilter]
  );

  const mentalRecovery = useMemo(
    () => computeMentalRecovery(sleepEntries, brainLoad.clarity, railTimeFilter),
    [brainLoad.clarity, railTimeFilter, sleepEntries]
  );

  const clarityPercent = useMemo(
    () => computeClarityPercent(brainLoad, moodEntries, clarityRange),
    [brainLoad, clarityRange, moodEntries]
  );

  const insightRows = useMemo(() => {
    const rows: Array<{
      key: string;
      text: string;
      date: string;
      Icon: LucideIcon;
      iconWrap: string;
    }> = [];
    if (derivedInsight && selectedLoads.length > 0) {
      rows.push({
        key: "ins-1",
        text: derivedInsight,
        date: "Today",
        Icon: Sparkles,
        iconWrap: "bg-violet-500/15 text-violet-200",
      });
    }
    if (selectedPath) {
      rows.push({
        key: "ins-path",
        text: EZRI_RESPONSE[selectedPath],
        date: "Today",
        Icon: Heart,
        iconWrap: "bg-rose-500/12 text-rose-100",
      });
    }
    if (activeClimate && selectedLoads.length > 0) {
      rows.push({
        key: "ins-climate",
        text: activeClimate.line,
        date: "Today",
        Icon: Brain,
        iconWrap: "bg-cyan-500/12 text-cyan-100",
      });
    }
    const latestMood = moodEntries[0];
    if (latestMood) {
      const d = new Date(latestMood.created_at);
      if (!Number.isNaN(d.getTime())) {
        rows.push({
          key: "ins-mood",
          text: `Latest check-in intensity ${typeof latestMood.intensity === "number" ? latestMood.intensity : "—"}/10.`,
          date: format(d, "MMM d"),
          Icon: Heart,
          iconWrap: "bg-fuchsia-500/12 text-fuchsia-100",
        });
      }
    }
    return rows.slice(0, 3);
  }, [activeClimate, derivedInsight, moodEntries, selectedLoads.length, selectedPath]);

  useEffect(() => {
    const profileSettings = (profile?.brain_health_settings ?? null) as Partial<BrainHealthSettingsPayload> | null;
    const savedClimate = localStorage.getItem(CLIMATE_STORAGE_KEY) as MentalClimate | null;
    const localUpdatedAt = safeParse<{ updatedAt?: string }>(localStorage.getItem(USAGE_STORAGE_KEY))?.updatedAt;
    const remoteUpdatedAt = typeof profileSettings?.updatedAt === "string" ? profileSettings.updatedAt : null;
    const useRemote =
      Boolean(profileSettings) &&
      (!localUpdatedAt || !remoteUpdatedAt || new Date(remoteUpdatedAt).getTime() >= new Date(localUpdatedAt).getTime());

    if (useRemote && profileSettings?.mentalClimate && CLIMATES.some((c) => c.id === profileSettings.mentalClimate)) {
      setMentalClimate(profileSettings.mentalClimate);
    } else if (savedClimate && CLIMATES.some((c) => c.id === savedClimate)) {
      setMentalClimate(savedClimate);
    }

    const savedLoads = safeParse<LoadItem[]>(localStorage.getItem(LOADS_STORAGE_KEY));
    let nextLoads: LoadItem[] = [];
    if (useRemote && Array.isArray(profileSettings?.selectedLoads)) {
      nextLoads = profileSettings.selectedLoads
        .filter((item): item is LoadItem => LOAD_ITEMS.includes(item as LoadItem))
        .slice(0, 3);
      setSelectedLoads(nextLoads);
    } else if (savedLoads && Array.isArray(savedLoads)) {
      nextLoads = savedLoads.filter((item): item is LoadItem => LOAD_ITEMS.includes(item as LoadItem)).slice(0, 3);
      setSelectedLoads(nextLoads);
    }

    const savedPath = localStorage.getItem(PATH_STORAGE_KEY) as HelpPath;
    if (useRemote && profileSettings?.selectedPath && HELP_PATHS.some((p) => p.id === profileSettings.selectedPath)) {
      setSelectedPath(profileSettings.selectedPath);
    } else if (savedPath && HELP_PATHS.some((p) => p.id === savedPath)) {
      setSelectedPath(savedPath);
    }

    if (useRemote && profileSettings?.reflectionChoices && typeof profileSettings.reflectionChoices === "object") {
      const choices = profileSettings.reflectionChoices as Record<string, string>;
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(choices)) {
        const idx = Number(k);
        if (Number.isInteger(idx) && typeof v === "string") next[idx] = v;
      }
      if (Object.keys(next).length > 0) setLocalChoiceByStep(next);
    }

    if (useRemote && profileSettings?.reflectionFlowComplete === true) {
      setReflectionFlowComplete(true);
    }

    setHydrated(true);
  }, [profile?.brain_health_settings]);

  useEffect(() => {
    if (!hydrated) return;
    setLocalChoiceByStep((prev) => {
      if (prev[0]) return prev;
      const id = choiceIdFromLoads(selectedLoads);
      if (id) return { ...prev, 0: id };
      return prev;
    });
  }, [hydrated, selectedLoads]);

  useEffect(() => {
    localStorage.setItem(CLIMATE_STORAGE_KEY, mentalClimate);
  }, [mentalClimate]);

  useEffect(() => {
    localStorage.setItem(LOADS_STORAGE_KEY, JSON.stringify(selectedLoads));
  }, [selectedLoads]);

  useEffect(() => {
    if (selectedPath) localStorage.setItem(PATH_STORAGE_KEY, selectedPath);
  }, [selectedPath]);

  useEffect(() => {
    const usage = safeParse<Record<string, unknown>>(localStorage.getItem(USAGE_STORAGE_KEY)) ?? {};
    const updated = {
      ...usage,
      visits: typeof usage.visits === "number" ? usage.visits + 1 : 1,
      lastClimate: mentalClimate,
      lastSeenAt: new Date().toISOString(),
    };
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(updated));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated || !user?.id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveStatus("saving");

    saveTimer.current = window.setTimeout(() => {
      const usage = safeParse<Record<string, unknown>>(localStorage.getItem(USAGE_STORAGE_KEY)) ?? {};
      const payload: BrainHealthSettingsPayload = {
        mentalClimate,
        selectedLoads,
        selectedPath,
        reflectionChoices: localChoiceByStep,
        reflectionFlowComplete,
        usagePattern: usage,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify({ ...usage, updatedAt: payload.updatedAt }));

      void api
        .updateProfile({ brain_health_settings: payload })
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"))
        .finally(() => {
          saveTimer.current = null;
        });
    }, 700);
  }, [hydrated, user?.id, mentalClimate, selectedLoads, selectedPath, localChoiceByStep, reflectionFlowComplete]);

  useEffect(() => {
    return () => {
      if (returnLineTimer.current) window.clearTimeout(returnLineTimer.current);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const applyChoiceEffects = useCallback((stepIndex: number, choice: ReflectionChoice) => {
    setLocalChoiceByStep((prev) => ({ ...prev, [stepIndex]: choice.id }));
    if (stepIndex === 0) {
      if (choice.loadItem && LOAD_ITEMS.includes(choice.loadItem)) {
        setSelectedLoads([choice.loadItem]);
      } else {
        setSelectedLoads([]);
      }
    }
    if (choice.mentalClimate && CLIMATES.some((c) => c.id === choice.mentalClimate)) {
      setMentalClimate(choice.mentalClimate);
    }
  }, []);

  const handleSelectChoice = useCallback(
    (choice: ReflectionChoice) => {
      const stepIndex = reflectionStep;
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      applyChoiceEffects(stepIndex, choice);
      const delay = reducedMotion ? 0 : 280 + Math.floor(Math.random() * 100);
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        if (stepIndex < GUIDED_STEP_COUNT - 1) {
          setReflectionStep(stepIndex + 1);
          setMaxAccessibleStep((m) => Math.max(m, stepIndex + 1));
        } else {
          setReflectionFlowComplete(true);
          setMaxAccessibleStep((m) => Math.max(m, GUIDED_STEP_COUNT - 1));
        }
      }, delay);
    },
    [applyChoiceEffects, reducedMotion, reflectionStep]
  );

  const handleStepCardClick = useCallback(
    (idx: number) => {
      if (idx > maxAccessibleStep) return;
      if (idx > reflectionStep && localChoiceByStep[idx] == null) return;
      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      setReflectionStep(idx);
    },
    [maxAccessibleStep, reflectionStep, localChoiceByStep]
  );

  const handleWizardBack = useCallback(() => {
    if (reflectionStep <= 0) return;
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setReflectionFlowComplete(false);
    setReflectionStep((s) => Math.max(0, s - 1));
  }, [reflectionStep]);

  const scrollToLiveMentalState = useCallback(() => {
    const el = liveMentalStateRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }, [reducedMotion]);

  const handleWizardNext = useCallback(() => {
    if (!localChoiceByStep[reflectionStep]) return;
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (reflectionStep >= GUIDED_STEP_COUNT - 1) {
      setReflectionFlowComplete(true);
      window.requestAnimationFrame(() => scrollToLiveMentalState());
      return;
    }
    setReflectionStep((s) => s + 1);
    setMaxAccessibleStep((m) => Math.max(m, reflectionStep + 1));
  }, [localChoiceByStep, reflectionStep, scrollToLiveMentalState]);

  const handleWizardDotClick = useCallback(
    (idx: number) => {
      if (idx > maxAccessibleStep) return;
      if (idx > reflectionStep && localChoiceByStep[idx] == null) return;
      handleStepCardClick(idx);
    },
    [handleStepCardClick, maxAccessibleStep, reflectionStep, localChoiceByStep]
  );

  const handleSelectPath = useCallback(
    (path: ExcludeHelpNull) => {
      setSelectedPath(path);
      setReturnLineVisible(false);
      if (!reducedMotion) {
        responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [reducedMotion]
  );

  const showReturnLine = useCallback(() => {
    setReturnLineVisible(true);
    if (returnLineTimer.current) window.clearTimeout(returnLineTimer.current);
    returnLineTimer.current = window.setTimeout(() => {
      setReturnLineVisible(false);
      returnLineTimer.current = null;
    }, 3200);
  }, []);

  const currentQuestion = GUIDED_QUESTIONS[reflectionStep] ?? GUIDED_QUESTIONS[0];
  const currentChoices = CHOICES_BY_STEP[reflectionStep] ?? CHOICES_BY_STEP[0];
  const selectedChoiceId = localChoiceByStep[reflectionStep] ?? null;
  const progressFraction = reflectionFlowComplete ? 1 : (reflectionStep + 1) / GUIDED_STEP_COUNT;
  const progressLabelCurrent = reflectionFlowComplete ? GUIDED_STEP_COUNT : reflectionStep + 1;
  const currentStepHasAnswer = Boolean(localChoiceByStep[reflectionStep]);
  const isLastReflectionStep = reflectionStep >= GUIDED_STEP_COUNT - 1;
  const nextBubbleDisabled = !currentStepHasAnswer;

  const helpTools: Array<{
    id: string;
    title: string;
    sub: string;
    duration: string;
    to: string;
    pathId: ExcludeHelpNull;
    Icon: LucideIcon;
    accent: string;
  }> = [
    {
      id: "focus-reset",
      title: "Focus Reset",
      sub: "Clear mental noise and break the loop.",
      duration: "5–10 min",
      to: "/app/wellness-tools",
      pathId: "clear_head",
      Icon: Zap,
      accent: "shadow-[0_0_24px_rgba(167,139,250,0.18)] border-violet-500/20",
    },
    {
      id: "nervous-calm",
      title: "Nervous System Calm",
      sub: "Soothing tools to calm your body and mind.",
      duration: "5–15 min",
      to: "/app/wellness-tools",
      pathId: "slow_down",
      Icon: Waves,
      accent: "shadow-[0_0_24px_rgba(34,211,238,0.14)] border-cyan-500/20",
    },
    {
      id: "declutter",
      title: "Mental Declutter",
      sub: "Organize your thoughts and regain clarity.",
      duration: "10–15 min",
      to: "/app/wellness-tools",
      pathId: "hold_together",
      Icon: ListTodo,
      accent: "shadow-[0_0_24px_rgba(251,191,36,0.12)] border-amber-400/20",
    },
    {
      id: "journal",
      title: "Reflection Journal",
      sub: "Write it out to let it go and understand more.",
      duration: "5–10 min",
      to: "/app/journal",
      pathId: "clear_head",
      Icon: BookOpen,
      accent: "shadow-[0_0_24px_rgba(244,63,94,0.12)] border-rose-400/20",
    },
  ];

  return (
    <div
      className={cn(
        "relative min-h-full pb-6 transition-[filter,background-color] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "bg-gradient-to-b from-[#05060d] via-[#070a14] to-[#03040a]",
        selectedPath === "slow_down" && "[filter:saturate(0.95)_brightness(0.98)]"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br opacity-[0.55] transition-all duration-[1000ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          CLIMATE_AURA[mentalClimate]
        )}
      />

      <div className="relative z-[1] mx-auto max-w-[1400px] px-4 pb-8 pt-5 md:px-6 md:pt-7 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/80 to-slate-950/90 shadow-[0_0_28px_rgba(139,92,246,0.25)]">
              <Brain className="h-6 w-6 text-violet-200/95" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-[1.65rem]">Brain Health</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
                Understand your mental load, clarity, and emotional balance.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end md:flex-row md:items-center">
            <p className="order-last text-[11px] text-zinc-500 sm:order-none" aria-live="polite">
              {saveStatus === "saving" && (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Saving…
                </span>
              )}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Sync issue — we’ll retry"}
              {saveStatus === "idle" && hydrated ? <span className="sr-only">Ready</span> : null}
            </p>
            <button
              type="button"
              onClick={() => setHowItWorksOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-violet-400/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
            >
              <CircleHelp className="h-4 w-4 text-violet-300/90" aria-hidden />
              How it works
            </button>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-10">
          <div className="min-w-0 space-y-8 xl:space-y-10">
            {/* Guided hero */}
            <section
              className="relative overflow-hidden rounded-[1.35rem] border border-violet-500/15 bg-[#0c1020]/55 shadow-[0_32px_90px_-40px_rgba(0,0,0,0.85),0_0_48px_-12px_rgba(139,92,246,0.15)] sm:rounded-[1.5rem]"
              aria-labelledby="guided-hero-heading"
            >
              <img
                src={BRAIN_HEALTH_IMAGES.hero}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[62%_42%] brightness-[1.18] saturate-[1.08] contrast-[1.02]"
                loading="eager"
                decoding="async"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a0c14]/32 via-[#0a0c14]/10 to-transparent"
                aria-hidden
              />

              <div className="relative z-[1] p-5 sm:p-7 lg:min-h-[220px] lg:p-8 lg:pr-[min(13rem,22vw)]">
                <div className="min-w-0 max-w-2xl">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">Guided reflection</p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${reflectionStep}-${reflectionFlowComplete ? "done" : "go"}`}
                      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                    >
                      <h2
                        id="guided-hero-heading"
                        className="mt-3 font-serif text-[clamp(1.35rem,4vw,2rem)] font-medium leading-snug tracking-tight text-zinc-50"
                      >
                        {currentQuestion.question}
                      </h2>
                      <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">
                        Take a moment. There&apos;s no right or wrong answer.
                      </p>
                    </motion.div>
                  </AnimatePresence>
                  <div className="mt-6 flex w-full max-w-md flex-col gap-2">
                    <span className="text-xs font-medium tabular-nums text-zinc-400">
                      {progressLabelCurrent} / {GUIDED_STEP_COUNT}
                    </span>
                    <div
                      className="h-1 w-full min-w-0 overflow-hidden rounded-full bg-white/[0.06]"
                      role="progressbar"
                      aria-valuemin={1}
                      aria-valuemax={GUIDED_STEP_COUNT}
                      aria-valuenow={progressLabelCurrent}
                      aria-label="Guided reflection progress"
                    >
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500/90 via-fuchsia-400/80 to-cyan-400/70 shadow-[0_0_16px_rgba(167,139,250,0.45)]"
                        initial={false}
                        animate={{ width: `${progressFraction * 100}%` }}
                        transition={{ duration: reducedMotion ? 0.15 : 0.45, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className="relative mx-auto mt-8 flex h-[160px] w-[160px] shrink-0 items-center justify-center sm:mt-0 sm:h-[180px] sm:w-[180px] lg:absolute lg:right-6 lg:top-1/2 lg:mt-0 lg:h-[200px] lg:w-[200px] lg:-translate-y-1/2 xl:right-8"
                  aria-hidden
                >
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(253,186,116,0.35),rgba(244,63,94,0.12)_40%,transparent_68%)] blur-md" />
                  <div className="relative h-[150px] w-[150px] overflow-hidden rounded-full border border-violet-400/20 bg-black/40 shadow-[0_0_40px_rgba(167,139,250,0.25)]">
                    <img
                      src={BRAIN_HEALTH_IMAGES.companionOrb}
                      alt=""
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                    {!reducedMotion && (
                      <motion.div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
                        aria-hidden
                      >
                        <span className="absolute top-2 h-1.5 w-1.5 rounded-full bg-cyan-300/90 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                      </motion.div>
                    )}
                    {!reducedMotion && (
                      <motion.span
                        className="pointer-events-none absolute top-[12%] right-[18%] h-1 w-1 rounded-full bg-rose-300/80"
                        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Wizard step cards + bubble navigation */}
            <section aria-label="Guided reflection steps" className="flex min-w-0 flex-col gap-3">
              <div
                className={cn(
                  "flex snap-x snap-mandatory items-start gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  "sm:grid sm:grid-cols-[repeat(5,minmax(0,1fr))] sm:gap-2 sm:overflow-visible sm:snap-none sm:pb-0"
                )}
              >
                {GUIDED_QUESTIONS.map((q, idx) => {
                  const Icon = REFLECTION_ICONS[q.iconKey] ?? Brain;
                  const locked =
                    idx > maxAccessibleStep || (idx > reflectionStep && localChoiceByStep[idx] == null);
                  const active = idx === reflectionStep;
                  const completed = Boolean(localChoiceByStep[idx]) && !active;
                  const cardClass = cn(
                    "relative flex min-h-[120px] w-[min(42vw,160px)] min-w-0 shrink-0 snap-center flex-col items-center rounded-xl border px-2.5 pb-3 pt-4 text-center transition-all duration-300 sm:min-h-[132px] sm:w-full sm:max-w-none md:min-h-[140px]",
                    locked &&
                      "cursor-not-allowed border-white/[0.04] bg-black/20 opacity-[0.38] shadow-none saturate-[0.65]",
                    !locked &&
                      !active &&
                      completed &&
                      "cursor-pointer border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-[#080910] shadow-[0_0_20px_rgba(139,92,246,0.1)] hover:border-violet-400/30",
                    !locked &&
                      !active &&
                      !completed &&
                      "cursor-pointer border-white/[0.06] bg-black/25 hover:border-white/10 hover:bg-black/32",
                    active &&
                      "z-[1] border-violet-400/55 bg-gradient-to-b from-violet-950/45 to-[#070a16] shadow-[0_0_36px_rgba(139,92,246,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]"
                  );
                  const iconClass = cn(
                    "mb-2 h-5 w-5 shrink-0 sm:h-6 sm:w-6",
                    active && "text-violet-200 drop-shadow-[0_0_10px_rgba(167,139,250,0.55)]",
                    !active && completed && "text-violet-300/80",
                    !active && !completed && !locked && "text-zinc-500",
                    locked && "text-zinc-600"
                  );
                  const labelClass = cn(
                    "line-clamp-3 max-w-[11.5rem] text-[10px] font-medium leading-snug sm:max-w-none sm:text-[11px]",
                    active && "text-zinc-50",
                    completed && "text-zinc-300",
                    !active && !completed && !locked && "text-zinc-500",
                    locked && "text-zinc-600"
                  );
                  return (
                    <div
                      key={q.shortLabel}
                      className="flex min-w-0 shrink-0 snap-center items-start gap-0.5 sm:w-full sm:shrink"
                    >
                      {idx > 0 && (
                        <ArrowRight
                          className="mt-[2.75rem] hidden h-3.5 w-3.5 shrink-0 text-zinc-600 sm:block"
                          aria-hidden
                        />
                      )}
                      {locked ? (
                        <div className={cn(cardClass, "flex-1")} aria-disabled="true">
                          <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-zinc-600" aria-hidden />
                          <Icon className={iconClass} aria-hidden />
                          <span className={labelClass}>{q.shortLabel}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStepCardClick(idx)}
                          className={cn(cardClass, "flex-1")}
                          aria-current={active ? "step" : undefined}
                        >
                          {completed && (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/20 text-violet-100">
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          )}
                          <Icon className={iconClass} aria-hidden />
                          <span className={labelClass}>{q.shortLabel}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col items-center gap-3" aria-label="Reflection navigation">
                <p className="text-[11px] font-medium tabular-nums tracking-wide text-zinc-500">
                  {progressLabelCurrent} of {GUIDED_STEP_COUNT}
                </p>
                <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-3 sm:max-w-lg">
                  <button
                    type="button"
                    onClick={handleWizardBack}
                    disabled={reflectionStep <= 0}
                    className={cn(
                      "inline-flex min-h-11 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-all",
                      "border-white/[0.08] bg-black/35 text-zinc-200 hover:border-cyan-400/25 hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/35",
                      reflectionStep <= 0 && "pointer-events-none opacity-35"
                    )}
                  >
                    <ArrowLeft className="h-4 w-4 text-cyan-300/80" aria-hidden />
                    Back
                  </button>

                  <div className="flex max-w-[100vw] items-center gap-1 rounded-full border border-white/[0.07] bg-black/30 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:gap-2 sm:px-3 sm:py-2">
                    {GUIDED_QUESTIONS.map((_, dotIdx) => {
                      const lockedDot =
                        dotIdx > maxAccessibleStep ||
                        (dotIdx > reflectionStep && localChoiceByStep[dotIdx] == null);
                      const activeDot = dotIdx === reflectionStep;
                      const doneDot = dotIdx < reflectionStep && Boolean(localChoiceByStep[dotIdx]);
                      return (
                        <button
                          key={dotIdx}
                          type="button"
                          disabled={lockedDot}
                          onClick={() => handleWizardDotClick(dotIdx)}
                          aria-label={`Go to step ${dotIdx + 1}`}
                          className={cn(
                            "flex min-h-10 min-w-10 items-center justify-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 sm:min-h-11 sm:min-w-11",
                            lockedDot && "cursor-not-allowed opacity-30",
                            !lockedDot && !activeDot && "hover:bg-white/[0.05]",
                            activeDot &&
                              "bg-gradient-to-br from-violet-500/35 to-indigo-600/25 shadow-[0_0_18px_rgba(139,92,246,0.45)] ring-1 ring-violet-400/40"
                          )}
                        >
                          <span
                            className={cn(
                              "mx-auto block rounded-full transition-all",
                              activeDot ? "h-3 w-3 bg-violet-200 shadow-[0_0_10px_rgba(167,139,250,0.8)]" : "h-2 w-2",
                              doneDot && !activeDot && "bg-violet-400/55",
                              !doneDot && !activeDot && !lockedDot && "bg-zinc-600",
                              lockedDot && "bg-zinc-700"
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleWizardNext}
                    disabled={nextBubbleDisabled}
                    aria-label={isLastReflectionStep ? "View your live mental state result" : "Go to next reflection step"}
                    className={cn(
                      "inline-flex min-h-11 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-all",
                      isLastReflectionStep &&
                        "border-violet-400/35 bg-gradient-to-r from-violet-950/40 to-indigo-950/30 text-violet-100 hover:border-violet-400/50 hover:shadow-[0_0_22px_rgba(139,92,246,0.2)]",
                      !isLastReflectionStep &&
                        "border-white/[0.08] bg-black/35 text-zinc-200 hover:border-violet-400/35 hover:bg-violet-950/30",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45",
                      nextBubbleDisabled && "pointer-events-none opacity-35"
                    )}
                  >
                    {isLastReflectionStep ? "Result" : "Next"}
                    <ArrowRight className="h-4 w-4 text-violet-300/90" aria-hidden />
                  </button>
                </div>
              </div>
            </section>

            {/* Answers */}
            <section aria-labelledby="answer-heading" className="min-w-0">
              <h3 id="answer-heading" className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                Choose what feels true for you
              </h3>
              <AnimatePresence mode="wait">
                <motion.div
                  key={reflectionStep}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                  className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {currentChoices.map((choice) => {
                    const Icon = REFLECTION_ICONS[choice.iconKey] ?? HelpCircle;
                    const selected = selectedChoiceId === choice.id;
                    const wide = choice.id === "q1-other";
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => handleSelectChoice(choice)}
                        className={cn(
                          "group relative flex min-h-[52px] w-full flex-row items-start gap-4 rounded-xl border p-4 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 sm:min-h-[56px] sm:p-5",
                          wide ? "sm:col-span-2 lg:col-span-3" : "",
                          selected
                            ? "border-violet-400/50 bg-gradient-to-r from-violet-950/25 to-[#080a14] shadow-[0_0_26px_rgba(139,92,246,0.18)]"
                            : "border-white/[0.06] bg-black/28 hover:border-violet-500/20 hover:bg-black/38"
                        )}
                        aria-pressed={selected}
                      >
                        {selected && (
                          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/35 bg-violet-500/20 text-violet-200">
                            <Check className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-300 group-hover:border-violet-400/25 sm:h-12 sm:w-12">
                          <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 pr-10">
                          <span className="block text-sm font-semibold text-zinc-100 sm:text-[15px]">{choice.title}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-zinc-500 sm:text-[13px]">{choice.sub}</span>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </section>

            {/* Live mental state */}
            <section
              ref={liveMentalStateRef}
              id="live-mental-state"
              className="relative scroll-mt-24 overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-gradient-to-br from-[#070916] via-[#05060d] to-[#0c0612] p-5 shadow-[0_28px_80px_-48px_rgba(0,0,0,0.9)] sm:rounded-[1.5rem] sm:p-7"
              aria-labelledby="live-state-heading"
            >
              <img
                src={BRAIN_HEALTH_IMAGES.hero}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[70%_50%] opacity-[0.42]"
                loading="lazy"
                decoding="async"
              />
              <div className="pointer-events-none absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,113,133,0.2),transparent_62%)] blur-2xl" aria-hidden />
              <div className="relative z-[1] grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                <div>
                  <p
                    id="live-state-heading"
                    className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-200/70"
                  >
                    Your mental state (live)
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.7)]" aria-hidden />
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">{liveMental.title}</h3>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">{liveMental.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {liveMental.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-violet-400/20 bg-violet-950/35 px-3 py-1 text-[11px] font-medium text-violet-100/90"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative mx-auto flex h-[200px] w-[200px] items-center justify-center" aria-hidden>
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(251,146,60,0.45),rgba(244,63,94,0.15)_42%,transparent_70%)] blur-md" />
                  <div className="relative h-[168px] w-[168px] overflow-hidden rounded-full border border-orange-400/25 bg-black/45 shadow-[0_0_48px_rgba(251,113,133,0.22)]">
                    <img
                      src={BRAIN_HEALTH_IMAGES.companionOrb}
                      alt=""
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                    {!reducedMotion &&
                      [0, 1, 2, 3, 4].map((i) => (
                        <motion.span
                          key={i}
                          className="absolute h-1 w-1 rounded-full bg-orange-200/80"
                          animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.4, 1] }}
                          transition={{ duration: 2.4 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
                          style={{
                            top: `${18 + i * 14}%`,
                            left: `${10 + i * 16}%`,
                          }}
                        />
                      ))}
                  </div>
                </div>
              </div>
            </section>

            {/* What may help */}
            <section aria-labelledby="help-now-heading">
              <h3 id="help-now-heading" className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
                What may help right now
              </h3>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {helpTools.map((tool) => (
                  <div
                    key={tool.id}
                    className={cn(
                      "flex min-h-[44px] flex-col rounded-xl border border-white/[0.06] bg-black/28 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                      tool.accent
                    )}
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-200">
                        <tool.Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100">{tool.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{tool.sub}</p>
                        <p className="mt-2 text-[11px] font-medium text-zinc-600">{tool.duration}</p>
                      </div>
                    </div>
                    <Link
                      to={tool.to}
                      onClick={() => handleSelectPath(tool.pathId)}
                      className="mt-4 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-end rounded-full border border-white/10 bg-white/[0.06] text-zinc-200 transition-colors hover:border-violet-400/30 hover:bg-violet-500/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 sm:mt-0 sm:self-center"
                      aria-label={`Start ${tool.title}`}
                    >
                      <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden />
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            {/* Preserved Ezri + next step */}
            <section
              ref={responseRef}
              className="rounded-[1.25rem] border border-white/[0.06] bg-black/25 p-5 sm:p-6"
              aria-label="Solace reflection"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Solace</p>
              <AnimatePresence mode="wait">
                <motion.p
                  key={selectedPath ?? "fallback"}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                  className="mt-3 text-sm leading-relaxed text-zinc-200/95 sm:text-base"
                >
                  {selectedPath ? EZRI_RESPONSE[selectedPath] : "Let's make this feel a little lighter."}
                </motion.p>
              </AnimatePresence>
              <h4 className="mt-6 text-sm font-semibold text-zinc-200">One next step</h4>
              <AnimatePresence mode="wait">
                <motion.p
                  key={selectedPath ?? "next-fallback"}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
                  className="mt-2 text-sm text-zinc-400"
                >
                  {selectedPath ? NEXT_STEP[selectedPath] : "Take one breath, then choose one thing to keep and one thing to release."}
                </motion.p>
              </AnimatePresence>
              <div className="mt-6 flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                  onClick={() => handleSelectPath("slow_down")}
                  className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-violet-600/90 to-indigo-700/85 px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(76,29,149,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                >
                  Stay in this space
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                  onClick={showReturnLine}
                  className="inline-flex min-h-11 items-center rounded-full border border-white/[0.1] bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                >
                  Return later
                </motion.button>
              </div>
              <AnimatePresence>
                {returnLineVisible && (
                  <motion.p
                    initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.35 }}
                    className="mt-4 text-sm text-zinc-500"
                  >
                    This space will be here when you need it.
                  </motion.p>
                )}
              </AnimatePresence>
            </section>
          </div>

          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <BrainHealthRightRail
              railTimeFilter={railTimeFilter}
              onRailTimeFilterChange={setRailTimeFilter}
              clarityRange={clarityRange}
              onClarityRangeChange={setClarityRange}
              hasReflectionSignal={hasReflectionSignal}
              clarityPercent={clarityPercent}
              cognitiveEnergyLabel={cognitiveEnergy.label}
              cognitiveEnergyHint={cognitiveEnergy.hint}
              mentalRecoveryLabel={mentalRecovery.label}
              mentalRecoveryHint={mentalRecovery.hint}
              focusWindowTimeLabel={focusWindowLines.time}
              focusWindowSupportingLine={focusWindowLines.line}
              focusSparklinePoints={focusSparklinePoints}
              clarityChartSeries={clarityChartSeries}
              insightRows={insightRows}
            />
          </aside>
        </div>

        <div className="mt-10 space-y-3">
          <SolaceSupportStrip
            getSupportSlot={
              <Link to="/app/emergency-resources" className="inline-flex">
                <Button
                  type="button"
                  className="min-h-11 bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] hover:from-violet-500 hover:to-indigo-500"
                >
                  Get Support
                </Button>
              </Link>
            }
          />
        </div>
      </div>

      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent className="max-w-md border-white/10 bg-[#0c0e18] text-zinc-100 shadow-[0_0_60px_rgba(0,0,0,0.65)]">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">How Brain Health works</DialogTitle>
            <DialogDescription className="text-zinc-400">
              This page is a gentle mirror — not a test. Move through the five reflections at your own pace. Your
              choices shape what Solace highlights and save only what you already sync with your profile (mental climate
              and load tags). Nothing here is a diagnosis.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-inside list-disc space-y-2 text-sm text-zinc-400">
            <li>Future steps stay softly locked until you answer — completed steps stay open to revisit.</li>
            <li>Back and Next bubbles sit under the cards; answers gently advance you when you&apos;re ready.</li>
            <li>The bottom bar is always here for crisis resources and calm sound.</li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

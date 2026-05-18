import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/app/components/ui/utils";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type MentalClimate = "clear" | "foggy" | "heavy" | "scattered" | "overfull" | "steady" | "restless";
type LoadItem =
  | "Too many open loops"
  | "Decision fatigue"
  | "Emotional carryover"
  | "Pressure to keep up"
  | "Mental clutter"
  | "Social drain";
type HelpPath = "clear_head" | "slow_down" | "hold_together" | null;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type BrainHealthSettingsPayload = {
  mentalClimate: MentalClimate;
  selectedLoads: LoadItem[];
  selectedPath: Exclude<HelpPath, null> | null;
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

const HELP_PATHS: Array<{ id: Exclude<HelpPath, null>; label: string }> = [
  { id: "clear_head", label: "Clear my head" },
  { id: "slow_down", label: "Slow me down" },
  { id: "hold_together", label: "Help me hold it together" },
];

const EZRI_RESPONSE: Record<Exclude<HelpPath, null>, string> = {
  clear_head: "You've been carrying too many unfinished thoughts. Let's reduce the mental weight.",
  slow_down: "You don't need to speed up. You need to soften the pace.",
  hold_together: "You're doing more than it looks. Let's stabilize things first.",
};

const NEXT_STEP: Record<Exclude<HelpPath, null>, string> = {
  clear_head: "Close one open loop.",
  slow_down: "Reduce inputs for 10 minutes.",
  hold_together: "Focus on just one thing.",
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

export function BrainHealthPage() {
  const { user, profile } = useAuth();
  const reducedMotion = usePrefersReducedMotion();
  const [mentalClimate, setMentalClimate] = useState<MentalClimate>(getTimeBasedDefaultClimate);
  const [selectedLoads, setSelectedLoads] = useState<LoadItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<HelpPath>(null);
  const [returnLineVisible, setReturnLineVisible] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hydrated, setHydrated] = useState(false);
  const returnLineTimer = useRef<number | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);

  const activeClimate = useMemo(() => CLIMATES.find((c) => c.id === mentalClimate) ?? CLIMATES[0], [mentalClimate]);
  const derivedInsight = useMemo(() => buildInsight(selectedLoads), [selectedLoads]);

  const brainLoad = useMemo(() => {
    const count = selectedLoads.length;
    const noise = Math.min(100, 24 + count * 22 + (mentalClimate === "scattered" ? 12 : 0) + (mentalClimate === "overfull" ? 8 : 0));
    const pressure = Math.min(100, 20 + count * 20 + (mentalClimate === "heavy" ? 18 : 0) + (mentalClimate === "restless" ? 10 : 0));
    const clarityBase = count > 2 ? 34 : count > 1 ? 50 : 66;
    const climatePenalty = mentalClimate === "foggy" || mentalClimate === "overfull" ? 10 : mentalClimate === "clear" || mentalClimate === "steady" ? -8 : 0;
    const clarity = Math.max(12, Math.min(90, clarityBase - climatePenalty));
    return { noise, pressure, clarity };
  }, [mentalClimate, selectedLoads]);

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
    if (useRemote && Array.isArray(profileSettings?.selectedLoads)) {
      const valid = profileSettings.selectedLoads
        .filter((item): item is LoadItem => LOAD_ITEMS.includes(item as LoadItem))
        .slice(0, 3);
      setSelectedLoads(valid);
    } else if (savedLoads && Array.isArray(savedLoads)) {
      const valid = savedLoads.filter((item): item is LoadItem => LOAD_ITEMS.includes(item as LoadItem)).slice(0, 3);
      setSelectedLoads(valid);
    }

    const savedPath = localStorage.getItem(PATH_STORAGE_KEY) as HelpPath;
    if (useRemote && profileSettings?.selectedPath && HELP_PATHS.some((p) => p.id === profileSettings.selectedPath)) {
      setSelectedPath(profileSettings.selectedPath);
    } else if (savedPath && HELP_PATHS.some((p) => p.id === savedPath)) {
      setSelectedPath(savedPath);
    }

    setHydrated(true);
  }, [profile?.brain_health_settings]);

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
  }, [hydrated, user?.id, mentalClimate, selectedLoads, selectedPath]);

  useEffect(() => {
    return () => {
      if (returnLineTimer.current) window.clearTimeout(returnLineTimer.current);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const toggleLoad = (item: LoadItem) => {
    setSelectedLoads((prev) => {
      if (prev.includes(item)) return prev.filter((x) => x !== item);
      if (prev.length >= 3) return prev;
      return [...prev, item];
    });
  };

  const handleSelectPath = (path: Exclude<HelpPath, null>) => {
    setSelectedPath(path);
    setReturnLineVisible(false);
    if (!reducedMotion) {
      responseRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const showReturnLine = () => {
    setReturnLineVisible(true);
    if (returnLineTimer.current) window.clearTimeout(returnLineTimer.current);
    returnLineTimer.current = window.setTimeout(() => {
      setReturnLineVisible(false);
      returnLineTimer.current = null;
    }, 3200);
  };

  return (
    <div
        className={cn(
          "relative min-h-screen transition-[filter,background-color] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "bg-gradient-to-b from-background via-background to-muted/35 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900",
          selectedPath === "slow_down" && "[filter:saturate(0.95)_brightness(0.98)]"
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br opacity-70 transition-all duration-[1000ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
            CLIMATE_AURA[mentalClimate]
          )}
        />

        <main className="mx-auto max-w-5xl px-4 pb-12 pt-5 md:px-6 md:pt-8 lg:px-8">
          <header className="mb-8 flex items-center justify-between md:mb-10">
            {/* <Link
              to="/app/settings"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Settings
            </Link> */}
            <p className="text-xs text-muted-foreground">
              {saveStatus === "saving" && "Saving..."}
              {saveStatus === "saved" && "Saved"}
              {saveStatus === "error" && "Sync issue, retrying"}
            </p>
          </header>

          <section className="space-y-6 rounded-[28px] border border-primary/10 bg-background/65 p-6 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.32)] backdrop-blur-lg md:p-8">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">today's mental climate</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={mentalClimate}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
                >
                  <h1 className="text-[clamp(1.5rem,4vw,2.35rem)] font-semibold tracking-tight text-foreground">{activeClimate.line}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{activeClimate.sub}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {CLIMATES.map((climate) => {
                const active = climate.id === mentalClimate;
                return (
                  <motion.button
                    key={climate.id}
                    type="button"
                    whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    onClick={() => setMentalClimate(climate.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/50 bg-primary/15 text-foreground shadow-md shadow-primary/15"
                        : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={active}
                  >
                    {climate.label}
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section className="mt-7 grid gap-6 lg:grid-cols-2">
            <div className="rounded-[24px] border border-primary/10 bg-background/65 p-6 backdrop-blur-lg">
              <h2 className="text-lg font-semibold text-foreground">What's pulling on you</h2>
              <p className="mt-2 text-sm text-muted-foreground">Pick up to three so the signal stays clear.</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {LOAD_ITEMS.map((item) => {
                  const active = selectedLoads.includes(item);
                  const atLimit = selectedLoads.length >= 3 && !active;
                  return (
                    <motion.button
                      key={item}
                      type="button"
                      whileHover={reducedMotion || atLimit ? undefined : { scale: 1.015 }}
                      whileTap={reducedMotion || atLimit ? undefined : { scale: 0.98 }}
                      disabled={atLimit}
                      onClick={() => toggleLoad(item)}
                      className={cn(
                        "rounded-xl border px-3.5 py-2 text-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-primary/40 bg-primary/15 text-foreground shadow-sm shadow-primary/15"
                          : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground",
                        atLimit && "cursor-not-allowed opacity-55"
                      )}
                      aria-pressed={active}
                    >
                      {item}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-primary/10 bg-background/65 p-6 backdrop-blur-lg">
              <h2 className="text-lg font-semibold text-foreground">Your mind in one sentence</h2>
              <AnimatePresence mode="wait">
                <motion.p
                  key={derivedInsight}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.34, ease: [0.4, 0, 0.2, 1] }}
                  className="mt-4 text-base leading-relaxed text-foreground/90"
                >
                  {derivedInsight}
                </motion.p>
              </AnimatePresence>
              <p className="mt-4 text-xs uppercase tracking-[0.12em] text-muted-foreground">Current load</p>
              <div className="mt-3 space-y-3">
                {(
                  [
                    ["Noise", brainLoad.noise, "bg-violet-400/60"],
                    ["Pressure", brainLoad.pressure, "bg-rose-400/55"],
                    ["Clarity", brainLoad.clarity, "bg-emerald-400/55"],
                  ] as const
                ).map(([label, value, barClass]) => (
                  <div key={label}>
                    <div className="mb-1 text-xs text-muted-foreground">{label}</div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/45">
                      <motion.div
                        className={cn("h-full rounded-full", barClass)}
                        initial={false}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: reducedMotion ? 0.2 : 0.55, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-7 rounded-[24px] border border-primary/10 bg-background/65 p-6 backdrop-blur-lg">
            <h2 className="text-lg font-semibold text-foreground">What would help right now</h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {HELP_PATHS.map((path) => {
                const active = selectedPath === path.id;
                return (
                  <motion.button
                    key={path.id}
                    type="button"
                    whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                    onClick={() => handleSelectPath(path.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/50 bg-primary/15 text-foreground shadow-md shadow-primary/15"
                        : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={active}
                  >
                    {path.label}
                  </motion.button>
                );
              })}
            </div>
          </section>

          <section ref={responseRef} className="mt-7 rounded-[24px] border border-primary/10 bg-background/65 p-6 backdrop-blur-lg">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">ezri</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={selectedPath ?? "fallback"}
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                className="mt-3 text-base leading-relaxed text-foreground/95"
              >
                {selectedPath ? EZRI_RESPONSE[selectedPath] : "Let's make this feel a little lighter."}
              </motion.p>
            </AnimatePresence>
          </section>

          <section className="mt-7 rounded-[24px] border border-primary/10 bg-background/65 p-6 backdrop-blur-lg">
            <h2 className="text-lg font-semibold text-foreground">One next step</h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={selectedPath ?? "next-fallback"}
                initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
                className="mt-3 text-base text-foreground/90"
              >
                {selectedPath ? NEXT_STEP[selectedPath] : "Take one breath, then choose one thing to keep and one thing to release."}
              </motion.p>
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap gap-3">
              <motion.button
                type="button"
                whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                onClick={() => setSelectedPath("slow_down")}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Stay in this space
              </motion.button>
              <motion.button
                type="button"
                whileHover={reducedMotion ? undefined : { scale: 1.02 }}
                whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                onClick={showReturnLine}
                className="rounded-full border border-border/60 bg-background/60 px-6 py-2.5 text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  className="mt-4 text-sm text-muted-foreground"
                >
                  This space will be here when you need it.
                </motion.p>
              )}
            </AnimatePresence>
          </section>
        </main>
      </div>
  );
}

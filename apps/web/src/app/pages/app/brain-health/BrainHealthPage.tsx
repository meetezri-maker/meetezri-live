import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/app/components/AppLayout";
import { cn } from "@/app/components/ui/utils";
import { AtmosphereHero } from "./AtmosphereHero";
import { ReflectionStrip } from "./ReflectionStrip";
import { TuneMindPanel } from "./TuneMindPanel";
import { ThoughtBubbleCanvas } from "./ThoughtBubbleCanvas";
import { MindSignaturePanel } from "./MindSignaturePanel";
import { GentleShiftPanel } from "./GentleShiftPanel";
import {
  BRAIN_HEALTH_LOCAL_KEY,
  REFLECTION_PLACEHOLDERS,
  THOUGHT_BUBBLE_PLACEHOLDERS,
  type TuneStateId,
} from "./constants";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { pickRandomTuneStateExcluding, randomHelperLine, pruneRecentClicks } from "./brainStateHelpers";

type SignatureVariant = 1 | 2 | 3;

type PersistedExperience = {
  tune: TuneStateId;
  reflectionIndex: number;
  signatureVariant: SignatureVariant;
  dismissed: string[];
  deepMode: boolean;
};

type InteractionMetrics = {
  clickCount: number;
  lastClickTime: number | null;
  idleTime: number;
};

function loadPersisted(): Partial<PersistedExperience> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(BRAIN_HEALTH_LOCAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedExperience>;
  } catch {
    return {};
  }
}

function savePersisted(data: PersistedExperience) {
  try {
    localStorage.setItem(BRAIN_HEALTH_LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

const IDLE_LIGHT_SEC = 10;
const IDLE_DEEP_SEC = 25;
const REFLECTION_RESUME_MS = 8000;
const BURST_WINDOW_MS = 1500;
const BURST_MIN = 3;
const SLOW_GAP_MS = 2500;

/** Brain State Engine: local-only behavior, no API. */
export function BrainHealthPage() {
  const reducedMotion = usePrefersReducedMotion();
  const tuneRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  const [brainState, setBrainState] = useState<TuneStateId>("gentle");
  const [activeReflectionIndex, setActiveReflectionIndex] = useState(0);
  const [signatureVariant, setSignatureVariant] = useState<SignatureVariant>(2);
  const [dismissedThoughtBubbles, setDismissedThoughtBubbles] = useState<Set<string>>(new Set());
  const [deepModeActive, setDeepModeActive] = useState(false);
  const [userPausedReflection, setUserPausedReflection] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const [interactionMetrics, setInteractionMetrics] = useState<InteractionMetrics>({
    clickCount: 0,
    lastClickTime: null,
    idleTime: 0,
  });

  const [tuneMindSlowMo, setTuneMindSlowMo] = useState(false);
  const [tuneMindHelperLine, setTuneMindHelperLine] = useState<string | null>(null);
  const [tunePulseScale, setTunePulseScale] = useState(1);
  const [scrollOverlay, setScrollOverlay] = useState(false);
  const [reflectionActivityPaused, setReflectionActivityPaused] = useState(false);
  const [returnLaterState, setReturnLaterState] = useState(false);

  const lastActivityAt = useRef<number>(Date.now());
  const burstTimes = useRef<number[]>([]);
  const prevClickAt = useRef<number | null>(null);
  const gapWindow = useRef<number[]>([]);
  const reflectionResumeTimer = useRef<number | null>(null);
  const tuneSlowTimer = useRef<number | null>(null);
  const tuneHelperTimer = useRef<number | null>(null);
  const tuneScaleTimer = useRef<number | null>(null);
  const returnLaterTimer = useRef<number | null>(null);

  const reflectionPaused = userPausedReflection || reflectionActivityPaused;

  useEffect(() => {
    const p = loadPersisted();
    if (p.tune) setBrainState(p.tune);
    if (typeof p.reflectionIndex === "number") setActiveReflectionIndex(p.reflectionIndex);
    if (p.signatureVariant) setSignatureVariant(p.signatureVariant);
    if (Array.isArray(p.dismissed)) setDismissedThoughtBubbles(new Set(p.dismissed));
    if (typeof p.deepMode === "boolean") setDeepModeActive(p.deepMode);
    setStorageReady(true);
  }, []);

  const persist = useCallback(() => {
    savePersisted({
      tune: brainState,
      reflectionIndex: activeReflectionIndex,
      signatureVariant,
      dismissed: [...dismissedThoughtBubbles],
      deepMode: deepModeActive,
    });
  }, [activeReflectionIndex, brainState, deepModeActive, dismissedThoughtBubbles, signatureVariant]);

  useEffect(() => {
    if (!storageReady) return;
    persist();
  }, [storageReady, persist]);

  const scheduleReflectionResume = useCallback(() => {
    if (reflectionResumeTimer.current) window.clearTimeout(reflectionResumeTimer.current);
    setReflectionActivityPaused(true);
    reflectionResumeTimer.current = window.setTimeout(() => {
      setReflectionActivityPaused(false);
      setUserPausedReflection(false);
      reflectionResumeTimer.current = null;
    }, REFLECTION_RESUME_MS);
  }, []);

  const recordInteraction = useCallback(
    (source: "pointer" | "reflection-dot" | "tune-mind" | "rhythm" | "bubble" | "preset" | "signature") => {
      const now = Date.now();
      lastActivityAt.current = now;

      if (deepModeActive) {
        setDeepModeActive(false);
      }

      setInteractionMetrics((m) => ({
        clickCount: m.clickCount + 1,
        lastClickTime: now,
        idleTime: 0,
      }));

      burstTimes.current = pruneRecentClicks([...burstTimes.current, now], BURST_WINDOW_MS, now);
      if (burstTimes.current.length >= BURST_MIN) {
        setBrainState("gentle");
        burstTimes.current = [];
      }

      if (prevClickAt.current != null) {
        const gap = now - prevClickAt.current;
        if (gap > SLOW_GAP_MS) {
          gapWindow.current = [...gapWindow.current, 1].slice(-3);
          if (gapWindow.current.length >= 3) {
            setBrainState("focused");
            gapWindow.current = [];
          }
        } else {
          gapWindow.current = [];
        }
      }
      prevClickAt.current = now;

      if (source === "reflection-dot") {
        setUserPausedReflection(true);
      } else if (source !== "tune-mind" && source !== "rhythm") {
        scheduleReflectionResume();
      }
    },
    [deepModeActive, scheduleReflectionResume]
  );

  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      const idleSec = (now - lastActivityAt.current) / 1000;
      setInteractionMetrics((m) => ({ ...m, idleTime: idleSec }));

      if (idleSec >= IDLE_LIGHT_SEC) {
        setBrainState((s) => (s === "light" ? s : "light"));
      }

      if (idleSec >= IDLE_DEEP_SEC && !deepModeActive) {
        setDeepModeActive(true);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [deepModeActive]);

  useEffect(() => {
    if (reducedMotion || reflectionPaused || REFLECTION_PLACEHOLDERS.length < 2) return;
    const id = window.setInterval(() => {
      setActiveReflectionIndex((i) => (i + 1) % REFLECTION_PLACEHOLDERS.length);
    }, 5000);
    return () => clearInterval(id);
  }, [reducedMotion, reflectionPaused]);

  const handleReflectionSelect = useCallback(
    (i: number) => {
      recordInteraction("reflection-dot");
      setActiveReflectionIndex(i);
    },
    [recordInteraction]
  );

  const handleDismissBubble = useCallback(
    (text: string) => {
      recordInteraction("bubble");
      setDismissedThoughtBubbles((prev) => new Set([...prev, text]));
    },
    [recordInteraction]
  );

  const scrollToTune = useCallback(() => {
    tuneRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  const scrollToSignature = useCallback(() => {
    signatureRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  const handleTuneMyMind = useCallback(() => {
    recordInteraction("tune-mind");
    setBrainState((s) => pickRandomTuneStateExcluding(s));

    setTunePulseScale(1.018);
    if (tuneScaleTimer.current) window.clearTimeout(tuneScaleTimer.current);
    tuneScaleTimer.current = window.setTimeout(() => setTunePulseScale(1), 680);

    setTuneMindSlowMo(true);
    if (tuneSlowTimer.current) window.clearTimeout(tuneSlowTimer.current);
    tuneSlowTimer.current = window.setTimeout(() => setTuneMindSlowMo(false), 5000);

    const line = randomHelperLine();
    setTuneMindHelperLine(line);
    if (tuneHelperTimer.current) window.clearTimeout(tuneHelperTimer.current);
    tuneHelperTimer.current = window.setTimeout(() => setTuneMindHelperLine(null), 2800);

    window.setTimeout(() => scrollToTune(), 180);
  }, [recordInteraction, scrollToTune]);

  const handleSeeRhythm = useCallback(() => {
    recordInteraction("rhythm");
    setScrollOverlay(true);
    window.setTimeout(() => scrollToSignature(), 80);
    window.setTimeout(() => setScrollOverlay(false), 520);
  }, [recordInteraction, scrollToSignature]);

  const handleMainPointerDown = useCallback(() => {
    recordInteraction("pointer");
  }, [recordInteraction]);

  const handlePresetSelect = useCallback(
    (id: TuneStateId) => {
      recordInteraction("preset");
      setBrainState(id);
    },
    [recordInteraction]
  );

  const handleSignatureVariantChange = useCallback(
    (v: SignatureVariant) => {
      recordInteraction("signature");
      setSignatureVariant(v);
    },
    [recordInteraction]
  );

  const handleStayInThisSpace = useCallback(() => {
    setReturnLaterState(false);
    setDeepModeActive(true);
  }, []);

  const handleReturnLater = useCallback(() => {
    setDeepModeActive(false);
    setReturnLaterState(true);
    if (returnLaterTimer.current) window.clearTimeout(returnLaterTimer.current);
    returnLaterTimer.current = window.setTimeout(() => {
      setReturnLaterState(false);
      returnLaterTimer.current = null;
    }, 3600);
    window.setTimeout(() => {
      signatureRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    }, 90);
  }, [reducedMotion]);

  const animationSlowFactor = useMemo(() => {
    let f = 1;
    if (tuneMindSlowMo) f *= 1.5;
    if (deepModeActive) f *= 1.35;
    return f;
  }, [tuneMindSlowMo, deepModeActive]);

  const pageMotionClass = useMemo(() => {
    if (deepModeActive) {
      return "transition-[filter,background-color] duration-[1.1s] ease-[cubic-bezier(0.4,0,0.2,1)] [filter:saturate(0.9)_brightness(0.96)]";
    }
    return "transition-[filter] duration-[700ms] ease-out";
  }, [deepModeActive]);

  const tuneBackdrop = useMemo(() => {
    const m: Record<TuneStateId, string> = {
      clear: "from-sky-50/30 via-transparent to-transparent dark:from-sky-950/20",
      gentle: "from-primary/[0.07] via-transparent to-fuchsia-500/[0.04]",
      focused: "from-violet-100/20 via-transparent to-transparent dark:from-violet-950/25",
      light: "from-amber-50/30 via-rose-50/20 to-transparent dark:from-amber-950/15",
    };
    return m[brainState];
  }, [brainState]);

  useEffect(() => {
    return () => {
      if (reflectionResumeTimer.current) window.clearTimeout(reflectionResumeTimer.current);
      if (tuneSlowTimer.current) window.clearTimeout(tuneSlowTimer.current);
      if (tuneHelperTimer.current) window.clearTimeout(tuneHelperTimer.current);
      if (tuneScaleTimer.current) window.clearTimeout(tuneScaleTimer.current);
      if (returnLaterTimer.current) window.clearTimeout(returnLaterTimer.current);
    };
  }, []);

  return (
    <AppLayout>
      <div
        className={cn(
          "relative min-h-screen bg-gradient-to-b from-background via-background to-muted/30 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900",
          pageMotionClass
        )}
        data-brain-state={brainState}
        data-brain-clicks={interactionMetrics.clickCount}
        data-brain-idle-sec={Math.floor(interactionMetrics.idleTime)}
      >
        {scrollOverlay && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[5] bg-primary/10 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          />
        )}

        <div
          className={cn(
            "pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br opacity-70 transition-all duration-[1000ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
            tuneBackdrop
          )}
          aria-hidden
        />

        <motion.div
          className="relative z-[1] mx-auto max-w-[1280px] px-4 pb-8 pt-4 md:px-6 md:pb-10 md:pt-6 lg:px-8 lg:pb-12 lg:pt-8"
          animate={{ scale: reducedMotion ? 1 : tunePulseScale }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
        >
          <div onPointerDown={handleMainPointerDown}>
            <motion.header
              initial={reducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex items-center justify-between gap-4 md:mb-10 lg:mb-12"
            >
              <Link
                to="/app/settings"
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3 py-2 text-[14px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to Settings
              </Link>
            </motion.header>

            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            >
              <AtmosphereHero
                tuneState={brainState}
                deepMode={deepModeActive}
                reducedMotion={reducedMotion}
                animationSlowFactor={animationSlowFactor}
                tuneMindHelperLine={tuneMindHelperLine}
                onTuneClick={handleTuneMyMind}
                onRhythmClick={handleSeeRhythm}
              />
            </motion.div>

            <div className="mt-8 space-y-8 md:mt-10 md:space-y-10 lg:mt-12 lg:space-y-12">
              <ReflectionStrip
                activeIndex={activeReflectionIndex}
                onSelect={handleReflectionSelect}
                reducedMotion={reducedMotion}
              />

              <div ref={tuneRef}>
                <TuneMindPanel
                  selected={brainState}
                  onSelect={handlePresetSelect}
                  reducedMotion={reducedMotion || deepModeActive}
                  animationSlowFactor={animationSlowFactor}
                />
              </div>

              <ThoughtBubbleCanvas
                items={THOUGHT_BUBBLE_PLACEHOLDERS}
                dismissed={dismissedThoughtBubbles}
                onDismiss={handleDismissBubble}
                reducedMotion={reducedMotion}
                animationSlowFactor={animationSlowFactor}
              />

              <div ref={signatureRef}>
                <MindSignaturePanel
                  variant={signatureVariant}
                  onVariantChange={handleSignatureVariantChange}
                  tuneState={brainState}
                  reducedMotion={reducedMotion || deepModeActive}
                />
              </div>

              <GentleShiftPanel
                deepMode={deepModeActive}
                reducedMotion={reducedMotion}
                onStay={handleStayInThisSpace}
                onReturnLater={handleReturnLater}
                returnLaterState={returnLaterState}
              />
            </div>
          </div>
        </motion.div>

      </div>
    </AppLayout>
  );
}

import { Button } from "../../components/ui/button";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import {
  Heart,
  Clock,
  Check,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { cn } from "@/lib/utils";
import { MOOD_CHECKIN_IMAGES } from "@/lib/solace/moodCheckInImages";
import { lobbyAvatarByName } from "@/lib/avatar/lobbyAvatars";
import { TalkItOutBottomDock } from "./talk-it-out/TalkItOutBottomDock";
import {
  MOOD_CHECKIN_CARDS,
  INFLUENCE_CHIPS,
  INTENSITY_BY_TIER,
  insightLabelForMoodKey,
} from "./mood-check-in/moodCheckInData";
import {
  computeCheckInStreak,
  weeklyIntensitySeries,
  type MoodEntryLite,
} from "./mood-check-in/moodCheckInUtils";

function matteClass(extra?: string) {
  return cn(
    "rounded-[1.35rem] border border-white/[0.035] bg-black/[0.16] shadow-[0_28px_88px_-56px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-xl",
    extra
  );
}

export function MoodCheckIn() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshProfile, profile, user } = useAuth();
  const [selectedMood, setSelectedMood] = useState("");
  const [intensityTier, setIntensityTier] = useState<1 | 2 | 3>(2);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [insightLoading, setInsightLoading] = useState(true);
  const [entries, setEntries] = useState<MoodEntryLite[]>([]);

  const selectedIntensity = INTENSITY_BY_TIER[intensityTier];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = (await api.moods.getMyMoods()) as MoodEntryLite[];
        if (!cancelled) setEntries(Array.isArray(raw) ? raw : []);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const companionPreview = useMemo(
    () => lobbyAvatarByName(profile?.selected_avatar ?? "Jordan Taylor"),
    [profile?.selected_avatar]
  );

  const monthInsight = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const inMonth = entries.filter((e) => {
      const d = new Date(e.created_at);
      return !Number.isNaN(d.getTime()) && d >= monthStart && d <= now;
    });
    const count = inMonth.length;
    if (count === 0) return { count: 0, topKey: "" as string };
    const counts = new Map<string, number>();
    for (const e of inMonth) {
      const key = String(e.mood ?? "")
        .toLowerCase()
        .trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let bestKey = "";
    let bestCount = 0;
    for (const [k, c] of counts) {
      if (c > bestCount) {
        bestCount = c;
        bestKey = k;
      }
    }
    return { count, topKey: bestKey };
  }, [entries]);

  const topMoodInsightLabel =
    monthInsight.topKey ? insightLabelForMoodKey(monthInsight.topKey) : null;

  const streakDays = useMemo(() => computeCheckInStreak(entries), [entries]);

  const chartSeries = useMemo(() => weeklyIntensitySeries(entries), [entries]);

  const exhaustionHeavy = useMemo(() => {
    const k = monthInsight.topKey.toLowerCase();
    return ["tired", "heavy", "overwhelmed", "anxious", "sad", "exhausted"].some((x) =>
      k.includes(x)
    );
  }, [monthInsight.topKey]);

  const patternNarrative = insightLoading
    ? "Gathering your gentle patterns…"
    : monthInsight.count === 0
      ? "As you check in, a soft picture of your week will grow here."
      : exhaustionHeavy
        ? "You've felt mentally exhausted more often this week."
        : `You’ve been feeling “${topMoodInsightLabel}” more often this week.`;

  const toggleActivity = (value: string) => {
    if (selectedActivities.includes(value)) {
      setSelectedActivities(selectedActivities.filter((a) => a !== value));
    } else {
      setSelectedActivities([...selectedActivities, value]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMood) {
      toast.error("Please select a mood");
      return;
    }
    try {
      setIsSubmitting(true);
      await api.moods.create({
        mood: selectedMood,
        intensity: selectedIntensity,
        activities: selectedActivities,
        notes: notes.trim() || undefined,
      });
      api.bustRecentActivityCache();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.activity.recentForUser(user?.id),
      });
      const optimisticMoodPayload = {
        mood: selectedMood,
        intensity: selectedIntensity,
        created_at: new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("ezri_latest_mood_checkin", JSON.stringify(optimisticMoodPayload));
      }
      await refreshProfile();
      setSubmitted(true);
      setTimeout(() => {
        navigate("/app/dashboard", { state: { latestMoodCheckin: optimisticMoodPayload } });
      }, 900);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit mood check-in");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="relative min-h-[calc(100dvh-5rem)] solace-canvas-bg px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-md text-center">
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div
                className={cn(
                  "mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full",
                  "border border-violet-400/25 bg-violet-500/[0.12] shadow-[0_0_48px_-12px_rgba(139,92,246,0.45)]"
                )}
              >
                <FluentEmoji emoji="✨" size={44} label="Saved" />
              </div>
              <h2 className="font-serif text-2xl font-normal tracking-tight text-zinc-50">
                Your check-in is saved
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--solace-muted)]">
                Thank you for taking a gentle moment for yourself.
              </p>
            </motion.div>
          </div>
    </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100dvh-5rem)] overflow-x-hidden pb-28 text-[var(--solace-text)] lg:pb-14 solace-canvas-bg">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[min(44vh,380px)] bg-[radial-gradient(ellipse_90%_100%_at_50%_0%,rgba(92,106,172,0.14)_0%,transparent_72%)]"
          aria-hidden
        />
        <div className="relative z-[1] mx-auto max-w-[1680px] px-4 sm:px-5 lg:px-8">
          {/* Header */}
          <header className="mb-12 border-b border-white/[0.04] pb-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3">
                  <Heart className="h-7 w-7 text-rose-300/85 sm:h-8 sm:w-8" fill="currentColor" fillOpacity={0.35} strokeWidth={1.35} />
                  <h1 className="font-serif text-[1.9rem] font-normal leading-tight tracking-[-0.02em] text-zinc-50 sm:text-[2.15rem] lg:text-[2.25rem]">
                    Mood Check-In
                  </h1>
                </div>
                <p className="mt-4 max-w-2xl text-[15px] leading-relaxed tracking-[-0.01em] text-[var(--solace-muted)] sm:text-[1.05rem] sm:leading-[1.75]">
                  Take a moment to reflect on how you&apos;re feeling right now.
                </p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-x-12 xl:gap-x-14">
            {/* Main column — full remaining width (~70%+ vs 340px rail) */}
            <div className="min-w-0 w-full space-y-12 sm:space-y-14 lg:space-y-[3.75rem]">
              {/* Emotional arrival hero */}
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "relative overflow-hidden rounded-[2rem] border border-white/[0.038]",
                  "shadow-[0_48px_120px_-58px_rgba(0,0,0,0.92)] sm:rounded-[2.1rem]"
                )}
              >
                <img
                  src={MOOD_CHECKIN_IMAGES.heroBanner}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[62%_42%]"
                  loading="eager"
                  decoding="async"
                />
                {/* Light left scrim only — keeps the lake/lotus vivid like the reference */}
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0a0c14]/55 via-[#0a0c14]/18 to-transparent"
                  aria-hidden
                />
                <div className="relative z-[2] flex min-h-[368px] flex-col justify-center px-8 py-12 sm:min-h-[400px] sm:px-12 sm:py-14 lg:min-h-[430px] lg:px-14 lg:py-14">
                  <div className="relative z-[3] max-w-2xl">
                    <h2 className="font-serif text-[clamp(1.6rem,4.25vw,2.35rem)] font-normal leading-[1.26] tracking-[-0.02em] text-zinc-50 [text-shadow:0_2px_24px_rgba(0,0,0,0.65)]">
                      Let&apos;s check in with
                      <br />
                      how you&apos;re feeling <FluentEmoji emoji="💗" size={26} className="inline-block align-[-3px]" />
                    </h2>
                    <p className="mt-6 max-w-xl text-[15px] leading-[1.82] tracking-[-0.01em] text-zinc-100/95 sm:text-[1.0625rem] [text-shadow:0_1px_16px_rgba(0,0,0,0.55)]">
                      There&apos;s no right or wrong way to feel.
                      <br />
                      We&apos;re here for you, always.
                    </p>
                  </div>
                </div>
              </motion.section>

              {/* Mood selection */}
              <section aria-label="Mood selection">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[17px] font-medium tracking-[-0.015em] text-zinc-100 sm:text-[1.125rem]">
                      <Clock className="h-4 w-4 text-violet-300/80 sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={1.75} />
                      How are you feeling?
                    </div>
                    <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-[var(--solace-muted)] sm:text-[14px]">
                      Choose the emotion that best fits you right now.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-6">
                  {MOOD_CHECKIN_CARDS.map((m) => {
                    const active = selectedMood === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setSelectedMood(m.value);
                          setIntensityTier(2);
                        }}
                        className={cn(
                          "group relative min-h-[148px] overflow-hidden rounded-[1.35rem] border text-left transition-[transform,box-shadow,border-color] duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35 sm:min-h-[162px] sm:rounded-3xl lg:aspect-[8/13] lg:min-h-[200px]",
                          active
                            ? "scale-[1.02] border-violet-400/45 shadow-[0_28px_72px_-28px_rgba(76,29,149,0.58),inset_0_0_0_1px_rgba(167,139,250,0.28)] ring-1 ring-violet-400/22"
                            : "border-white/[0.07] hover:border-white/[0.14] hover:shadow-[0_26px_64px_-30px_rgba(76,29,149,0.38)]"
                        )}
                      >
                        <img
                          src={m.image}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.97] transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/[0.12]" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_100%,rgba(139,92,246,0.12),transparent_55%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                        <div className="relative z-[1] flex h-full min-h-[148px] flex-col justify-end p-4 sm:min-h-[162px] sm:p-5 lg:min-h-0 lg:flex-1 lg:justify-end lg:pb-6">
                          {active ? (
                            <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-violet-300/40 bg-black/48 text-violet-200 shadow-[0_0_24px_rgba(139,92,246,0.4)] sm:right-3.5 sm:top-3.5">
                              <Check className="h-4 w-4" strokeWidth={2.5} />
                            </span>
                          ) : null}
                          <p className="text-[15px] font-medium tracking-[-0.01em] text-zinc-50 sm:text-[1.05rem]">{m.label}</p>
                          <p className="mt-2 text-[11.5px] leading-snug text-zinc-300/95 sm:text-xs">{m.micro}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Intensity */}
              {selectedMood ? (
                <section aria-label="Emotional intensity" className={matteClass("px-7 py-10 sm:px-10 sm:py-11")}>
                  <h3 className="text-center text-[1.125rem] font-medium tracking-[-0.015em] text-zinc-100 sm:text-[1.2rem]">
                    How strong is this feeling?
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-center text-[13px] leading-snug text-[var(--solace-muted)]">
                    Select the intensity of what you&apos;re feeling.
                  </p>
                  <div className="relative mx-auto mt-11 max-w-lg pb-2">
                    <div className="relative h-3 overflow-hidden rounded-full bg-black/40 shadow-[inset_0_1px_4px_rgba(0,0,0,0.45)]">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600/55 via-fuchsia-500/45 to-indigo-600/55 blur-[0.5px]"
                        initial={false}
                        animate={{
                          width:
                            intensityTier === 1 ? "28%" : intensityTier === 2 ? "58%" : "100%",
                        }}
                        transition={{ type: "spring", stiffness: 120, damping: 22 }}
                      />
                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.06)_50%,transparent_100%)] opacity-70 mix-blend-soft-light" />
                    </div>
                    <div className="mt-9 grid max-w-xl grid-cols-3 gap-5 sm:gap-6">
                      {(
                        [
                          { tier: 1 as const, label: "Very Light", sub: "Just a little" },
                          { tier: 2 as const, label: "Moderate", sub: "Noticeable" },
                          { tier: 3 as const, label: "Very Intense", sub: "Overwhelming" },
                        ] as const
                      ).map(({ tier, label, sub }) => {
                        const on = intensityTier === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setIntensityTier(tier)}
                            className="flex flex-col items-center gap-2.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35 rounded-xl py-2"
                          >
                            <span
                              className={cn(
                                "flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full border-2 transition-[box-shadow,transform,border-color,background-color] sm:h-14 sm:w-14",
                                on
                                  ? "scale-105 border-violet-400/45 bg-violet-500/[0.18] shadow-[0_0_28px_-4px_rgba(139,92,246,0.45)]"
                                  : "border-white/[0.1] bg-black/30 hover:border-white/[0.18]"
                              )}
                            >
                              <span className="text-xl sm:text-[1.35rem]">
                                {tier === 1 ? "🙂" : tier === 2 ? "😐" : "😔"}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "text-[13px] font-medium tracking-[-0.01em]",
                                on ? "text-zinc-100" : "text-zinc-500"
                              )}
                            >
                              {label}
                            </span>
                            <span className="text-[11px] leading-tight text-zinc-500/85">{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              ) : null}

              {/* Influence */}
              <section aria-label="Influences" className={matteClass("px-6 py-9 sm:px-9 sm:py-10")}>
                <h3 className="text-[17px] font-medium tracking-[-0.015em] text-zinc-100 sm:text-[1.125rem]">
                  What may be influencing how you feel?
                </h3>
                <p className="mt-2 text-[13px] leading-snug text-[var(--solace-muted)]">
                  Select any that apply. You can choose more than one.
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {INFLUENCE_CHIPS.map((a) => {
                    const on = selectedActivities.includes(a.value);
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => toggleActivity(a.value)}
                        className={cn(
                          "min-h-[44px] rounded-full border px-[0.95rem] py-2.5 text-[12.5px] font-normal tracking-[-0.01em] transition-[border-color,background-color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/28",
                          on
                            ? "border-violet-400/28 bg-violet-500/[0.14] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-violet-400/15"
                            : "border-white/[0.06] bg-black/[0.1] text-zinc-400 hover:border-white/[0.12] hover:bg-white/[0.04]"
                        )}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Reflection */}
              <section aria-label="Notes" className={matteClass("px-6 py-9 sm:px-9 sm:py-10")}>
                <h3 className="text-[17px] font-medium tracking-[-0.015em] text-zinc-100 sm:text-[1.125rem]">
                  Want to say a little more?
                </h3>
                <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--solace-muted)] sm:text-[14px]">Your thoughts are safe here.</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
                  placeholder="Write anything you'd like to share…"
                  rows={5}
                  maxLength={1000}
                  className={cn(
                    "mt-6 min-h-[9.5rem] w-full resize-y rounded-[1.25rem] border border-white/[0.09]",
                    "bg-gradient-to-b from-black/44 to-black/28 px-5 py-4",
                    "text-[14.5px] leading-[1.75] text-zinc-50 placeholder:text-zinc-500/90 placeholder:italic",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_48px_-38px_rgba(76,29,149,0.35)]",
                    "ring-1 ring-inset ring-white/[0.04]",
                    "focus:border-violet-400/30 focus:outline-none focus:ring-2 focus:ring-violet-400/22"
                  )}
                />
                <p className="mt-2 text-right text-[11px] text-zinc-500">{notes.length}/1000</p>
              </section>

              {/* Save */}
              <div className="flex flex-col items-center gap-3 pb-4 pt-2">
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!selectedMood || isSubmitting}
                  className={cn(
                    "relative h-14 min-h-[52px] w-full max-w-xl rounded-full border border-white/[0.08]",
                    "bg-gradient-to-r from-violet-700/92 via-fuchsia-700/88 to-indigo-800/95",
                    "text-[15px] font-medium tracking-[-0.01em] text-white shadow-[0_22px_60px_-20px_rgba(76,29,149,0.5)]",
                    "hover:brightness-105 disabled:opacity-45"
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Heart className="mr-2 h-4 w-4 fill-current opacity-90" aria-hidden />
                      Save Check-In
                    </>
                  )}
                </Button>
                <p className="text-center text-[12.5px] text-[var(--solace-muted)]">
                  Thank you for taking care of yourself.
                </p>
              </div>
            </div>

            {/* Right rail — fixed 340px; sticky desktop; breathable modules */}
            <aside className="min-w-[280px] w-full lg:min-w-[340px] lg:max-w-[340px] lg:sticky lg:top-[5.75rem] lg:z-[2] lg:self-start">
              <div className="overflow-hidden rounded-[1.45rem] border border-white/[0.065] bg-gradient-to-b from-violet-500/[0.04] via-white/[0.02] to-black/[0.24] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_34px_100px_-58px_rgba(76,29,149,0.35),0_22px_64px_-48px_rgba(0,0,0,0.88)] backdrop-blur-2xl">
                <div className="divide-y divide-white/[0.055] rounded-[calc(1.45rem-1px)] bg-black/[0.03] ring-1 ring-inset ring-violet-400/[0.06]">
                  <section className="px-6 py-7 lg:px-7 lg:py-8">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-zinc-400/88">Your companion</p>
                    <div className="mt-5 flex gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/[0.11] bg-black/45 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.75)] ring-2 ring-white/[0.04]">
                        {companionPreview.cardImage ? (
                          <img src={companionPreview.cardImage} alt="" className="h-full w-full object-cover object-top" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium leading-snug text-zinc-50">{companionPreview.name}</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-zinc-300/88">
                          Thanks for checking in today.
                          <br />
                          I&apos;m here with you.
                        </p>
                        <Heart className="mt-3 h-4 w-4 text-rose-400/45" strokeWidth={1.5} aria-hidden />
                      </div>
                    </div>
                  </section>

                  <section className="px-6 py-7 lg:px-7 lg:py-8">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-zinc-400/88">
                      Your pattern this week
                    </p>
                    <div className="mt-4 h-[148px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartSeries} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                          <defs>
                            <linearGradient id="moodWeekFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgb(139 92 246)" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="rgb(139 92 246)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <YAxis hide domain={[0, 10]} />
                          <Area
                            type="monotone"
                            dataKey="avg"
                            stroke="rgb(167 139 250)"
                            strokeWidth={1.5}
                            fill="url(#moodWeekFill)"
                            dot={false}
                            isAnimationActive={!insightLoading}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-4 text-[13.5px] leading-[1.7] text-zinc-200/88">{patternNarrative}</p>
                    <Link
                      to="/app/mood-history"
                      className="mt-3 inline-flex text-[11px] font-medium text-violet-300/85 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/30"
                    >
                      View full insights →
                    </Link>
                  </section>

                  <section className="px-6 py-7 lg:px-7 lg:py-8">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-zinc-400/88">
                      Gentle suggestion
                    </p>
                    <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-200/93">
                      It looks like you might benefit from a calming moment.
                    </p>
                    <Link
                      to="/app/wellness-tools"
                      className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-violet-400/25 bg-violet-500/[0.1] px-4 py-2.5 text-[12.5px] font-medium text-violet-100 shadow-[0_12px_40px_-20px_rgba(76,29,149,0.45)] transition-colors hover:bg-violet-500/[0.16]"
                    >
                      Try a 5-min Breathing Exercise
                    </Link>
                    <Link
                      to="/app/wellness-tools"
                      className="mt-3 block text-[11px] font-medium text-violet-300/75 hover:text-violet-200"
                    >
                      Explore more tools →
                    </Link>
                  </section>

                  <section className="px-6 py-7 lg:px-7 lg:py-8">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-zinc-400/88">
                      Reflection prompt
                    </p>
                    <p className="mt-4 text-[13.5px] leading-relaxed text-zinc-100/93">
                      What&apos;s been taking most of your emotional energy lately?
                    </p>
                    <Link
                      to="/app/journal"
                      className="mt-3 inline-flex text-[11px] font-medium text-violet-300/85 hover:text-violet-200"
                    >
                      See journal prompts →
                    </Link>
                  </section>

                  <section className="px-6 py-7 lg:px-7 lg:py-8">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-zinc-400/88">
                      Check-in streak
                    </p>
                    <div className="mt-5 flex items-center gap-5">
                      <div className="relative h-24 w-24 shrink-0">
                        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            className="stroke-zinc-800"
                            strokeWidth="2.5"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.5"
                            fill="none"
                            className="stroke-violet-500/70"
                            strokeWidth="2.5"
                            strokeDasharray="97.4"
                            strokeDashoffset={97.4 * (1 - Math.min(streakDays / 14, 1))}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-[1.1rem] font-medium text-zinc-100">{insightLoading ? "—" : streakDays}</span>
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500">days</span>
                        </div>
                      </div>
                      <p className="text-[13.5px] leading-[1.7] text-[var(--solace-muted)]">
                        Keep showing up for yourself.
                        <br />
                        You&apos;re doing great.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </aside>
          </div>

          {/* Bottom dock */}
          <div className="relative mt-10 w-full sm:mt-12 lg:mt-12">
            <div
              className="pointer-events-none absolute inset-x-0 -top-10 h-[3.25rem] bg-[linear-gradient(180deg,transparent_0%,rgba(6,10,18,0.35)_72%,rgba(6,10,18,0.58)_100%)]"
              aria-hidden
            />
            <div className="relative">
              <TalkItOutBottomDock
                density="compact"
                getSupportSlot={
                  <Button
                    asChild
                    className="min-h-[44px] rounded-full bg-gradient-to-r from-violet-600/90 to-indigo-600/90 px-6 text-[13px] text-white shadow-[0_0_28px_rgba(76,29,149,0.35)] hover:from-violet-500 hover:to-indigo-500"
                  >
                    <Link to="/app/emergency-resources">Get Support</Link>
                  </Button>
                }
              />
            </div>
          </div>
        </div>
    </div>
  );
}

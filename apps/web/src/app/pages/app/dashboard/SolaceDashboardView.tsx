import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  Clock,
  Flame,
  Heart,
  Play,
  Shield,
  Sparkles,
  Video,
  Waves,
  BookMarked,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { WellnessChallenges } from "@/app/components/WellnessChallenges";
import { PWAInstallPrompt } from "@/app/components/PWAInstallPrompt";
import type { ReactNode } from "react";
import {
  SolacePanel,
  SolaceJourneyCardVisual,
  SolaceHeroAtmosphere,
  SolaceAmbientBar,
  SolaceSupportStrip,
  type JourneyAmbiance,
} from "@/app/solace";

export interface SolaceQuickAction {
  icon: LucideIcon;
  label: string;
  description: string;
  path: string;
  accent: "violet" | "rose" | "cyan" | "amber";
}

export interface SolaceInsightItem {
  icon: LucideIcon;
  title: string;
  description: string;
  accent: "emerald" | "orange" | "sky";
}

export interface SolaceJourneyCard {
  title: string;
  duration: string;
  benefit: string;
  to: string;
  ambiance: JourneyAmbiance;
}

export interface SolaceActivityRow {
  id: string;
  type: string;
  text: string;
  time: string;
  emoji: string;
}

interface SolaceDashboardViewProps {
  firstName: string;
  greeting: string;
  companionTag: string;
  heroSubtext: string;
  portraitUrl: string;
  companionImageAlt: string;
  lastSessionLabel: string | null;
  currentMood: string;
  getMoodEmoji: (mood: string) => string;
  streakDays: number;
  upcomingSessionsCount: number;
  formatTime: (seconds: number) => string;
  creditsRemainingSeconds: number;
  creditsTotalMinutes: number;
  userPlan: string;
  creditsRemainingLow: number;
  quickActions: SolaceQuickAction[];
  journeyCards: SolaceJourneyCard[];
  insights: SolaceInsightItem[];
  insightDistributionData: { name: string; value: number; color: string }[];
  insightDistributionChartData: { name: string; value: number; color: string }[];
  insightDistributionTotal: number;
  recentActivities: SolaceActivityRow[];
  quoteLines: { line: string; attribution: string };
  mindfulMinutesDisplay: string;
  sessionsCompletedDisplay: string;
  moodSparkPhrase: string;
  sleepQualityLabel: string;
  showTrialChip: boolean;
  canCancelSubscription: boolean;
  cancelSubscriptionLoading: boolean;
  onCancelSubscription: () => void;
  supportCta: ReactNode;
  emailDialog: ReactNode;
}

function SoftSparkline({ className, seed }: { className?: string; seed: number }) {
  const w = 120;
  const h = 36;
  const pts = [0.2, 0.45, 0.35, 0.62, 0.5, 0.78, 0.66, 0.9].map((base, i) => {
    const jitter = ((seed + i * 7) % 10) / 40 - 0.125;
    const y = base + jitter;
    const x = (i / 7) * w;
    return `${x},${h - y * h}`;
  });
  return (
    <svg
      className={cn("opacity-80", className)}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={`solace-spark-${seed}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path
        d={`M ${pts.join(" L ")}`}
        stroke={`url(#solace-spark-${seed})`}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ReflectMetric({
  label,
  sub,
  sparkClass,
  sparkSeed,
  bar,
}: {
  label: string;
  sub: string;
  sparkClass: string;
  sparkSeed: number;
  bar?: boolean;
}) {
  return (
    <SolacePanel className="p-4 sm:p-5" glow="none" soft>
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--solace-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm text-zinc-200">{sub}</p>
      <div className="mt-4">
        {bar ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full w-[62%] rounded-full bg-gradient-to-r from-cyan-500/45 to-sky-400/35"
              aria-hidden
            />
          </div>
        ) : (
          <SoftSparkline className={sparkClass} seed={sparkSeed} />
        )}
      </div>
    </SolacePanel>
  );
}

function RightRailContent({
  insights,
  insightDistributionChartData,
  insightDistributionData,
  insightDistributionTotal,
  showTrialChip,
}: {
  insights: SolaceInsightItem[];
  insightDistributionChartData: { name: string; value: number; color: string }[];
  insightDistributionData: { name: string; value: number; color: string }[];
  insightDistributionTotal: number;
  showTrialChip: boolean;
}) {
  return (
    <div className="space-y-6">
      {showTrialChip && (
        <SolacePanel glow="violet" className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--solace-muted)]">
            Trial plan
          </p>
          <p className="mt-2 text-sm text-zinc-200">
            Space to breathe in — explore what feels kind for you.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-violet-500/70 to-fuchsia-500/50" />
          </div>
        </SolacePanel>
      )}

      <SolacePanel glow="cyan" soft className="p-5">
        <span className="font-serif text-4xl leading-none text-violet-400/35" aria-hidden>
          “
        </span>
        <p className="-mt-2 font-serif text-[17px] leading-relaxed text-zinc-200">
          Small steps taken with awareness create real change.
        </p>
        <p className="mt-3 text-xs text-[var(--solace-muted)]">— Solace</p>
      </SolacePanel>

      <SolacePanel glow="none" className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-normal text-[var(--solace-text)]">Your insights</h2>
          <Link
            to="/app/progress"
            className="rounded-sm text-xs font-medium text-violet-300/90 transition-colors hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
          >
            View all
          </Link>
        </div>
        <ul className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            const accent =
              insight.accent === "emerald"
                ? "text-emerald-300/80"
                : insight.accent === "orange"
                  ? "text-amber-300/80"
                  : "text-sky-300/80";
            return (
              <li key={index}>
                <div className="flex gap-3 rounded-xl border border-white/[0.04] bg-black/15 p-3 transition-colors hover:bg-white/[0.03]">
                  <div className={cn("mt-0.5 rounded-lg border border-white/[0.06] p-2", accent)}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{insight.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--solace-muted)]">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/25 p-3">
          <div className="h-44 w-full md:h-48">
            {insightDistributionChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={insightDistributionChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={64}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {insightDistributionChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "rgba(255,255,255,0.08)",
                      background: "rgba(12,12,18,0.95)",
                      color: "#e4e4e7",
                    }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-[var(--solace-muted)]">
                A gentle map forms as you talk, check in, and journal.
              </div>
            )}
          </div>
          <p className="mt-2 flex items-center justify-between text-xs text-[var(--solace-muted)]">
            <span>Total tracked</span>
            <span className="text-zinc-300">{insightDistributionTotal}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--solace-muted)]">
            {insightDistributionData.map((item) => (
              <span key={item.name} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                {item.name}: {item.value}
              </span>
            ))}
          </div>
        </div>
      </SolacePanel>

      <Link to="/app/brain-health" className="block focus-visible:outline-none">
        <SolacePanel
          glow="violet"
          className="p-5 transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(88,28,135,0.25)]"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/10 text-violet-200">
              <Brain className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">Brain health</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--solace-muted)]">
                Light exercises for clarity and nervous-system kindness.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-300/90">
                Start exercise <ArrowRight className="h-3 w-3" aria-hidden />
              </span>
            </div>
          </div>
        </SolacePanel>
      </Link>

      <WellnessChallenges variant="solace" />
    </div>
  );
}

export function SolaceDashboardView({
  firstName,
  greeting,
  companionTag,
  heroSubtext,
  portraitUrl,
  companionImageAlt,
  lastSessionLabel,
  currentMood,
  getMoodEmoji,
  streakDays,
  upcomingSessionsCount,
  formatTime,
  creditsRemainingSeconds,
  creditsTotalMinutes,
  userPlan,
  creditsRemainingLow,
  quickActions,
  journeyCards,
  insights,
  insightDistributionData,
  insightDistributionChartData,
  insightDistributionTotal,
  recentActivities,
  quoteLines,
  mindfulMinutesDisplay,
  sessionsCompletedDisplay,
  moodSparkPhrase,
  sleepQualityLabel,
  showTrialChip,
  canCancelSubscription,
  cancelSubscriptionLoading,
  onCancelSubscription,
  supportCta,
  emailDialog,
}: SolaceDashboardViewProps) {
  return (
    <>
      {emailDialog}

      <div className="relative min-h-full overflow-x-hidden pb-28 text-[var(--solace-text)] lg:pb-10">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(76,29,149,0.2),transparent_52%),radial-gradient(ellipse_70%_50%_at_100%_40%,rgba(14,165,233,0.06),transparent_42%)]"
          aria-hidden
        />

        <div className="relative z-[1] mx-auto max-w-[1680px] px-3 sm:px-5">
          <p className="mb-5 text-center font-serif text-[15px] text-zinc-400 lg:hidden">
            {greeting}, <span className="text-zinc-100">{firstName}</span>
          </p>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_min(100%,340px)] xl:items-start xl:gap-10">
            {/* Center column */}
            <div className="min-w-0 space-y-8 lg:space-y-10">
              {/* Hero */}
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              >
                <SolacePanel glow="violet" className="overflow-hidden p-0">
                  <div className="relative min-h-[300px] md:min-h-[380px]">
                    <SolaceHeroAtmosphere />
                    <div className="relative z-[2] grid min-h-[300px] md:min-h-[380px] md:grid-cols-[42%_1fr]">
                      <div className="relative min-h-[220px] md:min-h-0">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-transparent md:bg-gradient-to-r md:from-black/75 md:via-black/20 md:to-transparent" />
                        <img
                          src={portraitUrl}
                          alt={companionImageAlt}
                          className="h-full w-full object-cover object-top"
                          loading="eager"
                        />
                        <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.08]" />
                      </div>
                      <div className="relative z-10 flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-10 md:py-12">
                        <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.26em] text-violet-200/85">
                          <Sparkles className="h-3.5 w-3.5 text-violet-300/90" aria-hidden />
                          {companionTag}
                        </p>
                        <h1 className="hidden font-serif text-2xl font-normal leading-snug tracking-tight text-zinc-50 md:block lg:text-3xl">
                          {greeting}, {firstName}
                        </h1>
                        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-zinc-400 md:mt-4">
                          {heroSubtext}
                        </p>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                          <Link to="/app/session-lobby" className="inline-flex">
                            <span className="group relative inline-flex overflow-hidden rounded-full shadow-[0_0_48px_rgba(109,40,217,0.35)]">
                              <span className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-700 opacity-95 transition-opacity duration-500 group-hover:opacity-100" />
                              <span className="relative inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-medium tracking-wide text-white">
                                Continue Conversation
                                <Waves className="h-4 w-4 opacity-90" aria-hidden />
                              </span>
                            </span>
                          </Link>
                          {lastSessionLabel && (
                            <p className="text-[13px] text-zinc-500">
                              Last session · {lastSessionLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </SolacePanel>
              </motion.section>

              {/* Status — carousel mobile, grid desktop */}
              <section aria-label="Today's snapshot">
                <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-visible pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-3 md:overflow-visible lg:grid-cols-4 lg:gap-4 [&::-webkit-scrollbar]:hidden">
                  <SnapStatus
                    to="/app/mood-history"
                    glow="violet"
                    icon={Heart}
                    label="Current mood"
                    value={
                      <span className="flex items-center gap-2">
                        {currentMood}{" "}
                        <span className="text-lg" aria-hidden>
                          {getMoodEmoji(currentMood)}
                        </span>
                      </span>
                    }
                    hint="View history"
                  />
                  <SnapStatus
                    to="/app/progress"
                    glow="amber"
                    icon={Flame}
                    label="Streak"
                    value={<>{streakDays} days</>}
                    hint="Keep going"
                  />
                  <SnapStatus
                    to="/app/session-history"
                    glow="rose"
                    icon={Calendar}
                    label="Upcoming talk"
                    value={String(upcomingSessionsCount)}
                    hint="Schedule"
                  />
                  <SnapStatus
                    to="/app/billing"
                    glow="cyan"
                    icon={Clock}
                    label="Time remaining"
                    value={
                      <span className="font-mono text-lg tracking-tight">
                        {formatTime(creditsRemainingSeconds)}
                      </span>
                    }
                    hint={`${userPlan} · ${creditsTotalMinutes} min total`}
                  />
                </div>
                {creditsRemainingLow <= 50 && (
                  <p className="mt-2 text-center text-[12px] text-amber-200/70 md:text-left">
                    A soft nudge: your remaining time is getting low.
                  </p>
                )}
              </section>

              {/* Journey */}
              <section aria-label="Continue your journey">
                <div className="mb-4">
                  <h2 className="font-serif text-xl font-normal text-zinc-100">Continue your journey</h2>
                  <p className="mt-1 text-sm text-[var(--solace-muted)]">
                    Landscapes for your nervous system — start gently.
                  </p>
                </div>
                <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin] lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-4 lg:overflow-visible">
                  {journeyCards.map((card) => (
                    <Link
                      key={card.title}
                      to={card.to}
                      className="group relative min-w-[82%] shrink-0 snap-start sm:min-w-[48%] lg:min-w-0"
                    >
                      <div className="relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_28px_80px_-48px_rgba(0,0,0,0.9)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_36px_90px_-40px_rgba(76,29,149,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45">
                        <SolaceJourneyCardVisual ambiance={card.ambiance} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
                        <div className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white shadow-[0_0_26px_rgba(139,92,246,0.3)] backdrop-blur-sm transition-transform duration-500 group-hover:scale-105">
                          <Play className="h-4 w-4" fill="currentColor" aria-hidden />
                        </div>
                        <div className="relative z-10 p-5">
                          <h3 className="font-medium text-zinc-50">{card.title}</h3>
                          <p className="mt-1 text-sm text-zinc-300/95">
                            {card.duration} · {card.benefit}
                          </p>
                          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-200/90">
                            Start <ArrowRight className="h-3 w-3" aria-hidden />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Quick actions */}
              <section aria-label="Quick actions">
                <h2 className="font-serif text-xl font-normal text-zinc-100">Quick actions</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link key={action.path} to={action.path} className="block min-h-[100px]">
                        <SolacePanel
                          soft
                          glow="none"
                          className="flex h-full flex-col p-4 transition-transform duration-500 hover:-translate-y-0.5"
                        >
                          <div className="mb-2 inline-flex rounded-xl border border-white/[0.07] bg-white/[0.03] p-2 text-violet-200/90">
                            <Icon className="h-5 w-5" aria-hidden />
                          </div>
                          <p className="text-sm font-medium text-zinc-100">{action.label}</p>
                          <p className="mt-1 text-[11px] leading-snug text-[var(--solace-muted)]">
                            {action.description}
                          </p>
                        </SolacePanel>
                      </Link>
                    );
                  })}
                </div>
              </section>

              <section aria-label="Rhythm" className="space-y-3">
                <h2 className="font-serif text-xl font-normal text-zinc-100">Your rhythm</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ReflectMetric
                    label="Mindful presence"
                    sub={mindfulMinutesDisplay}
                    sparkClass="text-cyan-300/80"
                    sparkSeed={2}
                  />
                  <ReflectMetric
                    label="Sessions"
                    sub={sessionsCompletedDisplay}
                    sparkClass="text-violet-300/80"
                    sparkSeed={5}
                  />
                  <ReflectMetric
                    label="Mood arc"
                    sub={moodSparkPhrase}
                    sparkClass="text-emerald-300/75"
                    sparkSeed={8}
                  />
                  <ReflectMetric
                    label="Rest"
                    sub={sleepQualityLabel}
                    sparkClass="text-sky-300/70"
                    sparkSeed={11}
                    bar
                  />
                </div>
              </section>

              {/* Recent moments — timeline */}
              <section aria-label="Recent moments">
                <SolacePanel glow="none" soft className="p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="font-serif text-lg font-normal text-zinc-100">Recent moments</h2>
                    <Link
                      to="/app/recent-activity-history"
                      className="rounded-sm text-xs font-medium text-violet-300/90 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40"
                    >
                      View history
                    </Link>
                  </div>
                  <ul className="solace-scroll relative max-h-52 space-y-0 overflow-y-auto pr-2 md:max-h-60">
                    <li className="pointer-events-none absolute bottom-0 left-[11px] top-2 w-px bg-gradient-to-b from-violet-500/45 via-cyan-500/20 to-transparent" />
                    {recentActivities.map((activity, index) => (
                      <li key={activity.id || index} className="relative flex gap-3 pb-5 last:pb-0">
                        <span className="relative z-[1] mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-violet-400/40 bg-zinc-900 shadow-[0_0_12px_rgba(139,92,246,0.4)]" />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-start gap-2">
                            <FluentEmoji emoji={activity.emoji} size={22} className="shrink-0" />
                            <div>
                              <p className="text-sm text-zinc-200">{activity.text}</p>
                              <p className="mt-0.5 text-[11px] text-[var(--solace-muted)]">
                                {activity.time}
                              </p>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SolacePanel>
              </section>

              {canCancelSubscription && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={onCancelSubscription}
                    isLoading={cancelSubscriptionLoading}
                    disabled={cancelSubscriptionLoading}
                    className="border-rose-500/30 bg-transparent text-rose-200/90 hover:bg-rose-950/35"
                  >
                    Cancel subscription
                  </Button>
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                <SolacePanel glow="violet" soft className="p-5 sm:p-6">
                  <p className="font-serif text-[17px] leading-relaxed text-zinc-100/95">
                    {quoteLines.line}
                  </p>
                  <p className="mt-3 text-sm text-[var(--solace-muted)]">{quoteLines.attribution}</p>
                </SolacePanel>
              </motion.div>

              <PWAInstallPrompt />
            </div>

            {/* Right rail — xl+ sticky; stacks below on smaller breakpoints via grid */}
            <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
              <RightRailContent
                insights={insights}
                insightDistributionChartData={insightDistributionChartData}
                insightDistributionData={insightDistributionData}
                insightDistributionTotal={insightDistributionTotal}
                showTrialChip={showTrialChip}
              />
            </aside>
          </div>

          {/* Bottom cinematic strips — full bleed of content column */}
          <div className="mt-10 space-y-4">
            <SolaceSupportStrip getSupportSlot={supportCta} />
            <SolaceAmbientBar />
          </div>
        </div>
      </div>
    </>
  );
}

function SnapStatus({
  to,
  glow,
  icon: Icon,
  label,
  value,
  hint,
}: {
  to: string;
  glow: "violet" | "amber" | "cyan" | "rose";
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint: string;
}) {
  const glowCls =
    glow === "violet"
      ? "hover:shadow-[0_0_32px_rgba(139,92,246,0.18)]"
      : glow === "amber"
        ? "hover:shadow-[0_0_28px_rgba(251,191,36,0.14)]"
        : glow === "rose"
          ? "hover:shadow-[0_0_28px_rgba(244,63,94,0.14)]"
          : "hover:shadow-[0_0_28px_rgba(34,211,238,0.14)]";

  return (
    <Link
      to={to}
      className={cn(
        "group min-w-[78%] shrink-0 snap-center sm:min-w-0 md:snap-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
      )}
    >
      <SolacePanel
        glow={glow}
        soft
        className={cn(
          "flex min-h-[118px] flex-col p-4 transition-[transform,box-shadow] duration-500 sm:min-h-[128px] sm:p-5",
          "group-hover:-translate-y-0.5",
          glowCls
        )}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--solace-muted)]">
            {label}
          </span>
          <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        </div>
        <div className="text-lg font-medium tracking-tight text-zinc-100">{value}</div>
        <p className="mt-auto pt-2 text-[10px] text-zinc-500 transition-colors group-hover:text-zinc-400">
          {hint}
        </p>
      </SolacePanel>
    </Link>
  );
}

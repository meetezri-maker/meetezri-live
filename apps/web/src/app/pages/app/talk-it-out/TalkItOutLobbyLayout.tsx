import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Mic,
  Shield,
  Sparkles,
  User,
  Video,
  Waves,
  Wind,
  Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TALK_IT_OUT_ENVIRONMENT_THUMBS,
  TALK_IT_OUT_IMAGES,
  TALK_IT_OUT_START_CARDS,
} from "@/lib/solace/talkItOutImages";
import type { ReactNode } from "react";
import { TalkItOutBottomDock } from "./TalkItOutBottomDock";

interface ChecklistItem {
  label: string;
  checked: boolean;
}

interface UpcomingSessionLite {
  id: string;
  avatarName: string;
  avatarImage?: string;
  icon?: string;
  comment?: string;
  type: string;
  date: string;
  duration: string;
  isExpired: boolean;
}

interface TalkItOutLobbyLayoutProps {
  companionPill: string;
  companionPortraitUrl?: string;
  companionAlt: string;
  companionDisplayName: string;
  companionTraitsLine: string;
  heroMessageLine1: string;
  heroMessageLine2: string;
  heroSupporting: string;
  getSupportSlot: ReactNode;
  minutesAvailable: number;
  durations: readonly number[];
  durationDisabled: Map<number, boolean>;
  selectedDuration: number;
  applyDurationPreset: (minutes: number) => void;
  isFreeFlowActive: boolean;
  onSelectFreeFlow: () => void;
  selectedMode: "now" | "schedule";
  setSelectedMode: (m: "now" | "schedule") => void;
  setShowMinutesPicker: (open: boolean) => void;
  isStarting: boolean;
  showCarveoutBanner: boolean;
  checklistItems: ChecklistItem[];
  toggleChecklist: (index: number) => void;
  connectMode: "voice" | "video" | "deep" | "quick";
  setConnectMode: (m: "voice" | "video" | "deep" | "quick") => void;
  conversationEnergy: "gentle" | "reflective" | "grounding" | "open";
  setConversationEnergy: (e: "gentle" | "reflective" | "grounding" | "open") => void;
  selectedEnvironment: string;
  onEnvironmentSelect: (value: string) => void;
  onOpenCustomize: () => void;
  onOpenSchedule: () => void;
  upcomingSessions: UpcomingSessionLite[];
  isLoadingUpcoming: boolean;
  onSelectUpcomingRow: (session: UpcomingSessionLite) => void;
  onStartFreely: () => void;
  onStartGuided: () => void;
  onStartDeep: () => void;
  onQuickCheckInNavigate: () => void;
}

function mattePanelClass(extra?: string) {
  return cn(
    "rounded-[1.2rem] border border-white/[0.065] bg-black/22 shadow-[0_24px_72px_-52px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl",
    extra
  );
}

const SAFETY_ITEMS = [
  "This is a private space",
  "No judgement, ever",
  "End-to-end encrypted",
  "Pause or stop anytime",
];

export function TalkItOutLobbyLayout({
  companionPill,
  companionPortraitUrl,
  companionAlt,
  companionDisplayName,
  companionTraitsLine,
  heroMessageLine1,
  heroMessageLine2,
  heroSupporting,
  getSupportSlot,
  minutesAvailable,
  durations,
  durationDisabled,
  selectedDuration,
  applyDurationPreset,
  isFreeFlowActive,
  onSelectFreeFlow,
  selectedMode,
  setSelectedMode,
  setShowMinutesPicker,
  isStarting,
  showCarveoutBanner,
  checklistItems,
  toggleChecklist,
  connectMode,
  setConnectMode,
  conversationEnergy,
  setConversationEnergy,
  selectedEnvironment,
  onEnvironmentSelect,
  onOpenCustomize,
  onOpenSchedule,
  upcomingSessions,
  isLoadingUpcoming,
  onSelectUpcomingRow,
  onStartFreely,
  onStartGuided,
  onStartDeep,
  onQuickCheckInNavigate,
}: TalkItOutLobbyLayoutProps) {
  const sessionModes: { id: "voice" | "video" | "deep" | "quick"; label: string; Icon: LucideIcon }[] = [
    { id: "voice", label: "Voice", Icon: Mic },
    { id: "video", label: "Video", Icon: Video },
    { id: "deep", label: "Deep Reflection", Icon: Sparkles },
    { id: "quick", label: "Quick Release", Icon: Wind },
  ];

  const energyOptions: { id: "gentle" | "reflective" | "grounding" | "open"; label: string }[] = [
    { id: "gentle", label: "Gentle" },
    { id: "reflective", label: "Reflective" },
    { id: "grounding", label: "Grounding" },
    { id: "open", label: "Open" },
  ];

  const startCards: {
    title: string;
    body: string;
    imageSrc: string;
    onClick: () => void;
  }[] = [
    {
      title: TALK_IT_OUT_START_CARDS[0].title,
      body: "Open conversation about anything",
      imageSrc: TALK_IT_OUT_START_CARDS[0].image,
      onClick: onStartFreely,
    },
    {
      title: TALK_IT_OUT_START_CARDS[1].title,
      body: "Answer a few questions to get started",
      imageSrc: TALK_IT_OUT_START_CARDS[1].image,
      onClick: onStartGuided,
    },
    {
      title: TALK_IT_OUT_START_CARDS[2].title,
      body: "Explore your thoughts in depth",
      imageSrc: TALK_IT_OUT_START_CARDS[2].image,
      onClick: onStartDeep,
    },
    {
      title: TALK_IT_OUT_START_CARDS[3].title,
      body: "Share how you're feeling right now",
      imageSrc: TALK_IT_OUT_START_CARDS[3].image,
      onClick: onQuickCheckInNavigate,
    },
  ];

  const heroPortraitSrc = companionPortraitUrl ?? TALK_IT_OUT_IMAGES.companionPortrait;

  const checklistIcons = ["text-emerald-400", "text-sky-400", "text-violet-400", "text-amber-400"] as const;

  return (
    <>
      <motion.div className="relative min-h-[calc(100dvh-5rem)] overflow-x-hidden pb-28 text-[var(--solace-text)] lg:pb-10">
        <div className="relative z-[1] mx-auto max-w-[1680px] px-4 pt-6 sm:px-5 sm:pt-8 lg:px-8 lg:pt-10">
          <header className="mb-8 border-b border-white/[0.05] pb-8">
            <h1 className="font-serif text-[1.75rem] font-normal tracking-tight text-zinc-50 sm:text-[2rem]">
              Talk It Out
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--solace-muted)]">
              A safe space to share, reflect and grow.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_308px] xl:items-start xl:gap-x-10">
            {/* Center column */}
            <div className="min-w-0 space-y-9">
              {showCarveoutBanner && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={mattePanelClass("relative overflow-hidden p-5")}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-500/15 blur-3xl" />
                  <div className="relative flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-violet-500/15 text-violet-200 shadow-[var(--solace-glow-purple)]">
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </div>
                    <p className="text-[14px] leading-relaxed text-zinc-200/95">
                      Do you want to carve out time for the next time we talk?
                    </p>
                  </div>
                </motion.div>
              )}

              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "relative overflow-hidden rounded-[1.75rem] border border-white/[0.07]",
                  "shadow-[0_56px_120px_-58px_rgba(0,0,0,0.92),0_0_0_1px_rgba(139,92,246,0.1)]"
                )}
              >
                <img
                  src={TALK_IT_OUT_IMAGES.heroBackground}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  loading="eager"
                  decoding="async"
                />
                <div className="relative z-[2] flex min-h-[420px] flex-col items-center px-5 pb-10 pt-10 text-center sm:px-8 sm:pb-12 sm:pt-12">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#120818]/25 via-[#0a0612]/45 to-[#06040c]/78" />
                  <div
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_42%,rgba(255,180,80,0.12)_0%,transparent_62%)]"
                    aria-hidden
                  />
                  <div className="relative z-[3] flex w-full max-w-lg flex-col items-center">
                    <div className="relative mb-7 flex justify-center">
                      <div
                        className="absolute h-[108px] w-[108px] scale-110 rounded-full bg-violet-500/25 blur-2xl"
                        aria-hidden
                      />
                      <div className="relative h-[208px] w-[208px] shrink-0 overflow-hidden rounded-full border-2 border-violet-400/50 bg-black/45 shadow-[0_0_52px_rgba(139,92,246,0.4)] ring-2 ring-violet-500/20">
                        <img
                          src={heroPortraitSrc}
                          alt={companionAlt}
                          className="h-full w-full object-cover object-center"
                          loading="eager"
                          decoding="async"
                          onError={(event) => {
                            const img = event.currentTarget;
                            if (img.src.endsWith(TALK_IT_OUT_IMAGES.companionPortrait)) return;
                            img.src = TALK_IT_OUT_IMAGES.companionPortrait;
                          }}
                        />
                      </div>
                    </div>
                    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/35 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-violet-200/88">
                      <Sparkles className="h-3.5 w-3.5 text-violet-300" aria-hidden />
                      {companionPill}
                    </p>
                    <h2 className="font-serif text-[1.65rem] font-normal leading-[1.18] tracking-tight text-zinc-50 sm:text-[1.95rem]">
                      {heroMessageLine1}
                      <br />
                      {heroMessageLine2}
                    </h2>
                    <p className="mt-5 max-w-md text-[14.5px] leading-[1.65] text-zinc-400/95">{heroSupporting}</p>
                    <div className="mt-9 flex w-full max-w-sm flex-col items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMode("now");
                          setShowMinutesPicker(true);
                        }}
                        disabled={isStarting || minutesAvailable <= 0}
                        className="group relative inline-flex min-h-[52px] w-full max-w-xs items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-700 px-8 py-3.5 text-[15px] font-medium text-white shadow-[0_0_52px_rgba(109,40,217,0.42)] transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/55 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isStarting ? (
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        ) : (
                          <Video className="h-5 w-5 opacity-95" aria-hidden />
                        )}
                        Let&apos;s Talk Now
                        <Waves className="h-4 w-4 opacity-90" aria-hidden />
                      </button>
                      <p className="flex items-center gap-2 text-[12px] text-zinc-500">
                        <Shield className="h-3.5 w-3.5 text-cyan-400/80" aria-hidden />
                        Private · Secure · Judgement-free
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>

              <section aria-label="How to start">
                <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">How would you like to start?</h3>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {startCards.map(({ title, body, imageSrc, onClick }) => (
                    <button
                      key={title}
                      type="button"
                      onClick={onClick}
                      className={cn(
                        mattePanelClass(
                          "group min-h-[44px] w-full overflow-hidden p-0 text-left transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-violet-400/28 hover:shadow-[0_24px_64px_-40px_rgba(76,29,149,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
                        )
                      )}
                    >
                      <span className="relative block aspect-[16/10] w-full overflow-hidden">
                        <img
                          src={imageSrc}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                          decoding="async"
                        />
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
                      </span>
                      <span className="block px-4 py-4">
                        <p className="font-medium text-zinc-100">{title}</p>
                        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--solace-muted)]">{body}</p>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section aria-label="Preparation guidance">
                <h3 className="text-[17px] font-medium tracking-tight text-zinc-100">Before we begin</h3>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {checklistItems.map((item, idx) => {
                    const IconClass = checklistIcons[idx % checklistIcons.length];
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => toggleChecklist(idx)}
                        className={cn(
                          mattePanelClass(
                            "relative min-h-[88px] w-full overflow-hidden text-left transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-violet-400/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
                          )
                        )}
                      >
                        <img
                          src={TALK_IT_OUT_IMAGES.lotusDecor}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.42]"
                          loading="lazy"
                          decoding="async"
                        />
                        <div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#060711]/92 via-[#060711]/62 to-[#060711]/38"
                          aria-hidden
                        />
                        <div className="relative z-[1] flex gap-4 px-5 py-5">
                          <div
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-black/45 backdrop-blur-sm transition-colors",
                              item.checked
                                ? cn("border-white/[0.12]", IconClass)
                                : "border-white/[0.08] text-zinc-600"
                            )}
                          >
                            {item.checked ? (
                              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-zinc-600/80" aria-hidden />
                            )}
                          </div>
                          <p
                            className={cn(
                              "text-[13.5px] leading-snug text-zinc-200/92",
                              item.checked && "text-zinc-400/85"
                            )}
                          >
                            {item.label}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Schedule entry point — preserves scheduling flow */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  disabled={minutesAvailable <= 0 || selectedDuration > minutesAvailable}
                  className={cn(
                    "min-h-[48px] w-full rounded-[1rem] bg-gradient-to-r from-violet-600/92 to-indigo-700/92 text-[14px] text-white shadow-[0_24px_64px_-32px_rgba(76,29,149,0.55)] sm:w-auto",
                    "hover:from-violet-500 hover:to-indigo-600"
                  )}
                  onClick={() => {
                    setSelectedMode("schedule");
                    setShowMinutesPicker(false);
                    onOpenSchedule();
                  }}
                >
                  <Calendar className="mr-2 h-5 w-5 opacity-95" aria-hidden />
                  Schedule a Talk
                  <ArrowRight className="ml-2 h-4 w-4 opacity-85" aria-hidden />
                </Button>
                {!isLoadingUpcoming ? (
                  <p className="text-center text-[12px] text-[var(--solace-muted)] sm:text-left">
                    Minutes available · <span className="font-medium text-zinc-200">{minutesAvailable}</span>
                  </p>
                ) : null}
              </div>

              <section aria-label="Upcoming sessions" className={mattePanelClass("p-5 sm:p-6")}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-medium text-zinc-100">Upcoming</h3>
                  <Link
                    to="/app/session-history"
                    className="text-[11px] font-medium text-violet-300/90 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
                  >
                    View history
                  </Link>
                </div>
                {upcomingSessions.length === 0 ? (
                  <p className="text-[13px] text-[var(--solace-muted)]">No upcoming sessions scheduled.</p>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingSessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        disabled={session.isExpired}
                        onClick={() => onSelectUpcomingRow(session)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border border-white/[0.055] bg-black/25 px-4 py-3 text-left transition-colors hover:border-violet-400/28 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45",
                          session.isExpired && "border-rose-500/15 hover:border-rose-500/25"
                        )}
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-black/40">
                          {session.avatarImage ? (
                            <img src={session.avatarImage} alt="" className="h-full w-full object-cover object-top" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <User className="h-5 w-5 text-zinc-500" aria-hidden />
                            </div>
                          )}
                          {session.icon ? (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 ring ring-black/80">
                              <FluentEmoji emoji={session.icon} size={13} />
                            </span>
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-zinc-100">{session.avatarName}</p>
                          <p className="text-[11px] text-[var(--solace-muted)]">{session.date}</p>
                          {session.comment ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500/75">{session.comment}</p>
                          ) : null}
                        </div>
                        <Clock className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                        <span className="hidden text-[11px] text-zinc-500 sm:inline">{session.duration}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right rail */}
            <aside className="min-w-0 space-y-5 xl:sticky xl:top-[5.5rem] xl:self-start">
              <div className={mattePanelClass("p-5")}>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500/75">
                  Session mode
                </p>
                <p className="mt-1 text-[12px] text-[var(--solace-muted)]">Choose how you want to connect</p>
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {sessionModes.map(({ id, label, Icon }) => {
                    const active = connectMode === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setConnectMode(id)}
                        aria-pressed={active}
                        title={label}
                        className={cn(
                          "flex min-h-[68px] min-w-[44px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-[9.5px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/38",
                          active
                            ? "border-violet-400/42 bg-violet-500/[0.12] text-violet-100 shadow-[0_0_28px_rgba(139,92,246,0.25)]"
                            : "border-white/[0.06] bg-black/25 text-zinc-500 hover:border-white/[0.1]"
                        )}
                      >
                        <Icon className="h-5 w-5 opacity-95" aria-hidden strokeWidth={1.5} />
                        <span className="line-clamp-2 text-center leading-tight">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={cn(mattePanelClass("p-5"))}>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500/75">
                  Customize Solace Voice & Avatar
                </p>
                <button
                  type="button"
                  onClick={onOpenCustomize}
                  className="mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-black/28 px-3 py-2.5 text-left transition-colors hover:border-violet-400/28 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
                  aria-expanded={false}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.1] bg-black/40">
                    <img
                      src={heroPortraitSrc}
                      alt={companionAlt || companionDisplayName}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        const img = event.currentTarget;
                        if (img.src.endsWith(TALK_IT_OUT_IMAGES.companionPortrait)) return;
                        img.src = TALK_IT_OUT_IMAGES.companionPortrait;
                      }}
                    />
                  </div>
                  <span className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium leading-tight text-zinc-100">{companionDisplayName}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--solace-muted)]">
                      {companionTraitsLine}
                    </p>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                </button>
              </div>

              <div className={mattePanelClass("p-5")}>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500/75">
                  Environment
                </p>
                <p className="mt-1 text-[12px] text-[var(--solace-muted)]">Set the mood for your session</p>
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {TALK_IT_OUT_ENVIRONMENT_THUMBS.map((env) => {
                    const active = selectedEnvironment === env.value;
                    return (
                      <button
                        key={env.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onEnvironmentSelect(env.value)}
                        title={env.label}
                        className={cn(
                          "group overflow-hidden rounded-lg border bg-black/30 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45",
                          active ? "border-violet-400/55 ring-1 ring-violet-400/25" : "border-white/[0.06]"
                        )}
                      >
                        <span className="relative block aspect-[4/5] overflow-hidden">
                          <img src={env.image} alt="" className="h-full w-full object-cover opacity-95 transition-opacity group-hover:opacity-100" />
                          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        </span>
                        <span className="block px-2 py-1.5 text-[9px] font-medium uppercase tracking-wide text-zinc-400">
                          {env.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="mt-4 inline-block text-[11px] font-medium text-violet-300/92 hover:text-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35"
                  onClick={onOpenCustomize}
                >
                  View all →
                </button>
              </div>

              <div className={mattePanelClass("p-5")}>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500/75">
                  Conversation Energy
                </p>
                <p className="mt-1 text-[12px] text-[var(--solace-muted)]">
                  How would you like this session to feel?
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {energyOptions.map(({ id, label }) => {
                    const active = conversationEnergy === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setConversationEnergy(id)}
                        className={cn(
                          "min-h-[40px] rounded-full border px-4 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
                          active
                            ? "border-violet-400/42 bg-violet-500/[0.16] text-violet-50 shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                            : "border-white/[0.07] bg-black/28 text-zinc-400 hover:border-white/[0.12]"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={mattePanelClass("p-5")}>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500/75">
                  Session Length
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {durations.map((d) => {
                    const dis = !!durationDisabled.get(d);
                    const active = selectedDuration === d && !isFreeFlowActive;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={dis}
                        aria-pressed={active}
                        onClick={() => {
                          setSelectedMode("now");
                          applyDurationPreset(d);
                        }}
                        className={cn(
                          "min-h-[42px] min-w-[4.75rem] rounded-full border px-4 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35",
                          dis && "cursor-not-allowed opacity-35",
                          active
                            ? "border-violet-400/45 bg-violet-500/[0.16] text-violet-50"
                            : !dis && "border-white/[0.07] bg-black/28 text-zinc-400 hover:border-white/[0.12]"
                        )}
                      >
                        {d} min
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={isFreeFlowActive}
                    disabled={minutesAvailable <= 0}
                    onClick={() => {
                      setSelectedMode("now");
                      onSelectFreeFlow();
                    }}
                    className={cn(
                      "min-h-[42px] rounded-full border px-4 py-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/35 disabled:opacity-35",
                      isFreeFlowActive
                        ? "border-violet-400/45 bg-violet-500/[0.16] text-violet-50"
                        : "border-white/[0.07] bg-black/28 text-zinc-400 hover:border-white/[0.12]"
                    )}
                  >
                    Free flow
                  </button>
                </div>
                <p className="mt-3 text-[11px] text-[var(--solace-muted)]">
                  Selected for next session · <span className="text-zinc-300">{selectedDuration} min</span>
                </p>
              </div>

              <div className={mattePanelClass("p-5")}>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500/75">
                  Safety &amp; Comfort
                </p>
                <ul className="mt-4 space-y-2.5">
                  {SAFETY_ITEMS.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[12.5px] text-zinc-300/95">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/85" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>

          <div className="mt-14">
            <TalkItOutBottomDock getSupportSlot={getSupportSlot} />
          </div>
        </div>
      </motion.div>
    </>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import {
  Activity,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Heart,
  History,
  Loader2,
  Lock,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { SolaceHeroEnvironment } from "@/app/solace";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PROFILE_HERO_IMG,
  formatSubscriptionPlanLabel,
  profileBodyMuted,
  profileBtnGhost,
  profileBtnPrimary,
  profileCard,
  profileCardHeader,
  profileCardSubtitle,
  profileCardTitle,
  profileHeroShell,
  profileHeroStatLabel,
  profileHeroStatStrip,
  profileHeroStatValue,
  profileIconCircle,
  profileMilestoneChip,
  profilePageAtmosphere,
  profilePageFogMid,
  profilePageGlowBottom,
  profilePageGlowTop,
  profilePageNoise,
  profilePageVignette,
  profilePill,
} from "@/app/pages/app/profile/profileUi";

type MemberProfilePayload = {
  id: string;
  isSelf: boolean;
  displayName: string;
  avatarUrl: string | null;
  authorRole: "member" | "moderator" | "companion";
  selectedAvatarLabel: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  planLabel: string;
  stats: {
    completedSessions: number;
    totalCheckins: number;
    streakDays: number;
  };
  milestones: { id: string; label: string; unlocked: boolean }[];
};

function getRoleBadge(role: string) {
  const badges = {
    member: {
      className:
        "border-white/[0.08] bg-white/[0.04] text-[rgba(255,255,255,0.72)]",
      label: "Member",
    },
    moderator: {
      className: "border-cyan-400/25 bg-cyan-500/12 text-cyan-200",
      label: "Moderator",
    },
    companion: {
      className: "border-violet-400/25 bg-violet-500/12 text-violet-200",
      label: "Companion",
    },
  };
  return badges[role as keyof typeof badges] || badges.member;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function ProfilePageShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className={profilePageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={profilePageGlowTop} aria-hidden />
      <div className={profilePageFogMid} aria-hidden />
      <div className={profilePageGlowBottom} aria-hidden />
      <div className={profilePageVignette} aria-hidden />
      <div className={profilePageNoise} aria-hidden />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</div>
    </motion.div>
  );
}

export function MemberProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<MemberProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setIsPrivateAccount(false);
      try {
        const res = (await api.getCommunityMemberProfile(userId)) as MemberProfilePayload;
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          const code = (err as Error & { code?: string }).code;
          const message = err instanceof Error ? err.message.toLowerCase() : "";
          if (code === "PROFILE_PRIVATE" || message.includes("private")) {
            setIsPrivateAccount(true);
          } else {
            toast.error("Could not load this profile.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const joiningDetails = useMemo(() => {
    const created = data?.createdAt;
    if (!created) {
      return {
        joinDateLabel: "—",
        tenureLabel: "",
        onboardingDoneLabel: null as string | null,
      };
    }
    try {
      const d = parseISO(created);
      const days = differenceInCalendarDays(new Date(), d);
      let onboardingDoneLabel: string | null = null;
      const obAt = data?.onboardingCompletedAt;
      if (obAt) {
        try {
          onboardingDoneLabel = format(parseISO(obAt), "MMM d, yyyy");
        } catch {
          onboardingDoneLabel = null;
        }
      }
      return {
        joinDateLabel: format(d, "MMMM d, yyyy"),
        tenureLabel: days >= 0 ? `${days} day${days === 1 ? "" : "s"} with Solace` : "",
        onboardingDoneLabel,
      };
    } catch {
      return { joinDateLabel: "—", tenureLabel: "", onboardingDoneLabel: null };
    }
  }, [data]);

  if (loading) {
    return (
      <ProfilePageShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      </ProfilePageShell>
    );
  }

  if (!data || !userId) {
    return (
      <ProfilePageShell>
        <div className="mb-6">
          <Link to="/app/community" className={cn(profileBtnGhost, "inline-flex h-9 px-3 py-2 text-xs")}>
            <ArrowLeft className="h-4 w-4" />
            Community
          </Link>
        </div>
        <div className="mx-auto max-w-md space-y-4 py-16 text-center">
          {isPrivateAccount ? (
            <>
              <span className={cn(profileIconCircle("violet"), "mx-auto h-12 w-12")}>
                <Lock className="h-5 w-5" />
              </span>
              <h1 className="text-lg font-semibold text-[rgba(255,255,255,0.92)]">Member profile</h1>
              <p className="text-sm text-[rgba(255,255,255,0.55)]">This account is private.</p>
            </>
          ) : (
            <p className={profileBodyMuted}>This profile isn&apos;t available or doesn&apos;t exist.</p>
          )}
          <Link to="/app/community" className={cn(profileBtnGhost, "inline-flex")}>
            <ArrowLeft className="h-4 w-4" />
            Back to community
          </Link>
        </div>
      </ProfilePageShell>
    );
  }

  const rb = getRoleBadge(data.authorRole);
  const planPill = formatSubscriptionPlanLabel(data.planLabel);
  const pageTitle = data.isSelf ? "My Profile" : "Member profile";
  const companionLabel =
    data.selectedAvatarLabel &&
    data.selectedAvatarLabel.trim() &&
    !/^default\b/i.test(data.selectedAvatarLabel.trim())
      ? data.selectedAvatarLabel.trim()
      : null;

  return (
    <ProfilePageShell>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link to="/app/community" className={cn(profileBtnGhost, "inline-flex h-9 px-3 py-2 text-xs")}>
          <ArrowLeft className="h-4 w-4" />
          Community
        </Link>
        {data.isSelf ? (
          <Link to="/app/user-profile" className={cn(profileBtnPrimary, "inline-flex h-9 px-4 py-2 text-xs")}>
            My profile &amp; settings
          </Link>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 sm:mb-10"
      >
        <div className="inline-flex max-w-2xl flex-col gap-2 sm:gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/80 sm:text-xs">
            {data.isSelf ? "Profile" : "Community"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[rgba(255,255,255,0.96)] [text-shadow:0_0_32px_rgba(167,139,250,0.2)] sm:text-4xl">
            {pageTitle}
          </h1>
          <p className="text-sm leading-relaxed text-[rgba(255,255,255,0.68)] sm:text-base">
            {data.isSelf
              ? "This is how your profile appears to other members."
              : "What other members can see about this person—no private contact or account details."}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[4fr_6fr]">
        <div className="min-w-0 space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.06 }}
            className={cn(profileCard, "overflow-hidden p-0")}
          >
            <SolaceHeroEnvironment
              imageSrc={PROFILE_HERO_IMG}
              imageAlt="Calm moonlit sanctuary"
              cinematicDepth
              className={cn(profileHeroShell, "rounded-none border-0 shadow-none")}
              contentClassName="flex min-h-[220px] flex-col p-0 sm:min-h-[260px]"
            >
              <div className="flex flex-1 flex-col justify-end p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="relative mx-auto shrink-0 sm:mx-0">
                    <div className="relative h-24 w-24 overflow-hidden rounded-full border-[3px] border-violet-300/35 shadow-[0_0_48px_-6px_rgba(167,139,250,0.65),inset_0_0_0_1px_rgba(255,255,255,0.12)] sm:h-28 sm:w-28">
                      {data.avatarUrl ? (
                        <img
                          src={data.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-900/80 to-fuchsia-900/60 text-3xl font-bold text-violet-100 sm:text-4xl">
                          {initials(data.displayName)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2 pb-1 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <h2 className="text-xl font-bold leading-tight text-[rgba(255,255,255,0.96)] sm:text-2xl">
                        {data.displayName}
                      </h2>
                      <span
                        className={cn(
                          profilePill,
                          "shrink-0 border px-2.5 py-0.5 text-[10px]",
                          rb.className
                        )}
                      >
                        {rb.label}
                      </span>
                    </div>
                    <span
                      className={cn(
                        profilePill,
                        "inline-flex border-violet-400/25 bg-violet-500/18 text-violet-100"
                      )}
                    >
                      {planPill}
                    </span>

                    {companionLabel ? (
                      <div className="flex items-start justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 sm:justify-start">
                        <Users className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-300" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(255,255,255,0.45)]">
                            Solace companion
                          </p>
                          <p className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">
                            {companionLabel}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <motion.div className={profileHeroStatStrip}>
                <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
                  {[
                    { icon: Activity, label: "Talk it out", value: data.stats.completedSessions, tone: "violet" as const },
                    { icon: Heart, label: "Check-ins", value: data.stats.totalCheckins, tone: "pink" as const },
                    { icon: Trophy, label: "Days streak", value: data.stats.streakDays, tone: "amber" as const },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex min-w-[3.5rem] flex-col items-center gap-1.5 px-3 py-4 sm:py-5"
                    >
                      <span className={profileIconCircle(s.tone)}>
                        <s.icon className="h-4 w-4" />
                      </span>
                      <span className={cn("text-center", profileHeroStatValue)}>{s.value}</span>
                      <span className={cn("text-center", profileHeroStatLabel)}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </SolaceHeroEnvironment>
          </motion.div>
        </div>

        <div className="min-w-0 space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={profileCard}
          >
            <div className={profileCardHeader}>
              <div>
                <h3 className={cn(profileCardTitle, "flex items-center gap-2")}>
                  <span className={profileIconCircle("violet")}>
                    <CalendarCheck className="h-4 w-4" />
                  </span>
                  Member activity
                </h3>
                <p className={profileCardSubtitle}>
                  {data.isSelf
                    ? "Your journey and plan—visible to community"
                    : "Journey and plans—visible to community"}
                </p>
              </div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-right shadow-[0_0_28px_-10px_rgba(139,92,246,0.35)]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
                  Talk it out
                </p>
                <p className="text-2xl font-bold tabular-nums text-[rgba(255,255,255,0.96)]">
                  {data.stats.completedSessions}
                </p>
                <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.55)]">
                  Check-ins: {data.stats.totalCheckins} · Streak {data.stats.streakDays}d
                </p>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
                    Member since
                  </dt>
                  <dd className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">
                    {joiningDetails.joinDateLabel}
                  </dd>
                </div>
                {joiningDetails.tenureLabel ? (
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
                      Tenure
                    </dt>
                    <dd className="text-sm font-semibold text-[rgba(255,255,255,0.92)]">
                      {joiningDetails.tenureLabel}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
                    Onboarding
                  </dt>
                  <dd
                    className={cn(
                      "text-sm font-semibold",
                      data.onboardingCompleted
                        ? "text-emerald-300"
                        : "text-[rgba(255,255,255,0.55)]"
                    )}
                  >
                    {joiningDetails.onboardingDoneLabel ||
                      (data.onboardingCompleted ? "Complete" : "In progress")}
                  </dd>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 sm:col-span-2">
                  <span className={profileIconCircle("pink")}>
                    <History className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.45)]">
                      Activity summary
                    </p>
                    <p className="text-sm text-[rgba(255,255,255,0.72)]">
                      {data.stats.completedSessions} talks completed · {data.stats.totalCheckins}{" "}
                      check-ins · {data.stats.streakDays} day streak
                    </p>
                  </div>
                </div>
              </dl>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className={profileCard}
          >
            <div className={profileCardHeader}>
              <div>
                <h3 className={cn(profileCardTitle, "flex items-center gap-2")}>
                  <Trophy className="h-5 w-5 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.45)]" />
                  Milestones
                </h3>
                <p className={profileCardSubtitle}>Progress badges others can see</p>
              </div>
            </div>
            <ul className="grid gap-2 p-5 sm:grid-cols-2 sm:p-6">
              {data.milestones.map((m) => (
                <li key={m.id} className={profileMilestoneChip(m.unlocked)}>
                  {m.unlocked ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-zinc-600" />
                  )}
                  <span className={m.unlocked ? "font-medium text-[rgba(255,255,255,0.92)]" : ""}>
                    {m.label}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-[11px] text-[rgba(255,255,255,0.4)]">
        <Sparkles className="h-3.5 w-3.5 text-violet-400/80" />
        Email, phone, and emergency contacts are never shown on public member profiles.
      </p>
    </ProfilePageShell>
  );
}

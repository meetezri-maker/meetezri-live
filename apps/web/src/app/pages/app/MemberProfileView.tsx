import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Circle,
  History,
  Loader2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AppLayout } from "@/app/components/AppLayout";
import { Button } from "@/app/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

const GRAD =
  "linear-gradient(135deg, #ff7a18 0%, #ff5c87 48%, #e040fb 100%)";
const GRAD_SOFT =
  "linear-gradient(135deg, rgba(255,122,24,0.12) 0%, rgba(224,64,251,0.1) 100%)";
const CARD_SHELL =
  "rounded-[1.25rem] bg-white dark:bg-gray-950 shadow-[0_4px_24px_rgba(15,23,42,0.06)] border border-gray-100/90 dark:border-gray-800";

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
      bg: "bg-gray-100 dark:bg-slate-800",
      text: "text-gray-700 dark:text-slate-200",
      label: "Member",
    },
    moderator: {
      bg: "bg-blue-100 dark:bg-blue-900/40",
      text: "text-blue-700 dark:text-blue-200",
      label: "Moderator",
    },
    companion: {
      bg: "bg-purple-100 dark:bg-purple-900/40",
      text: "text-purple-700 dark:text-purple-200",
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

export function MemberProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<MemberProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = (await api.getCommunityMemberProfile(userId)) as MemberProfilePayload;
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) {
          setData(null);
          toast.error("Could not load this profile.");
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
      <AppLayout>
        <div className="relative min-h-[50vh] bg-[#eef0f4] dark:bg-[#0c0e12]">
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data || !userId) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-muted-foreground">This profile isn’t available or doesn’t exist.</p>
          <Button variant="outline" asChild>
            <Link to="/app/community">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to community
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const rb = getRoleBadge(data.authorRole);
  const companionLabel =
    data.selectedAvatarLabel &&
    data.selectedAvatarLabel.trim() &&
    !/^default\b/i.test(data.selectedAvatarLabel.trim())
      ? data.selectedAvatarLabel.trim()
      : null;

  return (
    <AppLayout>
      <div className="relative min-h-screen bg-[#eef0f4] dark:bg-[#0c0e12] overflow-hidden">
        <div className="pointer-events-none absolute -top-28 -right-20 h-[28rem] w-[28rem] rounded-[3rem] bg-gradient-to-bl from-orange-400/30 via-pink-400/15 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -left-24 h-80 w-80 rounded-[2.5rem] bg-gradient-to-tr from-fuchsia-500/12 to-amber-300/10 blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 text-gray-600 dark:text-gray-300" asChild>
              <Link to="/app/community">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Community
              </Link>
            </Button>
            {data.isSelf ? (
              <Button
                size="sm"
                className="text-white shadow-md border-0"
                style={{ background: GRAD }}
                asChild
              >
                <Link to="/app/user-profile">My profile &amp; settings</Link>
              </Button>
            ) : null}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 sm:mb-10"
          >
            <div className="inline-flex flex-col gap-2 sm:gap-3 max-w-2xl">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-orange-600/90 dark:text-orange-400/90">
                Community
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
                Member profile
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                {data.isSelf
                  ? "This is how your profile appears to other members."
                  : "What other members can see about this person—no private contact or account details."}
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-6">
            {/* LEFT — public identity + stats (safe for viewers) */}
            <div className="space-y-5 min-w-0">
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 }}
              >
                <div className={`${CARD_SHELL} overflow-hidden`}>
                  <div className="relative aspect-[4/3] max-h-64 sm:max-h-72 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                    <div className="absolute inset-0 opacity-35" style={{ background: GRAD }} />
                    <div className="absolute inset-4 sm:inset-6 rounded-2xl overflow-hidden border-4 border-white/90 dark:border-gray-800 shadow-xl bg-gray-200 dark:bg-gray-700">
                      {data.avatarUrl ? (
                        <img
                          src={data.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-200 to-blue-200 text-5xl font-bold text-purple-900 dark:from-purple-900 dark:to-blue-900 dark:text-purple-100">
                          {initials(data.displayName)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pt-5 pb-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                        {data.displayName}
                      </h2>
                      <span
                        className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${rb.bg} ${rb.text}`}
                      >
                        {rb.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Plan ·{" "}
                      <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {data.planLabel}
                      </span>
                    </p>

                    {companionLabel ? (
                      <div className="mb-4 flex items-start gap-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2.5">
                        <Users className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">
                            Solace companion
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {companionLabel}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex justify-center gap-4 sm:gap-6 py-4 rounded-2xl bg-gray-50/90 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                      {[
                        { label: "Talk it out", value: data.stats.completedSessions },
                        { label: "Check-ins", value: data.stats.totalCheckins },
                        { label: "Days streak", value: data.stats.streakDays },
                      ].map((s) => (
                        <div key={s.label} className="flex flex-col items-center min-w-[3.5rem]">
                          <span className="text-xl font-black bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent tabular-nums">
                            {s.value}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider text-center">
                            {s.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* RIGHT — activity & milestones (community-safe) */}
            <div className="space-y-5 min-w-0">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={`${CARD_SHELL} overflow-hidden`}
              >
                <div className="bg-gradient-to-r from-orange-50/80 via-white to-pink-50/50 dark:from-orange-950/20 dark:via-gray-950 dark:to-fuchsia-950/20 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-orange-500" />
                    Member activity
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Joining and plan — visible in community
                  </p>
                </div>
                <div className="p-5 sm:p-6">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-gray-400">Member since</dt>
                      <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                        {joiningDetails.joinDateLabel}
                      </dd>
                    </div>
                    {joiningDetails.tenureLabel ? (
                      <div>
                        <dt className="text-[10px] uppercase tracking-wider text-gray-400">Tenure</dt>
                        <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                          {joiningDetails.tenureLabel}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="text-[10px] uppercase tracking-wider text-gray-400">Onboarding</dt>
                      <dd
                        className={`text-sm font-semibold ${
                          data.onboardingCompleted
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-gray-500"
                        }`}
                      >
                        {joiningDetails.onboardingDoneLabel ||
                          (data.onboardingCompleted ? "Complete" : "In progress")}
                      </dd>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3" style={{ background: GRAD_SOFT }}>
                      <History className="w-5 h-5 text-fuchsia-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Talk it out</p>
                        <p className="text-2xl font-black bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent tabular-nums">
                          {data.stats.completedSessions}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Check-ins: {data.stats.totalCheckins} · Streak {data.stats.streakDays}d
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
                className={`${CARD_SHELL} overflow-hidden`}
              >
                <div className="bg-gradient-to-r from-amber-50/80 via-white to-orange-50/40 dark:from-amber-950/25 dark:via-gray-950 dark:to-orange-950/20 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    Milestones
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    Progress badges others can see
                  </p>
                </div>
                <div className="p-5 sm:p-6">
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {data.milestones.map((m) => (
                      <li
                        key={m.id}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                          m.unlocked
                            ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                            : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30"
                        }`}
                      >
                        {m.unlocked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                        )}
                        <span
                          className={
                            m.unlocked
                              ? "text-gray-900 dark:text-gray-100 font-medium"
                              : "text-gray-400"
                          }
                        >
                          {m.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            </div>
          </div>

          <p className="mt-8 text-center text-[11px] text-gray-400 dark:text-gray-500 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-orange-400/80" />
            Email, phone, and emergency contacts are never shown on public member profiles.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

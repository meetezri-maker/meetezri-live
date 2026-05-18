import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { motion } from "motion/react";
import {
  Trophy,
  Star,
  CheckCircle2,
  Lock,
  UserPlus,
  UserMinus,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SolacePanel } from "@/app/solace/SolacePanel";

import {
  mapWellnessChallengeDashboardToRows,
  type WellnessChallengeDashboardPayload as DashboardPayload,
  type WellnessChallengeRow as ChallengeRow,
} from "@/app/features/wellness/challengesMapper";

interface WellnessChallengesProps {
  /** Dark cinematic shell for Solace dashboard rail */
  variant?: "default" | "solace";
}

export function WellnessChallenges({ variant = "default" }: WellnessChallengesProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalPoints: 0,
    currentLevel: 1,
    pointsToNextLevel: 250,
    levelProgressPercent: 0,
  });
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const solace = variant === "solace";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const raw = (await api.wellness.getChallengesForMe()) as DashboardPayload;
        if (cancelled) return;
        setSummary({
          totalPoints: raw.totalPoints ?? 0,
          currentLevel: raw.currentLevel ?? 1,
          pointsToNextLevel: raw.pointsToNextLevel ?? 250,
          levelProgressPercent:
            typeof raw.levelProgressPercent === "number"
              ? raw.levelProgressPercent
              : 0,
        });
        setChallenges(mapWellnessChallengeDashboardToRows(raw));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load challenges");
          setChallenges([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleJoinToggle = useCallback(
    async (challenge: ChallengeRow) => {
      if (joiningId || challenge.isCompleted || challenge.isLocked) return;
      setJoiningId(challenge.id);
      try {
        if (challenge.isJoined) {
          await api.wellness.unjoinChallenge(challenge.id);
          setChallenges((prev) =>
            prev.map((c) => (c.id === challenge.id ? { ...c, isJoined: false } : c))
          );
        } else {
          await api.wellness.joinChallenge(challenge.id);
          setChallenges((prev) =>
            prev.map((c) => (c.id === challenge.id ? { ...c, isJoined: true } : c))
          );
        }
      } catch {
        // Silently fail
      } finally {
        setJoiningId(null);
      }
    },
    [joiningId]
  );

  const displayChallenges = useMemo(() => challenges.slice(0, 6), [challenges]);

  const { totalPoints, currentLevel, pointsToNextLevel, levelProgressPercent } = summary;

  if (loading) {
    if (solace) {
      return (
        <SolacePanel glow="amber" soft className="p-5">
          <div className="mb-4 flex justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-40 bg-white/10" />
              <Skeleton className="h-3 w-56 bg-white/5" />
            </div>
            <Skeleton className="h-12 w-16 rounded-xl bg-white/10" />
          </div>
          <Skeleton className="mb-5 h-2 w-full rounded-full bg-white/10" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        </SolacePanel>
      );
    }
    return (
      <Card className="p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-14 w-24" />
        </div>
        <Skeleton className="mb-6 h-3 w-full rounded-full" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  const content = (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Trophy
              className={cn("h-6 w-6", solace ? "text-violet-300/90" : "text-primary")}
            />
            <h2
              className={cn(
                "text-xl font-semibold tracking-tight",
                solace ? "font-serif text-lg text-[var(--solace-text)]" : "font-bold"
              )}
            >
              Wellness Challenges
            </h2>
          </div>
          <p
            className={cn(
              "text-sm",
              solace ? "text-[var(--solace-muted)]" : "text-muted-foreground"
            )}
          >
            Complete challenges to earn points and level up
          </p>
          {error && (
            <p
              className={cn(
                "mt-2 text-sm",
                solace ? "text-amber-300/90" : "text-amber-600 dark:text-amber-400"
              )}
            >
              {error}
            </p>
          )}
        </div>
        <div className="text-center">
          <div
            className={cn(
              "text-3xl font-bold",
              solace
                ? "bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent"
                : "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
            )}
          >
            Level {currentLevel}
          </div>
          <div
            className={cn("text-xs", solace ? "text-[var(--solace-muted)]" : "text-muted-foreground")}
          >
            {totalPoints} points
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span
            className={cn(
              "text-sm font-medium",
              solace ? "text-zinc-300" : ""
            )}
          >
            Next Level
          </span>
          <span
            className={cn(
              "text-sm",
              solace ? "text-[var(--solace-muted)]" : "text-muted-foreground"
            )}
          >
            {pointsToNextLevel} points needed
          </span>
        </div>
        <div
          className={cn(
            "h-3 w-full overflow-hidden rounded-full",
            solace ? "bg-white/[0.07]" : "bg-gray-200 dark:bg-slate-700"
          )}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(100, Math.max(0, levelProgressPercent))}%`,
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              solace
                ? "bg-gradient-to-r from-violet-500/80 to-cyan-500/70"
                : "bg-gradient-to-r from-primary to-secondary"
            )}
          />
        </div>
      </div>

      {displayChallenges.length === 0 ? (
        <p
          className={cn(
            "py-6 text-center text-sm",
            solace ? "text-[var(--solace-muted)]" : "text-muted-foreground"
          )}
        >
          No active wellness challenges right now. Check back when your team publishes new
          challenges, or open the full list below.
        </p>
      ) : (
        <div className="space-y-3">
          {displayChallenges.map((challenge, index) => {
            const Icon = challenge.icon;
            const progressPercentage = Math.min(
              100,
              (challenge.progress / challenge.target) * 100
            );

            const isJoiningThis = joiningId === challenge.id;

            return (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={cn(
                    "rounded-xl p-4 transition-all",
                    solace && "border border-white/[0.08] bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                    !solace && "rounded-xl border bg-card",
                    challenge.isLocked && "opacity-50",
                    !solace &&
                      !challenge.isLocked &&
                      challenge.isCompleted &&
                      "border-emerald-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-950/30 dark:to-emerald-950/30",
                    solace &&
                      !challenge.isLocked &&
                      challenge.isCompleted &&
                      "border-emerald-500/25 bg-emerald-950/25"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <motion.div
                      whileHover={challenge.isCompleted ? { scale: 1.1, rotate: 5 } : {}}
                      className={cn(
                        "relative flex-shrink-0 rounded-xl bg-gradient-to-br p-3 text-white",
                        challenge.color
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      {challenge.isCompleted && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -right-1 -top-1 rounded-full bg-emerald-500 p-0.5"
                        >
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </motion.div>
                      )}
                      {challenge.isLocked && (
                        <div className="absolute -right-1 -top-1 rounded-full bg-gray-500 p-0.5">
                          <Lock className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </motion.div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                            <h3
                              className={cn(
                                "font-bold",
                                solace ? "text-sm text-zinc-100" : ""
                              )}
                            >
                              {challenge.title}
                            </h3>
                            {challenge.isJoined && !challenge.isCompleted && (
                              <span
                                className={cn(
                                  "rounded-full px-1.5 py-0.5 text-xs font-medium",
                                  solace
                                    ? "border border-violet-400/25 bg-violet-500/15 text-violet-200"
                                    : "bg-primary/10 text-primary"
                                )}
                              >
                                Enrolled
                              </span>
                            )}
                          </div>
                          <p
                            className={cn(
                              "text-sm",
                              solace ? "text-[var(--solace-muted)]" : "text-muted-foreground"
                            )}
                          >
                            {challenge.description}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          <div
                            className={cn(
                              "rounded-full px-2 py-1 text-xs font-medium",
                              solace
                                ? "border border-white/10 bg-white/[0.04] text-zinc-300"
                                : "bg-gray-100 dark:bg-slate-800"
                            )}
                          >
                            {challenge.difficulty}
                          </div>
                          <div className="flex items-center gap-1 text-amber-400/90">
                            <Star className="h-3 w-3 fill-amber-400/90" />
                            <span className="text-xs font-bold">+{challenge.reward}</span>
                          </div>
                        </div>
                      </div>

                      {!challenge.isLocked && (
                        <>
                          <div
                            className={cn(
                              "mb-2 h-2 w-full overflow-hidden rounded-full",
                              solace ? "bg-white/[0.06]" : "bg-gray-200 dark:bg-slate-700"
                            )}
                          >
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercentage}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full",
                                challenge.isCompleted
                                  ? solace
                                    ? "bg-emerald-500/80"
                                    : "bg-green-500"
                                  : `bg-gradient-to-r ${challenge.color}`
                              )}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span
                              className={cn(
                                "text-xs",
                                solace ? "text-[var(--solace-muted)]" : "text-muted-foreground"
                              )}
                            >
                              {challenge.progress} / {challenge.target} completed
                            </span>
                            {challenge.isCompleted ? (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className={cn(
                                  "text-xs font-bold",
                                  solace ? "text-emerald-300" : "text-green-600 dark:text-green-400"
                                )}
                              >
                                ✓ Completed
                              </motion.span>
                            ) : (
                              <span
                                className={cn(
                                  "text-xs font-medium",
                                  solace ? "text-violet-300/90" : "text-primary"
                                )}
                              >
                                {Math.round(progressPercentage)}%
                              </span>
                            )}
                          </div>
                        </>
                      )}

                      {challenge.isLocked && (
                        <div
                          className={cn(
                            "text-xs italic",
                            solace ? "text-zinc-500" : "text-muted-foreground"
                          )}
                        >
                          Complete previous challenges to unlock
                        </div>
                      )}

                      {!challenge.isLocked && !challenge.isCompleted && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant={challenge.isJoined ? "outline" : "default"}
                            className={cn(
                              "h-7 gap-1 text-xs",
                              solace &&
                                "border-white/15 bg-white/[0.06] text-zinc-100 hover:bg-white/10"
                            )}
                            disabled={isJoiningThis}
                            onClick={() => handleJoinToggle(challenge)}
                          >
                            {isJoiningThis ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : challenge.isJoined ? (
                              <UserMinus className="h-3 w-3" />
                            ) : (
                              <UserPlus className="h-3 w-3" />
                            )}
                            {isJoiningThis ? "…" : challenge.isJoined ? "Leave" : "Join"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6"
      >
        <Button
          className={cn(
            "w-full",
            solace &&
              "border border-white/12 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
          )}
          variant="outline"
          onClick={() => navigate("/app/challenges")}
        >
          View All Challenges
        </Button>
      </motion.div>
    </>
  );

  if (solace) {
    return (
      <SolacePanel glow="amber" soft className="p-5">
        {content}
      </SolacePanel>
    );
  }

  return <Card className="p-6 shadow-xl">{content}</Card>;
}

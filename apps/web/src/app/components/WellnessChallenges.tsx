import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { motion } from "motion/react";
import {
  Trophy,
  Target,
  Flame,
  Star,
  Zap,
  Heart,
  CheckCircle2,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/api";

import {
  mapWellnessChallengeDashboardToRows,
  type WellnessChallengeDashboardPayload as DashboardPayload,
  type WellnessChallengeRow as ChallengeRow,
} from "@/app/features/wellness/challengesMapper";

export function WellnessChallenges() {
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

  const displayChallenges = useMemo(() => challenges.slice(0, 6), [challenges]);

  const {
    totalPoints,
    currentLevel,
    pointsToNextLevel,
    levelProgressPercent,
  } = summary;

  if (loading) {
    return (
      <Card className="p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-14 w-24" />
        </div>
        <Skeleton className="h-3 w-full mb-6 rounded-full" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Wellness Challenges</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete challenges to earn points and level up
          </p>
          {error && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">{error}</p>
          )}
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Level {currentLevel}
          </div>
          <div className="text-xs text-muted-foreground">{totalPoints} points</div>
        </div>
      </div>

      {/* Level Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Next Level</span>
          <span className="text-sm text-muted-foreground">
            {pointsToNextLevel} points needed
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.min(100, Math.max(0, levelProgressPercent))}%`,
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
          />
        </div>
      </div>

      {/* Challenges */}
      {displayChallenges.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No active wellness challenges right now. Check back when your team publishes
          new challenges, or open the full list below.
        </p>
      ) : (
        <div className="space-y-4">
          {displayChallenges.map((challenge, index) => {
            const Icon = challenge.icon;
            const progressPercentage = Math.min(
              100,
              (challenge.progress / challenge.target) * 100
            );

            return (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`p-4 transition-all ${
                    challenge.isLocked
                      ? "opacity-50 cursor-not-allowed"
                      : challenge.isCompleted
                        ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800"
                        : "hover:shadow-lg cursor-pointer"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <motion.div
                      whileHover={challenge.isCompleted ? { scale: 1.1, rotate: 5 } : {}}
                      className={`p-3 rounded-xl bg-gradient-to-br ${challenge.color} text-white flex-shrink-0 relative`}
                    >
                      <Icon className="w-6 h-6" />
                      {challenge.isCompleted && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5"
                        >
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </motion.div>
                      )}
                      {challenge.isLocked && (
                        <div className="absolute -top-1 -right-1 bg-gray-500 rounded-full p-0.5">
                          <Lock className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="font-bold">{challenge.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {challenge.description}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded-full text-xs font-medium">
                            {challenge.difficulty}
                          </div>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3 fill-amber-500" />
                            <span className="text-xs font-bold">+{challenge.reward}</span>
                          </div>
                        </div>
                      </div>

                      {!challenge.isLocked && (
                        <>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mb-2 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercentage}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full ${
                                challenge.isCompleted
                                  ? "bg-green-500"
                                  : `bg-gradient-to-r ${challenge.color}`
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {challenge.progress} / {challenge.target} completed
                            </span>
                            {challenge.isCompleted ? (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-xs font-bold text-green-600 dark:text-green-400"
                              >
                                ✓ Completed
                              </motion.span>
                            ) : (
                              <span className="text-xs font-medium text-primary">
                                {Math.round(progressPercentage)}%
                              </span>
                            )}
                          </div>
                        </>
                      )}

                      {challenge.isLocked && (
                        <div className="text-xs text-muted-foreground italic">
                          🔒 Complete previous challenges to unlock
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
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
          className="w-full"
          variant="outline"
          onClick={() => navigate("/app/challenges")}
        >
          View All Challenges
        </Button>
      </motion.div>
    </Card>
  );
}

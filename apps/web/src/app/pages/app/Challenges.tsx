import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
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
  Award,
  Clock,
  UserPlus,
  UserMinus,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, isApiError } from "@/lib/api";
import { toast } from "sonner";
import {
  challengeLimitRestriction,
  membershipKeyForApiValue,
} from "@/app/utils/membershipCopy";
import {
  mapWellnessChallengeDashboardToRows,
  type WellnessChallengeDashboardPayload,
  type WellnessChallengeRow,
} from "@/app/features/wellness/challengesMapper";

function formatCategoryBadge(categoryLabel?: string | null) {
  const label = (categoryLabel || "General").trim();
  const key = label.toLowerCase();
  if (key.includes("mind")) return { label, className: "bg-purple-100 text-purple-700" };
  if (key.includes("sleep")) return { label, className: "bg-indigo-100 text-indigo-700" };
  if (key.includes("journal")) return { label, className: "bg-pink-100 text-pink-700" };
  if (key.includes("habit")) return { label, className: "bg-orange-100 text-orange-700" };
  if (key.includes("exerc") || key.includes("fitness")) return { label, className: "bg-green-100 text-green-700" };
  return { label, className: "bg-blue-100 text-blue-700" };
}

function formatEndDate(endDate?: string | null) {
  if (!endDate) return null;
  const d = new Date(endDate);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "Ended";
  if (diffDays === 0) return "Ends today";
  if (diffDays === 1) return "1 day left";
  return `${diffDays} days left`;
}

function getUserChallengeStatus(challenge: WellnessChallengeRow): {
  label: string;
  className: string;
  helperText: string;
} {
  if (challenge.isLocked) {
    return {
      label: "Locked",
      className: "bg-gray-100 text-gray-700",
      helperText: "Finish earlier challenges to unlock this one.",
    };
  }
  if (challenge.isCompleted) {
    return {
      label: "Completed",
      className: "bg-green-100 text-green-700",
      helperText: "Great work. Reward points are already counted.",
    };
  }
  if (challenge.isJoined) {
    return {
      label: "In Progress",
      className: "bg-blue-100 text-blue-700",
      helperText: "Keep going to reach the target and complete it.",
    };
  }
  return {
    label: "Not Joined",
    className: "bg-amber-100 text-amber-700",
    helperText: "Join this challenge to start tracking progress.",
  };
}

export function Challenges() {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalPoints: 0,
    currentLevel: 1,
    pointsToNextLevel: 250,
    levelProgressPercent: 0,
  });
  const [challenges, setChallenges] = useState<WellnessChallengeRow[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadChallenges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const raw = (await api.wellness.getChallengesForMe()) as WellnessChallengeDashboardPayload;
      setSummary({
        totalPoints: raw.totalPoints ?? 0,
        currentLevel: raw.currentLevel ?? 1,
        pointsToNextLevel: raw.pointsToNextLevel ?? 250,
        levelProgressPercent: typeof raw.levelProgressPercent === "number" ? raw.levelProgressPercent : 0,
      });
      setChallenges(mapWellnessChallengeDashboardToRows(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load challenges");
      setChallenges([]);
      setSummary({ totalPoints: 0, currentLevel: 1, pointsToNextLevel: 250, levelProgressPercent: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  const handleJoinToggle = useCallback(async (challenge: WellnessChallengeRow) => {
    if (joiningId || challenge.isCompleted || challenge.isLocked) return;
    setJoiningId(challenge.id);
    try {
      if (challenge.isJoined) {
        await api.wellness.unjoinChallenge(challenge.id);
        setChallenges(prev =>
          prev.map(c => c.id === challenge.id ? { ...c, isJoined: false } : c)
        );
        toast.success(`You left "${challenge.title}"`);
      } else {
        await api.wellness.joinChallenge(challenge.id);
        setChallenges(prev =>
          prev.map(c => c.id === challenge.id ? { ...c, isJoined: true } : c)
        );
        toast.success(`You joined "${challenge.title}"`);
      }
    } catch (e) {
      // The membership limit is a real, actionable state — not a generic failure. The API
      // returns the membership, the cap, the current count and the upgrade target, so surface
      // those rather than a bare message, and offer the upgrade directly.
      if (isApiError(e) && e.code === "ACTIVE_CHALLENGE_LIMIT_REACHED") {
        const limit = Number(e.body.maxActiveChallenges ?? 0);
        const upgradeTo = membershipKeyForApiValue(e.body.upgradeMembership);
        const restriction = challengeLimitRestriction({
          membership: membershipKeyForApiValue(e.body.membership) ?? "discover",
          limit,
          upgradeTo,
        });

        toast.error(restriction.title, {
          description: restriction.body,
          ...(upgradeTo
            ? {
                action: {
                  label: restriction.cta,
                  onClick: () => navigate("/app/billing"),
                },
              }
            : {}),
        });
        return;
      }

      toast.error(
        e instanceof Error
          ? e.message
          : "Could not update your challenge. Please try again."
      );
    } finally {
      setJoiningId(null);
    }
  }, [joiningId, navigate]);

  const filteredChallenges = useMemo(() => {
    return challenges.filter((challenge) => {
      if (activeTab === "active") return challenge.isJoined && !challenge.isCompleted && !challenge.isLocked;
      if (activeTab === "completed") return challenge.isCompleted;
      return true;
    });
  }, [activeTab, challenges]);

  const stats = [
    { label: "In Progress", value: challenges.filter((c) => c.isJoined && !c.isCompleted && !c.isLocked).length, icon: Target },
    { label: "Completed", value: challenges.filter((c) => c.isCompleted).length, icon: CheckCircle2 },
    { label: "Total Points", value: summary.totalPoints, icon: Star },
    { label: "Current Level", value: summary.currentLevel, icon: Award },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Wellness Challenges</h1>
          </div>
          <p className="text-muted-foreground">
            Complete challenges to earn points, level up, and build healthy habits
          </p>
          {error && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">{error}</p>
          )}
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="p-4 mb-6 border-primary/20 bg-primary/5">
            <h2 className="text-sm font-semibold mb-1">How challenge completion works</h2>
            <p className="text-sm text-muted-foreground">
              Join a challenge, then complete the required wellness activities. Your progress updates automatically.
              When your progress reaches the target, the challenge moves to Completed and points are added.
            </p>
          </Card>
        </motion.div>

        {/* Level Progress Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 shadow-xl bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-6 h-6 text-primary" />
                  <h2 className="text-xl font-bold">Your Progress</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Keep going! You're doing great
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-1">
                  Level {summary.currentLevel}
                </div>
                <div className="text-sm text-muted-foreground">{summary.totalPoints} points</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Next Level</span>
                <span className="text-sm text-muted-foreground">
                  {summary.pointsToNextLevel} points needed
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, Math.max(0, summary.levelProgressPercent))}%`,
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
              >
                <Card className="p-4 text-center shadow-lg hover:shadow-xl transition-all">
                  <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="flex gap-2 border-b border-gray-200">
            {(["all", "active", "completed"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition-colors relative capitalize ${
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-gray-900"
                }`}
              >
                {tab === "all" ? "All Challenges" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Challenges Grid */}
        <div className="space-y-4">
          {loading && (
            <Card className="p-5 text-sm text-muted-foreground">
              Loading your challenges…
            </Card>
          )}
          {filteredChallenges.map((challenge, index) => {
            const Icon = challenge.icon;
            const progressPercentage = Math.min(100, (challenge.progress / challenge.target) * 100);
            const badge = formatCategoryBadge(challenge.categoryLabel);
            const timeLeft = formatEndDate(challenge.endDate);
            const isJoiningThis = joiningId === challenge.id;
            const userStatus = getUserChallengeStatus(challenge);

            return (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <Card
                  className={`p-5 transition-all ${
                    challenge.isLocked
                      ? "opacity-50"
                      : challenge.isCompleted
                      ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                      : "hover:shadow-lg"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
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

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-bold text-lg">{challenge.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${userStatus.className}`}>
                              {userStatus.label}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {challenge.description}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {timeLeft && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>{timeLeft}</span>
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground">{userStatus.helperText}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
                            {challenge.difficulty}
                          </div>
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-4 h-4 fill-amber-500" />
                            <span className="text-sm font-bold">+{challenge.reward}</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {!challenge.isLocked && (
                        <>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
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
                                className="text-xs font-bold text-green-600 flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Completed
                              </motion.span>
                            ) : (
                              <span className="text-xs font-medium text-primary">
                                {Math.round(progressPercentage)}%
                              </span>
                            )}
                          </div>
                          {!challenge.isCompleted && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Complete {Math.max(challenge.target - challenge.progress, 0)} more to finish this challenge.
                            </p>
                          )}
                        </>
                      )}

                      {challenge.isLocked && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                          <Lock className="w-3 h-3" />
                          Complete previous challenges to unlock
                        </div>
                      )}

                      {/* Join / Leave button */}
                      {!challenge.isLocked && !challenge.isCompleted && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant={challenge.isJoined ? "outline" : "default"}
                            className="gap-1.5"
                            disabled={isJoiningThis}
                            onClick={() => handleJoinToggle(challenge)}
                          >
                            {isJoiningThis ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : challenge.isJoined ? (
                              <UserMinus className="w-3.5 h-3.5" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                            {isJoiningThis
                              ? "Loading…"
                              : challenge.isJoined
                              ? "Leave This Challenge"
                              : "Join and Start"}
                          </Button>
                          {challenge.isJoined && (
                            <Button asChild size="sm" className="gap-1.5">
                              <Link to="/app/wellness-tools" aria-label="Open Wellness Tools to continue challenge progress">
                                Open Wellness Tools
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {!loading && filteredChallenges.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No challenges found</h3>
            <p className="text-gray-600">
              {activeTab === "completed"
                ? "You haven't completed any challenges yet. Keep working on your active challenges!"
                : activeTab === "active"
                ? "You're not currently enrolled in any active challenges. Join one from All Challenges."
                : "All challenges completed! Check back soon for new challenges."}
            </p>
          </motion.div>
        )}
      </div>
  );
}

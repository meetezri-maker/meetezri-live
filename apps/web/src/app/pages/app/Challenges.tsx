import { AppLayout } from "@/app/components/AppLayout";
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
  TrendingUp,
  Calendar,
  Users,
  Clock,
  Gift,
  ChevronRight
} from "lucide-react";
import { useState } from "react";

interface Challenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  difficulty: "Easy" | "Medium" | "Hard";
  icon: typeof Trophy;
  color: string;
  isCompleted: boolean;
  isLocked: boolean;
  category: "Daily" | "Weekly" | "Monthly" | "Special";
  expiresIn?: string;
}

export function Challenges() {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");
  const [challenges] = useState<Challenge[]>([
    {
      id: "daily-checkin",
      title: "Daily Check-In Streak",
      description: "Check in for 7 days in a row",
      progress: 5,
      target: 7,
      reward: 100,
      difficulty: "Easy",
      icon: Flame,
      color: "from-orange-400 to-red-500",
      isCompleted: false,
      isLocked: false,
      category: "Daily",
      expiresIn: "2 days"
    },
    {
      id: "meditation-master",
      title: "Meditation Master",
      description: "Complete 10 meditation sessions",
      progress: 6,
      target: 10,
      reward: 200,
      difficulty: "Medium",
      icon: Star,
      color: "from-purple-400 to-pink-500",
      isCompleted: false,
      isLocked: false,
      category: "Weekly"
    },
    {
      id: "breath-work",
      title: "Breath Work Pro",
      description: "Complete 5 breathing exercises",
      progress: 5,
      target: 5,
      reward: 150,
      difficulty: "Easy",
      icon: Zap,
      color: "from-blue-400 to-cyan-500",
      isCompleted: true,
      isLocked: false,
      category: "Weekly"
    },
    {
      id: "journal-writer",
      title: "Journal Writer",
      description: "Write 15 journal entries",
      progress: 12,
      target: 15,
      reward: 250,
      difficulty: "Medium",
      icon: Heart,
      color: "from-pink-400 to-rose-500",
      isCompleted: false,
      isLocked: false,
      category: "Monthly"
    },
    {
      id: "wellness-warrior",
      title: "Wellness Warrior",
      description: "Complete 30 wellness activities",
      progress: 8,
      target: 30,
      reward: 500,
      difficulty: "Hard",
      icon: Trophy,
      color: "from-amber-400 to-yellow-500",
      isCompleted: false,
      isLocked: false,
      category: "Monthly"
    },
    {
      id: "perfect-week",
      title: "Perfect Week",
      description: "Complete all daily goals for 7 days",
      progress: 0,
      target: 7,
      reward: 1000,
      difficulty: "Hard",
      icon: Target,
      color: "from-green-400 to-emerald-500",
      isCompleted: false,
      isLocked: true,
      category: "Special"
    },
    {
      id: "mood-tracker",
      title: "Mood Tracker",
      description: "Log your mood for 14 consecutive days",
      progress: 9,
      target: 14,
      reward: 300,
      difficulty: "Medium",
      icon: Heart,
      color: "from-red-400 to-pink-500",
      isCompleted: false,
      isLocked: false,
      category: "Weekly"
    },
    {
      id: "sleep-champion",
      title: "Sleep Champion",
      description: "Track sleep for 10 nights in a row",
      progress: 7,
      target: 10,
      reward: 200,
      difficulty: "Easy",
      icon: Star,
      color: "from-indigo-400 to-blue-500",
      isCompleted: false,
      isLocked: false,
      category: "Weekly"
    },
    {
      id: "gratitude-guru",
      title: "Gratitude Guru",
      description: "Complete 20 gratitude exercises",
      progress: 15,
      target: 20,
      reward: 350,
      difficulty: "Medium",
      icon: Gift,
      color: "from-yellow-400 to-orange-500",
      isCompleted: false,
      isLocked: false,
      category: "Monthly"
    },
    {
      id: "early-bird",
      title: "Early Bird",
      description: "Complete morning meditation 5 times",
      progress: 5,
      target: 5,
      reward: 150,
      difficulty: "Easy",
      icon: Zap,
      color: "from-cyan-400 to-blue-500",
      isCompleted: true,
      isLocked: false,
      category: "Daily",
      expiresIn: "5 days"
    }
  ]);

  const totalPoints = 750;
  const currentLevel = 5;
  const pointsToNextLevel = 250;

  const filteredChallenges = challenges.filter(challenge => {
    if (activeTab === "active") return !challenge.isCompleted && !challenge.isLocked;
    if (activeTab === "completed") return challenge.isCompleted;
    return true;
  });

  const stats = [
    { label: "Active Challenges", value: challenges.filter(c => !c.isCompleted && !c.isLocked).length, icon: Target },
    { label: "Completed", value: challenges.filter(c => c.isCompleted).length, icon: CheckCircle2 },
    { label: "Total Points", value: totalPoints, icon: Star },
    { label: "Current Level", value: currentLevel, icon: Award }
  ];

  return (
    <AppLayout>
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
                  Level {currentLevel}
                </div>
                <div className="text-sm text-muted-foreground">{totalPoints} points</div>
              </div>
            </div>

            {/* Level Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Next Level</span>
                <span className="text-sm text-muted-foreground">
                  {pointsToNextLevel} points needed
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((totalPoints % 1000) / 1000) * 100}%` }}
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
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === "all"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-gray-900"
              }`}
            >
              All Challenges
              {activeTab === "all" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === "active"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-gray-900"
              }`}
            >
              Active
              {activeTab === "active" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === "completed"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-gray-900"
              }`}
            >
              Completed
              {activeTab === "completed" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          </div>
        </motion.div>

        {/* Challenges Grid */}
        <div className="space-y-4">
          {filteredChallenges.map((challenge, index) => {
            const Icon = challenge.icon;
            const progressPercentage = (challenge.progress / challenge.target) * 100;

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
                      ? "opacity-50 cursor-not-allowed"
                      : challenge.isCompleted
                      ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
                      : "hover:shadow-lg cursor-pointer"
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
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{challenge.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              challenge.category === "Daily" ? "bg-blue-100 text-blue-700" :
                              challenge.category === "Weekly" ? "bg-purple-100 text-purple-700" :
                              challenge.category === "Monthly" ? "bg-orange-100 text-orange-700" :
                              "bg-pink-100 text-pink-700"
                            }`}>
                              {challenge.category}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {challenge.description}
                          </p>
                          {challenge.expiresIn && !challenge.isCompleted && (
                            <div className="flex items-center gap-1 text-xs text-orange-600">
                              <Clock className="w-3 h-3" />
                              <span>Expires in {challenge.expiresIn}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
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
                        </>
                      )}

                      {challenge.isLocked && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                          <Lock className="w-3 h-3" />
                          Complete previous challenges to unlock
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {filteredChallenges.length === 0 && (
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
                : "All challenges completed! Check back soon for new challenges."}
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

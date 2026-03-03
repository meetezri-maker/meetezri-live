import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { motion } from "motion/react";
import {
  Trophy,
  Target,
  Flame,
  Star,
  Zap,
  Heart,
  CheckCircle2,
  Lock
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

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
}

export function WellnessChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([
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
      isLocked: false
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
      isLocked: false
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
      isLocked: false
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
      isLocked: false
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
      isLocked: false
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
      isLocked: true
    }
  ]);

  const totalPoints = 750;
  const currentLevel = 5;
  const pointsToNextLevel = 250;

  const navigate = useNavigate();

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
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${((totalPoints % 1000) / 1000) * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
          />
        </div>
      </div>

      {/* Challenges Grid */}
      <div className="space-y-4">
        {challenges.map((challenge, index) => {
          const Icon = challenge.icon;
          const progressPercentage = (challenge.progress / challenge.target) * 100;

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
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-bold">{challenge.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {challenge.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="px-2 py-1 bg-gray-100 rounded-full text-xs font-medium">
                          {challenge.difficulty}
                        </div>
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-amber-500" />
                          <span className="text-xs font-bold">+{challenge.reward}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {!challenge.isLocked && (
                      <>
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
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
                              className="text-xs font-bold text-green-600"
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

      {/* Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-6"
      >
        <Button className="w-full" variant="outline" onClick={() => navigate("/app/challenges")}>
          View All Challenges
        </Button>
      </motion.div>
    </Card>
  );
}
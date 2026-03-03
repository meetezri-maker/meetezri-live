import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import {
  Award,
  Trophy,
  Target,
  Star,
  Zap,
  Crown,
  Plus,
  CheckCircle,
  Users,
  TrendingUp,
  Unlock,
  Lock,
  Edit,
  Eye,
  X,
  Save,
  BarChart3,
  Calendar
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

interface Badge {
  id: string;
  name: string;
  description: string;
  category: "achievement" | "milestone" | "special" | "streak" | "challenge";
  icon: string;
  color: string;
  requirement: string;
  totalEarned: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  points: number;
  isActive: boolean;
  createdAt: Date;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: "sessions" | "mood" | "journal" | "social" | "wellness";
  level: number;
  maxLevel: number;
  progress: number;
  requirement: number;
  reward: {
    points: number;
    badge?: string;
  };
  unlocked: number;
  totalUsers: number;
}

export function BadgeManager() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [activeTab, setActiveTab] = useState<"badges" | "achievements">("badges");
  
  // Modal states
  const [editBadgeModal, setEditBadgeModal] = useState<Badge | null>(null);
  const [viewStatsModal, setViewStatsModal] = useState<Badge | null>(null);

  // Mock badges
  const badges: Badge[] = [
    {
      id: "badge001",
      name: "First Steps",
      description: "Complete your first therapy session",
      category: "milestone",
      icon: "🎯",
      color: "from-blue-500 to-indigo-600",
      requirement: "Complete 1 session",
      totalEarned: 1205,
      rarity: "common",
      points: 50,
      isActive: true,
      createdAt: new Date("2024-01-15")
    },
    {
      id: "badge002",
      name: "Week Warrior",
      description: "Complete 7 consecutive days of mood tracking",
      category: "streak",
      icon: "🔥",
      color: "from-orange-500 to-red-600",
      requirement: "7-day mood tracking streak",
      totalEarned: 892,
      rarity: "rare",
      points: 100,
      isActive: true,
      createdAt: new Date("2024-02-01")
    },
    {
      id: "badge003",
      name: "Journaling Master",
      description: "Write 50 journal entries",
      category: "achievement",
      icon: "📖",
      color: "from-purple-500 to-pink-600",
      requirement: "Write 50 journal entries",
      totalEarned: 456,
      rarity: "epic",
      points: 250,
      isActive: true,
      createdAt: new Date("2024-03-10")
    },
    {
      id: "badge004",
      name: "Mindful Legend",
      description: "Complete 100 meditation sessions",
      category: "achievement",
      icon: "🧘",
      color: "from-green-500 to-emerald-600",
      requirement: "Complete 100 meditation sessions",
      totalEarned: 234,
      rarity: "legendary",
      points: 500,
      isActive: true,
      createdAt: new Date("2024-04-05")
    },
    {
      id: "badge005",
      name: "Community Champion",
      description: "Help 10 other users in forums",
      category: "special",
      icon: "💬",
      color: "from-yellow-500 to-orange-500",
      requirement: "Help 10 users in community",
      totalEarned: 178,
      rarity: "rare",
      points: 200,
      isActive: true,
      createdAt: new Date("2024-05-20")
    },
    {
      id: "badge006",
      name: "Challenge Champion",
      description: "Complete all wellness challenges",
      category: "challenge",
      icon: "🏆",
      color: "from-yellow-400 to-yellow-600",
      requirement: "Complete all 6 wellness challenges",
      totalEarned: 89,
      rarity: "legendary",
      points: 1000,
      isActive: true,
      createdAt: new Date("2024-06-01")
    },
    {
      id: "badge007",
      name: "Beta Tester",
      description: "Early adopter special badge",
      category: "special",
      icon: "✨",
      color: "from-purple-400 to-purple-600",
      requirement: "Join during beta period",
      totalEarned: 342,
      rarity: "epic",
      points: 300,
      isActive: false,
      createdAt: new Date("2024-01-01")
    }
  ];

  // Mock achievements
  const achievements: Achievement[] = [
    {
      id: "ach001",
      name: "Session Streaker",
      description: "Complete therapy sessions consistently",
      category: "sessions",
      level: 3,
      maxLevel: 5,
      progress: 15,
      requirement: 25,
      reward: {
        points: 150,
        badge: "Session Master"
      },
      unlocked: 456,
      totalUsers: 1205
    },
    {
      id: "ach002",
      name: "Mood Tracker Pro",
      description: "Track your mood daily",
      category: "mood",
      level: 4,
      maxLevel: 5,
      progress: 28,
      requirement: 30,
      reward: {
        points: 200
      },
      unlocked: 678,
      totalUsers: 1205
    },
    {
      id: "ach003",
      name: "Journal Journey",
      description: "Write meaningful journal entries",
      category: "journal",
      level: 2,
      maxLevel: 5,
      progress: 8,
      requirement: 15,
      reward: {
        points: 100,
        badge: "Reflective Writer"
      },
      unlocked: 234,
      totalUsers: 1205
    },
    {
      id: "ach004",
      name: "Social Butterfly",
      description: "Engage with the community",
      category: "social",
      level: 1,
      maxLevel: 3,
      progress: 3,
      requirement: 10,
      reward: {
        points: 75
      },
      unlocked: 189,
      totalUsers: 1205
    },
    {
      id: "ach005",
      name: "Wellness Warrior",
      description: "Complete wellness activities",
      category: "wellness",
      level: 3,
      maxLevel: 5,
      progress: 18,
      requirement: 20,
      reward: {
        points: 175,
        badge: "Wellness Champion"
      },
      unlocked: 523,
      totalUsers: 1205
    }
  ];

  const getRarityColor = (rarity: string) => {
    switch(rarity) {
      case "common": return "bg-gray-100 text-gray-700";
      case "rare": return "bg-blue-100 text-blue-700";
      case "epic": return "bg-purple-100 text-purple-700";
      case "legendary": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case "achievement": return Trophy;
      case "milestone": return Target;
      case "special": return Star;
      case "streak": return Zap;
      case "challenge": return Crown;
      default: return Award;
    }
  };

  const stats = {
    totalBadges: badges.length,
    activeBadges: badges.filter(b => b.isActive).length,
    totalEarned: badges.reduce((sum, b) => sum + b.totalEarned, 0),
    avgCompletion: 68
  };

  return (
    <AdminLayoutNew>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Badge & Achievement Manager</h1>
            <p className="text-gray-600 mt-1">Create and manage user rewards</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Create {activeTab === "badges" ? "Badge" : "Achievement"}
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Badges</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBadges}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-green-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeBadges}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Earned</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEarned.toLocaleString()}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Avg Completion</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgCompletion}%</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-2 shadow-lg border border-gray-100 flex gap-2"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("badges")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === "badges"
                ? "bg-blue-500 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Award className="w-4 h-4 inline mr-2" />
            Badges ({badges.length})
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab("achievements")}
            className={`flex-1 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === "achievements"
                ? "bg-blue-500 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Trophy className="w-4 h-4 inline mr-2" />
            Achievements ({achievements.length})
          </motion.button>
        </motion.div>

        {/* Badges Tab */}
        {activeTab === "badges" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">All Badges</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {badges.map((badge, index) => {
                const CategoryIcon = getCategoryIcon(badge.category);
                
                return (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 + index * 0.05 }}
                    onClick={() => setSelectedBadge(selectedBadge?.id === badge.id ? null : badge)}
                    className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
                      selectedBadge?.id === badge.id
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`text-4xl p-2 rounded-xl bg-gradient-to-br ${badge.color}`}>
                        {badge.icon}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900">{badge.name}</h3>
                          {badge.isActive ? (
                            <Unlock className="w-4 h-4 text-green-600" />
                          ) : (
                            <Lock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium uppercase ${getRarityColor(badge.rarity)}`}>
                            {badge.rarity}
                          </span>
                          <CategoryIcon className="w-3 h-3 text-gray-500" />
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">{badge.description}</p>

                    <div className="bg-gray-50 rounded-lg p-2 mb-3">
                      <p className="text-xs text-gray-600 mb-1">Requirement:</p>
                      <p className="text-sm font-medium text-gray-900">{badge.requirement}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-blue-50 rounded-lg p-2">
                        <p className="text-xs text-blue-600">Points</p>
                        <p className="font-bold text-blue-700">{badge.points}</p>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-2">
                        <p className="text-xs text-purple-600">Earned</p>
                        <p className="font-bold text-purple-700">{badge.totalEarned}</p>
                      </div>
                    </div>

                    {selectedBadge?.id === badge.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-3 pt-3 border-t border-gray-200"
                      >
                        <p className="text-xs text-gray-600 mb-2">
                          Created: {badge.createdAt.toLocaleDateString()}
                        </p>
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setEditBadgeModal(badge)}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium"
                          >
                            <Edit className="w-3 h-3 inline mr-1" />
                            Edit
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setViewStatsModal(badge)}
                            className="flex-1 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium"
                          >
                            <Eye className="w-3 h-3 inline mr-1" />
                            Stats
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Achievements Tab */}
        {activeTab === "achievements" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">All Achievements</h2>

            <div className="space-y-4">
              {achievements.map((achievement, index) => {
                const progressPercent = (achievement.progress / achievement.requirement) * 100;
                
                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.05 }}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                        <Trophy className="w-6 h-6 text-white" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-gray-900 text-lg">{achievement.name}</h3>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                            Level {achievement.level}/{achievement.maxLevel}
                          </span>
                        </div>

                        <p className="text-gray-600 mb-3">{achievement.description}</p>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium text-gray-900">
                              {achievement.progress}/{achievement.requirement}
                            </span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercent}%` }}
                              transition={{ duration: 1, delay: 0.7 + index * 0.05 }}
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                            />
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">Points</p>
                            <p className="font-bold text-gray-900">{achievement.reward.points}</p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">Unlocked</p>
                            <p className="font-bold text-gray-900">{achievement.unlocked}</p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">Completion</p>
                            <p className="font-bold text-gray-900">
                              {Math.round((achievement.unlocked / achievement.totalUsers) * 100)}%
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-xs text-gray-600">Category</p>
                            <p className="font-bold text-gray-900 capitalize">{achievement.category}</p>
                          </div>
                        </div>

                        {achievement.reward.badge && (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-xs text-yellow-700">
                              <Star className="w-3 h-3 inline mr-1" />
                              Reward: <span className="font-medium">{achievement.reward.badge}</span> badge
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Create {activeTab === "badges" ? "Badge" : "Achievement"}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    placeholder={activeTab === "badges" ? "e.g., Master Meditator" : "e.g., Session Champion"}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    placeholder="Describe the badge or achievement..."
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                      {activeTab === "badges" ? (
                        <>
                          <option>Achievement</option>
                          <option>Milestone</option>
                          <option>Special</option>
                          <option>Streak</option>
                          <option>Challenge</option>
                        </>
                      ) : (
                        <>
                          <option>Sessions</option>
                          <option>Mood</option>
                          <option>Journal</option>
                          <option>Social</option>
                          <option>Wellness</option>
                        </>
                      )}
                    </select>
                  </div>

                  {activeTab === "badges" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rarity</label>
                      <select className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none">
                        <option>Common</option>
                        <option>Rare</option>
                        <option>Epic</option>
                        <option>Legendary</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Points Reward</label>
                    <input
                      type="number"
                      placeholder="100"
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {activeTab === "badges" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Icon Emoji</label>
                      <input
                        type="text"
                        placeholder="🏆"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Requirement</label>
                  <input
                    type="text"
                    placeholder="e.g., Complete 10 sessions"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                >
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                >
                  Create
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Badge Modal */}
        <AnimatePresence>
          {editBadgeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setEditBadgeModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Edit Badge</h3>
                  <Button variant="ghost" size="sm" onClick={() => setEditBadgeModal(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <Input defaultValue={editBadgeModal.name} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      defaultValue={editBadgeModal.description}
                      rows={3}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select 
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        defaultValue={editBadgeModal.category}
                      >
                        <option value="achievement">Achievement</option>
                        <option value="milestone">Milestone</option>
                        <option value="special">Special</option>
                        <option value="streak">Streak</option>
                        <option value="challenge">Challenge</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rarity</label>
                      <select 
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                        defaultValue={editBadgeModal.rarity}
                      >
                        <option value="common">Common</option>
                        <option value="rare">Rare</option>
                        <option value="epic">Epic</option>
                        <option value="legendary">Legendary</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                      <Input type="number" defaultValue={editBadgeModal.points} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Icon Emoji</label>
                      <Input defaultValue={editBadgeModal.icon} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Requirement</label>
                    <Input defaultValue={editBadgeModal.requirement} />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      defaultChecked={editBadgeModal.isActive}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                      Active (users can earn this badge)
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditBadgeModal(null)}
                    className="flex-1 px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      alert(`Saved changes to: ${editBadgeModal.name}`);
                      setEditBadgeModal(null);
                    }}
                    className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium"
                  >
                    <Save className="w-4 h-4 inline mr-2" />
                    Save Changes
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Stats Modal */}
        <AnimatePresence>
          {viewStatsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setViewStatsModal(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">Badge Statistics</h3>
                  <Button variant="ghost" size="sm" onClick={() => setViewStatsModal(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Badge Header */}
                  <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
                    <div className={`text-6xl p-3 rounded-xl bg-gradient-to-br ${viewStatsModal.color}`}>
                      {viewStatsModal.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-2xl font-bold text-gray-900 mb-2">{viewStatsModal.name}</h4>
                      <p className="text-gray-600 mb-2">{viewStatsModal.description}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium uppercase ${getRarityColor(viewStatsModal.rarity)}`}>
                          {viewStatsModal.rarity}
                        </span>
                        <span className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                          {viewStatsModal.category}
                        </span>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${viewStatsModal.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {viewStatsModal.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <Award className="w-6 h-6 text-blue-600 mb-2" />
                      <p className="text-3xl font-bold text-blue-600">{viewStatsModal.totalEarned}</p>
                      <p className="text-sm text-gray-600">Times Earned</p>
                    </div>

                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <Star className="w-6 h-6 text-yellow-600 mb-2" />
                      <p className="text-3xl font-bold text-yellow-600">{viewStatsModal.points}</p>
                      <p className="text-sm text-gray-600">Points Reward</p>
                    </div>

                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <TrendingUp className="w-6 h-6 text-purple-600 mb-2" />
                      <p className="text-3xl font-bold text-purple-600">
                        {((viewStatsModal.totalEarned / 1205) * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-600">Earn Rate</p>
                    </div>
                  </div>

                  {/* Requirements */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Target className="w-5 h-5 text-gray-600" />
                      Requirement
                    </h5>
                    <p className="text-gray-700">{viewStatsModal.requirement}</p>
                  </div>

                  {/* Creation Date */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-gray-600" />
                      Creation Date
                    </h5>
                    <p className="text-gray-700">{viewStatsModal.createdAt.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</p>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => setViewStatsModal(null)}>
                    Close
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}
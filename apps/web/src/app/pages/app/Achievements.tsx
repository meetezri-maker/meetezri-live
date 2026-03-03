import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppLayout } from '@/app/components/AppLayout';
import { Trophy, Award, Star, Lock, Calendar, TrendingUp, Target, Zap, Heart, Brain, Moon, CheckCircle, ArrowLeft } from 'lucide-react';
import { AnimatedCard } from '@/app/components/AnimatedCard';
import { Link } from 'react-router-dom';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'sessions' | 'mood' | 'journal' | 'wellness' | 'streak';
  progress: number;
  total: number;
  unlocked: boolean;
  unlockedDate?: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export function Achievements() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const achievements: Achievement[] = [
    {
      id: '1',
      title: 'First Steps',
      description: 'Complete your first session with Ezri',
      icon: 'footprints',
      category: 'sessions',
      progress: 1,
      total: 1,
      unlocked: true,
      unlockedDate: '2026-01-15',
      points: 10,
      rarity: 'common'
    },
    {
      id: '2',
      title: 'Consistent Journey',
      description: 'Complete 10 sessions with Ezri',
      icon: 'target',
      category: 'sessions',
      progress: 7,
      total: 10,
      unlocked: false,
      points: 50,
      rarity: 'rare'
    },
    {
      id: '3',
      title: 'Mood Master',
      description: 'Log your mood for 7 consecutive days',
      icon: 'heart',
      category: 'mood',
      progress: 7,
      total: 7,
      unlocked: true,
      unlockedDate: '2026-01-20',
      points: 25,
      rarity: 'rare'
    },
    {
      id: '4',
      title: 'Journaling Pro',
      description: 'Write 20 journal entries',
      icon: 'book',
      category: 'journal',
      progress: 12,
      total: 20,
      unlocked: false,
      points: 40,
      rarity: 'rare'
    },
    {
      id: '5',
      title: 'Wellness Warrior',
      description: 'Complete 5 wellness exercises',
      icon: 'zap',
      category: 'wellness',
      progress: 5,
      total: 5,
      unlocked: true,
      unlockedDate: '2026-01-18',
      points: 30,
      rarity: 'common'
    },
    {
      id: '6',
      title: 'Night Owl',
      description: 'Track your sleep for 14 nights',
      icon: 'moon',
      category: 'wellness',
      progress: 8,
      total: 14,
      unlocked: false,
      points: 35,
      rarity: 'rare'
    },
    {
      id: '7',
      title: 'Legendary Dedication',
      description: 'Maintain a 30-day streak',
      icon: 'trophy',
      category: 'streak',
      progress: 15,
      total: 30,
      unlocked: false,
      points: 100,
      rarity: 'legendary'
    },
    {
      id: '8',
      title: 'Early Bird',
      description: 'Complete a morning session',
      icon: 'sunrise',
      category: 'sessions',
      progress: 1,
      total: 1,
      unlocked: true,
      unlockedDate: '2026-01-22',
      points: 15,
      rarity: 'common'
    }
  ];

  const stats = {
    totalPoints: achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0),
    unlockedCount: achievements.filter(a => a.unlocked).length,
    totalCount: achievements.length,
    currentStreak: 15,
    longestStreak: 22
  };

  const categories = [
    { id: 'all', label: 'All', icon: Trophy },
    { id: 'sessions', label: 'Sessions', icon: Target },
    { id: 'mood', label: 'Mood', icon: Heart },
    { id: 'journal', label: 'Journal', icon: Brain },
    { id: 'wellness', label: 'Wellness', icon: Zap },
    { id: 'streak', label: 'Streaks', icon: TrendingUp }
  ];

  const filteredAchievements = selectedCategory === 'all' 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600',
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-yellow-500 to-orange-500'
  };

  const rarityBorders = {
    common: 'border-gray-500/30',
    rare: 'border-blue-500/30',
    epic: 'border-purple-500/30',
    legendary: 'border-yellow-500/30'
  };

  const getIcon = (iconName: string) => {
    const icons: any = {
      footprints: Target,
      target: Target,
      heart: Heart,
      book: Brain,
      zap: Zap,
      moon: Moon,
      trophy: Trophy,
      sunrise: Calendar
    };
    return icons[iconName] || Trophy;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Settings
            </Link>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Achievements</h1>
                <p className="text-gray-600 dark:text-slate-400">Your journey and milestones</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <AnimatedCard delay={0.1}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Award className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unlockedCount}/{stats.totalCount}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Unlocked</p>
                </div>
                <div className="mt-3 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full"
                    style={{ width: `${(stats.unlockedCount / stats.totalCount) * 100}%` }}
                  />
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.2}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Star className="w-8 h-8 text-purple-600 dark:text-purple-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPoints}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Total Points</p>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.3}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.currentStreak}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Current Streak</p>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.4}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Trophy className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{stats.longestStreak}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">Longest Streak</p>
                </div>
              </div>
            </AnimatedCard>
          </div>

          {/* Category Filters */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;
                return (
                  <motion.button
                    key={category.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-purple-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {category.label}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAchievements.map((achievement, index) => {
              const Icon = getIcon(achievement.icon);
              const isUnlocked = achievement.unlocked;
              
              return (
                <AnimatedCard key={achievement.id} delay={index * 0.05}>
                  <div
                    className={`relative bg-white dark:bg-slate-900 rounded-2xl border-2 h-full flex flex-col ${
                      isUnlocked ? rarityBorders[achievement.rarity] : 'border-gray-200 dark:border-slate-800'
                    } p-6 overflow-hidden hover:shadow-lg transition-all ${!isUnlocked && 'opacity-60'}`}
                  >
                    {/* Rarity Gradient Overlay */}
                    {isUnlocked && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${rarityColors[achievement.rarity]} opacity-5`} />
                    )}

                    {/* Content */}
                    <div className="relative flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                          isUnlocked 
                            ? `bg-gradient-to-br ${rarityColors[achievement.rarity]}` 
                            : 'bg-gray-100 dark:bg-slate-800'
                        }`}>
                          {isUnlocked ? (
                            <Icon className="w-8 h-8 text-white" />
                          ) : (
                            <Lock className="w-8 h-8 text-gray-400 dark:text-slate-600" />
                          )}
                        </div>
                        {isUnlocked && (
                          <div className="flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-lg">
                            <Star className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
                            <span className="text-sm font-bold text-yellow-700 dark:text-yellow-500">{achievement.points}</span>
                          </div>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{achievement.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">{achievement.description}</p>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400 mb-1">
                          <span>Progress</span>
                          <span>{achievement.progress}/{achievement.total}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(achievement.progress / achievement.total) * 100}%` }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className={`h-full ${
                              isUnlocked 
                                ? `bg-gradient-to-r ${rarityColors[achievement.rarity]}` 
                                : 'bg-gradient-to-r from-gray-300 to-gray-400 dark:from-slate-600 dark:to-slate-500'
                            } rounded-full`}
                          />
                        </div>
                      </div>

                      {/* Unlocked Date */}
                      {isUnlocked && achievement.unlockedDate && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-400">
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" />
                          <span>Unlocked on {new Date(achievement.unlockedDate).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Rarity Badge */}
                      <div className="absolute top-4 right-4">
                        <span className={`text-xs font-bold uppercase px-2 py-1 rounded-lg ${
                          isUnlocked
                            ? `bg-gradient-to-r ${rarityColors[achievement.rarity]} text-white`
                            : 'bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
                        }`}>
                          {achievement.rarity}
                        </span>
                      </div>
                    </div>
                  </div>
                </AnimatedCard>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredAchievements.length === 0 && (
            <div className="text-center py-16">
              <Trophy className="w-16 h-16 text-gray-400 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No achievements in this category yet</h3>
              <p className="text-gray-600 dark:text-slate-400">Keep going! Your achievements are waiting to be unlocked.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
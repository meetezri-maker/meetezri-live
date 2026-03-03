import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppLayout } from '@/app/components/AppLayout';
import { Brain, CheckCircle, Star, Users, Volume2, Heart, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { AnimatedCard } from '@/app/components/AnimatedCard';
import { Link } from 'react-router-dom';

interface AIAvatar {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  personality: string;
  specialty: string[];
  description: string;
  image: string;
  voiceType: string;
  accentType: string;
  rating: number;
  totalUsers: number;
}

export function ChangeAvatar() {
  const [currentAvatarId, setCurrentAvatarId] = useState("maya");
  const [selectedAvatarId, setSelectedAvatarId] = useState("maya");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [switchHistory, setSwitchHistory] = useState([
    { date: "2026-01-15", from: "Alex Rivera", to: "Maya Chen" },
    { date: "2025-12-20", from: "Jordan Taylor", to: "Alex Rivera" }
  ]);

  const aiAvatars: AIAvatar[] = [
    {
      id: "maya",
      name: "Maya Chen",
      gender: "Female",
      ageRange: "35-40",
      personality: "Warm, Empathetic, Supportive",
      specialty: ["Anxiety", "Depression", "Stress Management"],
      description: "A compassionate AI companion with a warm presence. Maya specializes in helping with anxiety, stress, and building emotional resilience through mindfulness.",
      image: "👩‍💼",
      voiceType: "Warm & Soothing",
      accentType: "Neutral American",
      rating: 4.9,
      totalUsers: 2456
    },
    {
      id: "alex",
      name: "Alex Rivera",
      gender: "Male",
      ageRange: "30-35",
      personality: "Calm, Patient, Understanding",
      specialty: ["PTSD", "Trauma", "Life Transitions"],
      description: "A gentle and patient listener who creates a safe space for healing. Alex focuses on trauma recovery and navigating life's big changes.",
      image: "👨‍💼",
      voiceType: "Deep & Calming",
      accentType: "Neutral American",
      rating: 4.8,
      totalUsers: 1893
    },
    {
      id: "jordan",
      name: "Jordan Taylor",
      gender: "Non-binary",
      ageRange: "28-32",
      personality: "Energetic, Positive, Supportive",
      specialty: ["Self-Esteem", "Relationships", "Personal Growth"],
      description: "An uplifting companion who helps you discover your strengths. Jordan specializes in building confidence and personal development.",
      image: "🧑‍💼",
      voiceType: "Bright & Encouraging",
      accentType: "Neutral American",
      rating: 4.7,
      totalUsers: 1654
    },
    {
      id: "sarah",
      name: "Sarah Mitchell",
      gender: "Female",
      ageRange: "45-50",
      personality: "Wise, Grounded, Nurturing",
      specialty: ["Grief", "Family Issues", "Chronic Illness"],
      description: "A wise and nurturing presence with deep empathy. Sarah brings years of life experience in supporting people through challenging times.",
      image: "👩‍🦳",
      voiceType: "Gentle & Maternal",
      accentType: "British",
      rating: 4.9,
      totalUsers: 2103
    }
  ];

  const currentAvatar = aiAvatars.find(a => a.id === currentAvatarId);
  const selectedAvatar = aiAvatars.find(a => a.id === selectedAvatarId);

  const handleConfirmChange = () => {
    setCurrentAvatarId(selectedAvatarId);
    setSwitchHistory([
      {
        date: new Date().toISOString().split('T')[0],
        from: currentAvatar?.name || '',
        to: selectedAvatar?.name || ''
      },
      ...switchHistory
    ]);
    setShowConfirmModal(false);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Change AI Companion</h1>
                <p className="text-gray-600 dark:text-slate-400">Switch to a different AI companion for your sessions</p>
              </div>
            </div>
          </div>

          {/* Current Avatar */}
          {currentAvatar && (
            <AnimatedCard delay={0.1}>
              <div className="bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-2xl border-2 border-purple-300 dark:border-purple-700 p-6 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Current AI Companion</h2>
                </div>

                <div className="flex items-start gap-6">
                  <div className="text-7xl">{currentAvatar.image}</div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{currentAvatar.name}</h3>
                    <p className="text-gray-700 dark:text-slate-300 mb-3">
                      {currentAvatar.gender} • {currentAvatar.ageRange} years
                    </p>
                    <p className="text-gray-700 dark:text-slate-300 mb-4 leading-relaxed">{currentAvatar.description}</p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {currentAvatar.specialty.map((spec) => (
                        <span
                          key={spec}
                          className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm rounded-full font-medium"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-6 text-sm text-gray-700 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                        <span className="font-semibold text-gray-900 dark:text-white">{currentAvatar.rating}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>{currentAvatar.totalUsers.toLocaleString()} users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        <span>{currentAvatar.voiceType}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedCard>
          )}

          {/* Available Avatars */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              Choose a New AI Companion
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mb-6">
              Select a different AI companion that better fits your needs. Your session history will be preserved.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {aiAvatars.map((avatar, index) => {
                const isCurrent = avatar.id === currentAvatarId;
                const isSelected = avatar.id === selectedAvatarId;

                return (
                  <AnimatedCard key={avatar.id} delay={0.1 + index * 0.1}>
                    <motion.button
                      type="button"
                      whileHover={{ scale: isCurrent ? 1 : 1.02 }}
                      whileTap={{ scale: isCurrent ? 1 : 0.98 }}
                      onClick={() => !isCurrent && setSelectedAvatarId(avatar.id)}
                      disabled={isCurrent}
                      className={`relative w-full rounded-2xl border-2 transition-all overflow-hidden text-left ${
                        isCurrent
                          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 cursor-not-allowed opacity-70"
                          : isSelected
                          ? "border-purple-500 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-xl"
                          : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300 dark:hover:border-purple-500 hover:shadow-md"
                      }`}
                    >
                      {/* Current Badge */}
                      {isCurrent && (
                        <div className="absolute top-4 right-4 z-10">
                          <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Current
                          </span>
                        </div>
                      )}

                      {/* Selected Indicator */}
                      {isSelected && !isCurrent && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-4 right-4 z-10 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center shadow-lg"
                        >
                          <CheckCircle className="w-5 h-5 text-white" />
                        </motion.div>
                      )}

                      <div className="p-6">
                        {/* Avatar Image & Basic Info */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className="text-6xl">{avatar.image}</div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{avatar.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                              {avatar.gender} • {avatar.ageRange} years
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-slate-500">
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                                <span className="font-semibold text-gray-900 dark:text-white">{avatar.rating}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                <span>{avatar.totalUsers.toLocaleString()} users</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Personality */}
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                            <Heart className="w-3 h-3" /> Personality
                          </p>
                          <p className="text-sm text-gray-700 dark:text-slate-400">{avatar.personality}</p>
                        </div>

                        {/* Specialties */}
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Specializes In:</p>
                          <div className="flex flex-wrap gap-2">
                            {avatar.specialty.map((spec) => (
                              <span
                                key={spec}
                                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-700 dark:text-slate-400 mb-3 leading-relaxed">
                          {avatar.description}
                        </p>

                        {/* Voice Info */}
                        <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-slate-500">
                            <div className="flex items-center gap-1">
                              <Volume2 className="w-3 h-3" />
                              <span>{avatar.voiceType}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span>•</span>
                              <span>{avatar.accentType}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  </AnimatedCard>
                );
              })}
            </div>
          </div>

          {/* Switch History */}
          <AnimatedCard delay={0.5}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Switch History</h3>
              <div className="space-y-3">
                {switchHistory.map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-800">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-slate-300">
                        <span className="font-semibold text-gray-900 dark:text-white">{record.from}</span> → <span className="font-semibold text-gray-900 dark:text-white">{record.to}</span>
                      </p>
                      <p className="text-xs text-gray-600 dark:text-slate-500 mt-1">
                        {new Date(record.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AnimatedCard>

          {/* Confirm Button */}
          {selectedAvatarId !== currentAvatarId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowConfirmModal(true)}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-white font-semibold text-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Switch to {selectedAvatar?.name}
              </motion.button>
            </motion.div>
          )}

          {/* Confirmation Modal */}
          {showConfirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowConfirmModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border-2 border-purple-500/30"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Confirm AI Companion Change</h3>
                  <p className="text-purple-200">
                    Are you sure you want to switch from <span className="font-semibold">{currentAvatar?.name}</span> to <span className="font-semibold">{selectedAvatar?.name}</span>?
                  </p>
                  <p className="text-sm text-purple-300 mt-3">
                    Your session history and progress will be preserved.
                  </p>
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirmChange}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium"
                  >
                    Confirm Change
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
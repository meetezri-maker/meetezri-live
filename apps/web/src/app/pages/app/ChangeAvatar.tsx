import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AppLayout } from '@/app/components/AppLayout';
import { Brain, CheckCircle, Star, Users, Volume2, Heart, ArrowLeft, RefreshCw, AlertCircle, User } from 'lucide-react';
import { AnimatedCard } from '@/app/components/AnimatedCard';
import { Link } from 'react-router-dom';
import { DEFAULT_AI_COMPANIONS, matchDefaultCompanionByAvatarName } from '@meetezri/shared';
import {
  companionCardImageUrl,
  effectiveAvatarImageUrlFromDb,
  tryResolveCompanionPortraitUrl,
} from '@/lib/avatar/companionModelUrl';
import { findLobbyAvatar, isPlaceholderAvatarName } from '@/lib/avatar/lobbyAvatars';
import { useAuth } from '@/app/contexts/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface AIAvatar {
  id: string;
  name: string;
  gender: string;
  ageRange: string;
  personality: string;
  specialty: string[];
  description: string;
  /** Portrait from DB URL/path or `public/avatars/<Name>.png` */
  imageUrl?: string;
  voiceType: string;
  accentType: string;
  rating: number;
  totalUsers: number;
}

function mapApiRowToChangeAvatar(row: Record<string, unknown>): AIAvatar {
  const name = String(row.name ?? "").trim();
  const lobby = findLobbyAvatar(name);
  const rawUrl =
    typeof row.image_url === "string"
      ? effectiveAvatarImageUrlFromDb(row.image_url.trim())
      : "";

  const imageUrl = rawUrl
    ? rawUrl
    : tryResolveCompanionPortraitUrl(name) ?? lobby?.cardImage ?? undefined;

  const canon = matchDefaultCompanionByAvatarName(name);
  const dbSpecialties = Array.isArray(row.specialties)
    ? (row.specialties as string[])
    : [];
  const specialty = canon ? [...canon.specialties] : dbSpecialties;
  const description = canon ? canon.description : String(row.description ?? "");
  return {
    id: String(row.id ?? name),
    name,
    gender: String(row.gender ?? ""),
    ageRange: String(row.age_range ?? ""),
    personality: String(row.personality ?? ""),
    specialty,
    description,
    imageUrl,
    voiceType: String(row.voice_type ?? ""),
    accentType: String(row.accent_type ?? ""),
    rating: Number(row.rating) || 0,
    totalUsers: typeof row.unique_users === "number" ? row.unique_users : 0,
  };
}

function fallbackAiAvatarsFromDefaults(): AIAvatar[] {
  return DEFAULT_AI_COMPANIONS.map((c) => ({
    id: c.name,
    name: c.name,
    gender: c.gender,
    ageRange: c.age_range,
    personality: c.personality,
    specialty: [...c.specialties],
    description: c.description,
    imageUrl: companionCardImageUrl(c.portraitPng),
    voiceType: c.voice_type,
    accentType: c.accent_type,
    rating: c.rating,
    totalUsers: 0,
  }));
}

export function ChangeAvatar() {
  const { profile, refreshProfile } = useAuth();
  const [aiAvatars, setAiAvatars] = useState<AIAvatar[]>([]);
  const [avatarsLoading, setAvatarsLoading] = useState(true);
  const [currentAvatarId, setCurrentAvatarId] = useState("");
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [switchHistory, setSwitchHistory] = useState<{ date: string; from: string; to: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.aiAvatars.getAll();
        if (!Array.isArray(rows) || rows.length === 0) {
          if (!cancelled) setAiAvatars(fallbackAiAvatarsFromDefaults());
          return;
        }
        const mapped = rows
          .filter(
            (r: Record<string, unknown>) =>
              r.is_active !== false && typeof r.name === "string" && !isPlaceholderAvatarName(String(r.name))
          )
          .map((r: Record<string, unknown>) => mapApiRowToChangeAvatar(r));
        if (!cancelled) {
          setAiAvatars(mapped.length > 0 ? mapped : fallbackAiAvatarsFromDefaults());
        }
      } catch {
        if (!cancelled) setAiAvatars(fallbackAiAvatarsFromDefaults());
      } finally {
        if (!cancelled) setAvatarsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const avatarIdByName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of aiAvatars) {
      m[a.name.trim().toLowerCase()] = a.id;
    }
    return m;
  }, [aiAvatars]);

  useEffect(() => {
    if (aiAvatars.length === 0) return;
    const selectedFromProfile = (profile?.selected_avatar || aiAvatars[0]?.name || "").trim().toLowerCase();
    const nextAvatarId = avatarIdByName[selectedFromProfile] || aiAvatars[0].id;
    setCurrentAvatarId(nextAvatarId);
    setSelectedAvatarId(nextAvatarId);
  }, [profile?.selected_avatar, avatarIdByName, aiAvatars]);

  const currentAvatar = aiAvatars.find((a) => a.id === currentAvatarId);
  const selectedAvatar = aiAvatars.find((a) => a.id === selectedAvatarId);

  if (avatarsLoading || aiAvatars.length === 0) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-600 dark:text-slate-400">
            <RefreshCw className="w-10 h-10 animate-spin text-purple-500" />
            <p>Loading companions…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleConfirmChange = async () => {
    if (!selectedAvatar || isSaving) return;
    setIsSaving(true);
    try {
      await api.updateProfile({ selected_avatar: selectedAvatar.name });
      await refreshProfile();
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
      toast.success(`AI companion changed to ${selectedAvatar.name}`);
    } catch (error) {
      console.error(error);
      toast.error("Could not update AI companion");
    } finally {
      setIsSaving(false);
    }
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Change Solace Avatar</h1>
                <p className="text-gray-600 dark:text-slate-400">Switch to a different Avatar for your talks</p>
              </div>
            </div>
          </div>  

          {/* Current Avatar */}
          {currentAvatar && (
            <AnimatedCard delay={0.1}>
              <div className="bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-2xl border-2 border-purple-300 dark:border-purple-700 p-6 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Current Avatar</h2>
                </div>

                <div className="flex items-start gap-6">
                  {currentAvatar.imageUrl ? (
                    <img
                      src={currentAvatar.imageUrl}
                      alt=""
                      className="h-28 w-28 shrink-0 rounded-2xl object-cover border-2 border-purple-200/80 dark:border-purple-700/80 shadow-md"
                    />
                  ) : (
                    <div className="h-28 w-28 shrink-0 rounded-2xl border-2 border-purple-200/80 dark:border-purple-700/80 bg-muted flex items-center justify-center">
                      <User className="h-14 w-14 text-muted-foreground" aria-hidden />
                    </div>
                  )}
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
              Choose a New Avatar
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
                          {avatar.imageUrl ? (
                            <img
                              src={avatar.imageUrl}
                              alt=""
                              className="h-24 w-24 shrink-0 rounded-xl object-cover border border-gray-200 dark:border-slate-600"
                            />
                          ) : (
                            <div className="h-24 w-24 shrink-0 rounded-xl border border-gray-200 dark:border-slate-600 bg-muted flex items-center justify-center">
                              <User className="h-12 w-12 text-muted-foreground" aria-hidden />
                            </div>
                          )}
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
                    disabled={isSaving}
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isSaving}
                    onClick={() => void handleConfirmChange()}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium"
                  >
                    {isSaving ? "Saving..." : "Confirm Change"}
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
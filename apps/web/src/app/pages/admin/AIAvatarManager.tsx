
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { api } from '@/lib/api';
import { findLobbyAvatar, isPlaceholderAvatarName } from '@/lib/avatar/lobbyAvatars';
import { resolveCompanionPortraitUrl } from '@/lib/avatar/companionModelUrl';
import { 
  Brain, 
  Plus, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff, 
  Star, 
  Users, 
  Clock, 
  Search,
  Save,
  X,
  Volume2,
  Heart,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

/** Same card portraits as Session Lobby when the name matches a companion. */
function AdminAvatarVisual({ name, imageFallback }: { name: string; imageFallback: string }) {
  const lobby = findLobbyAvatar(name);
  if (lobby?.cardImage) {
    return (
      <div className="flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm bg-gray-50">
        <img src={lobby.cardImage} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  const raw = imageFallback?.trim() ?? '';
  if (/^https?:\/\//i.test(raw)) {
    return (
      <div className="flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm bg-gray-50">
        <img src={raw} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-28 h-28 flex items-center justify-center rounded-2xl border-2 border-gray-100 bg-gray-50 text-6xl leading-none">
      {raw || '👤'}
    </div>
  );
}

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
  totalSessions: number;
  avgSessionLength: number;
  isActive: boolean;
  createdAt: string;
}

export function AIAvatarManager() {
  const [avatars, setAvatars] = useState<AIAvatar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AIAvatar | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // New Avatar Form State
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    ageRange: '',
    personality: '',
    specialty: [] as string[],
    description: '',
    image: '👤',
    voiceType: '',
    accentType: ''
  });

  const fetchAvatars = async () => {
    try {
      setIsLoading(true);
      const data = await api.aiAvatars.getAll();
      const mapped = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        gender: item.gender,
        ageRange: item.age_range,
        personality: item.personality,
        specialty: item.specialties || [],
        description: item.description,
        image: item.image_url,
        voiceType: item.voice_type,
        accentType: item.accent_type,
        rating: Number(item.rating) || 5.0,
        totalUsers: typeof item.unique_users === 'number' ? item.unique_users : 0,
        totalSessions: typeof item.session_count === 'number' ? item.session_count : 0,
        avgSessionLength: typeof item.avg_session_minutes === 'number' ? item.avg_session_minutes : 0,
        isActive: item.is_active,
        createdAt: item.created_at
      }));
      setAvatars(mapped);
    } catch (error) {
      console.error("Failed to fetch avatars", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvatars();
  }, []);

  const stats = {
    totalAvatars: avatars.length,
    activeAvatars: avatars.filter(a => a.isActive).length,
    totalSessionUsage: avatars.reduce((sum, a) => sum + a.totalSessions, 0),
    avgRating: avatars.length > 0 ? (avatars.reduce((sum, a) => sum + a.rating, 0) / avatars.length).toFixed(1) : "0.0"
  };

  const filteredAvatars = avatars.filter(
    (avatar) =>
      avatar.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      avatar.specialty.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  /** Active DB companions — same names users see in Session Lobby (portrait from lobby assets or URL). */
  const inAppCompanionChips = useMemo(() => {
    return avatars
      .filter((a) => a.isActive && !isPlaceholderAvatarName(a.name))
      .map((a) => {
        const lobby = findLobbyAvatar(a.name);
        const raw = a.image?.trim() ?? "";
        const src =
          lobby?.cardImage ??
          (/^https?:\/\//i.test(raw) ? raw : null) ??
          resolveCompanionPortraitUrl(a.name);
        const emoji =
          raw && !/^https?:\/\//i.test(raw)
            ? raw
            : lobby?.emoji ?? "👤";
        return { id: a.id, name: a.name, src, emoji };
      });
  }, [avatars]);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.aiAvatars.update(id, { is_active: !currentStatus });
      fetchAvatars();
    } catch (error) {
      console.error("Failed to toggle status", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.aiAvatars.delete(id);
      setShowDeleteConfirm(false);
      fetchAvatars();
    } catch (error) {
      console.error("Failed to delete avatar", error);
    }
  };

  const handleCreate = async () => {
    try {
      const payload = {
        name: formData.name,
        gender: formData.gender,
        age_range: formData.ageRange,
        personality: formData.personality,
        specialties: formData.specialty,
        description: formData.description,
        image_url: formData.image,
        voice_type: formData.voiceType,
        accent_type: formData.accentType,
        is_active: true
      };
      await api.aiAvatars.create(payload);
      setShowCreateModal(false);
      resetForm();
      fetchAvatars();
    } catch (error) {
      console.error("Failed to create avatar", error);
    }
  };

  const handleEdit = async () => {
    if (selectedAvatar) {
      try {
        const payload = {
          name: formData.name,
          gender: formData.gender,
          age_range: formData.ageRange,
          personality: formData.personality,
          specialties: formData.specialty,
          description: formData.description,
          image_url: formData.image,
          voice_type: formData.voiceType,
          accent_type: formData.accentType
        };
        await api.aiAvatars.update(selectedAvatar.id, payload);
        setShowEditModal(false);
        setSelectedAvatar(null);
        resetForm();
        fetchAvatars();
      } catch (error) {
        console.error("Failed to update avatar", error);
      }
    }
  };

  const openEditModal = (avatar: AIAvatar) => {
    setSelectedAvatar(avatar);
    setFormData({
      name: avatar.name,
      gender: avatar.gender,
      ageRange: avatar.ageRange,
      personality: avatar.personality,
      specialty: avatar.specialty,
      description: avatar.description,
      image: avatar.image,
      voiceType: avatar.voiceType,
      accentType: avatar.accentType
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      gender: '',
      ageRange: '',
      personality: '',
      specialty: [],
      description: '',
      image: '👤',
      voiceType: '',
      accentType: ''
    });
  };

  const emojiOptions = ['👨‍⚕️', '👩‍⚕️', '🧑‍⚕️', '👨‍💼', '👩‍💼', '👨', '👩', '🧑', '👴', '👵', '👩‍🦳', '👨‍🦳'];

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  return (
    <AdminLayoutNew>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">AI Avatar Manager</h1>
                <p className="text-gray-600">Create and manage AI companion avatars</p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-white font-semibold flex items-center gap-2 hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Create New Avatar
            </motion.button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Brain className="w-8 h-8 text-purple-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.totalAvatars}</span>
              </div>
              <p className="text-sm text-gray-600">Total Avatars</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.activeAvatars}</span>
              </div>
              <p className="text-sm text-gray-600">Active Avatars</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.totalSessionUsage.toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600">Sessions (usage)</p>
              <p className="text-xs text-gray-400 mt-1">Ended sessions matched to avatars by name</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Star className="w-8 h-8 text-yellow-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.avgRating}</span>
              </div>
              <p className="text-sm text-gray-600">Average Rating</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search avatars by name or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>
        </div>

        {/* Avatars List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAvatars.map((avatar, index) => (
            <motion.div
              key={avatar.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-2xl border-2 p-6 shadow-lg transition-all ${
                avatar.isActive ? 'border-green-200' : 'border-gray-200 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <AdminAvatarVisual name={avatar.name} imageFallback={avatar.image} />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{avatar.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{avatar.gender} • {avatar.ageRange} years</p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                        <span className="font-semibold">{avatar.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{avatar.totalUsers.toLocaleString()} users</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleToggleActive(avatar.id, avatar.isActive)}
                    className={`p-2 rounded-lg transition-all ${
                      avatar.isActive
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {avatar.isActive ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                  </motion.button>
                </div>
              </div>

              {/* Personality */}
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Heart className="w-3 h-3" /> Personality
                </p>
                <p className="text-sm text-gray-600">{avatar.personality}</p>
              </div>

              {/* Specialties */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Specializes In:</p>
                <div className="flex flex-wrap gap-2">
                  {avatar.specialty.map((spec) => (
                    <span
                      key={spec}
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{avatar.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{avatar.totalSessions.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">Sessions</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{avatar.avgSessionLength} min</p>
                  <p className="text-xs text-gray-600">Avg Length</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{avatar.totalUsers}</p>
                  <p className="text-xs text-gray-600">Users</p>
                </div>
              </div>

              {/* Voice Info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 text-xs text-gray-600">
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

              {/* Actions */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => openEditModal(avatar)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedAvatar(avatar);
                    setShowDeleteConfirm(true);
                  }}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredAvatars.length === 0 && (
          <div className="text-center py-16">
            <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No avatars found</h3>
            <p className="text-gray-600">Try adjusting your search or create a new avatar</p>
          </div>
        )}

        {/* Same companions users see in Session Lobby — active DB rows + lobby artwork (bottom of page) */}
        <div className="mt-10 rounded-2xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Companions in app</h2>
          <p className="text-sm text-gray-600 mb-4">
            Active avatars from the database whose names match lobby assets in{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">public/avatars</code>. These are the faces and
            labels members pick in the session lobby.
          </p>
          {inAppCompanionChips.length === 0 ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              No active companions yet, or none match lobby file names. Activate avatars in the list above and use
              names like &quot;Alex Rivera&quot; or &quot;Sarah Mitchell&quot; so portraits resolve.
            </p>
          ) : (
            <div className="flex flex-wrap gap-4 justify-start">
              {inAppCompanionChips.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm min-w-[7.5rem]"
                >
                  {a.src ? (
                    <img
                      src={a.src}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover border border-gray-100"
                    />
                  ) : (
                    <span className="text-4xl" aria-hidden>
                      {a.emoji}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-900 text-center leading-tight">{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        <AnimatePresence>
          {(showCreateModal || showEditModal) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                resetForm();
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-2xl w-full my-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {showCreateModal ? 'Create New Avatar' : 'Edit Avatar'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {/* Image Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Avatar Image</label>
                    {showCreateModal && avatars.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Existing avatars — click to reuse</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 rounded-lg border border-gray-100 bg-gray-50/80">
                          {avatars.map((a) => {
                            const lobby = findLobbyAvatar(a.name);
                            return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, image: a.image || '👤' })}
                              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border-2 text-left transition-all min-w-[4.5rem] ${
                                formData.image === a.image
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:border-purple-300 bg-white'
                              }`}
                              title={a.name}
                            >
                              <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center bg-gray-50">
                                {lobby?.cardImage ? (
                                  <img
                                    src={lobby.cardImage}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-2xl leading-none">{a.image}</span>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-gray-700 truncate max-w-[5rem]">{a.name}</span>
                            </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="text-xs font-medium text-gray-500 mb-2">Preset icons</p>
                    <div className="flex flex-wrap gap-2">
                      {emojiOptions.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setFormData({ ...formData, image: emoji })}
                          className={`text-4xl p-3 rounded-xl border-2 transition-all ${
                            formData.image === emoji
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                      placeholder="e.g., Maya Chen"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                    </select>
                  </div>

                  {/* Age Range */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Age Range</label>
                    <input
                      type="text"
                      value={formData.ageRange}
                      onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                      placeholder="e.g., 35-40"
                    />
                  </div>

                  {/* Personality */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Personality</label>
                    <input
                      type="text"
                      value={formData.personality}
                      onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                      placeholder="e.g., Warm, Empathetic, Professional"
                    />
                  </div>

                  {/* Specialty */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Specialties (comma-separated)</label>
                    <input
                      type="text"
                      value={formData.specialty.join(', ')}
                      onChange={(e) => setFormData({ ...formData, specialty: e.target.value.split(',').map(s => s.trim()) })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                      placeholder="e.g., Anxiety, Depression, Stress Management"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                      placeholder="Describe the avatar's approach and expertise..."
                    />
                  </div>

                  {/* Voice Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Voice Type</label>
                    <input
                      type="text"
                      value={formData.voiceType}
                      onChange={(e) => setFormData({ ...formData, voiceType: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                      placeholder="e.g., Warm & Soothing"
                    />
                  </div>

                  {/* Accent Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Accent Type</label>
                    <input
                      type="text"
                      value={formData.accentType}
                      onChange={(e) => setFormData({ ...formData, accentType: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                      placeholder="e.g., Neutral American"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={showCreateModal ? handleCreate : handleEdit}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    {showCreateModal ? 'Create Avatar' : 'Save Changes'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && selectedAvatar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6 max-w-md w-full"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Avatar?</h3>
                  <p className="text-gray-600">
                    Are you sure you want to delete <span className="font-semibold">{selectedAvatar.name}</span>?
                  </p>
                  <p className="text-sm text-red-600 mt-2">
                    This action cannot be undone. {selectedAvatar.totalUsers} users currently use this avatar.
                  </p>
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDelete(selectedAvatar.id)}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium"
                  >
                    Delete Avatar
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}

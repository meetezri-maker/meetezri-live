
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminLayoutNew } from '@/app/components/AdminLayoutNew';
import { useAuth } from '@/app/contexts/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { DEFAULT_AI_COMPANIONS } from '@meetezri/shared';
import { findLobbyAvatar, isPlaceholderAvatarName } from '@/lib/avatar/lobbyAvatars';
import {
  effectiveAvatarImageUrlFromDb,
  tryResolveCompanionPortraitUrl,
} from '@/lib/avatar/companionModelUrl';

import { 
  Brain, 
  Plus, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff, 
  Users, 
  Clock, 
  Search,
  Save,
  X,
  Volume2,
  Heart,
  AlertCircle,
  User,
  Upload,
  Loader2,
  Star,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';

/** Portrait: optional URL/path from DB, else `public/avatars/<Name>.png`. */
function AdminAvatarVisual({ name, imageFallback }: { name: string; imageFallback: string }) {
  const raw = effectiveAvatarImageUrlFromDb(imageFallback?.trim() ?? "");
  if (raw) {
    return (
      <div className="flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm bg-gray-50">
        <img src={raw} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  const portrait = tryResolveCompanionPortraitUrl(name);
  if (portrait) {
    return (
      <div className="flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm bg-gray-50">
        <img src={portrait} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-28 h-28 flex items-center justify-center rounded-2xl border-2 border-gray-100 bg-gray-50">
      <User className="w-14 h-14 text-gray-400" aria-hidden />
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
  totalUsers: number;
  totalSessions: number;
  avgSessionLength: number;
  isActive: boolean;
  createdAt: string;
  /** Shown when API returned no rows — previews only until you seed or create in the database */
  isLocalDefault?: boolean;
}

interface AvatarSession {
  id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  full_name: string | null;
  email: string | null;
  message_count: number;
}

interface AvatarUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  last_session: string | null;
  session_count: number;
}

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

/** Upload to Supabase `avatars` bucket; path must start with `userId/` per RLS. */
async function uploadCompanionPortraitFile(
  file: File,
  userId: string,
  companionName: string
): Promise<string> {
  const slug =
    companionName
      .trim()
      .replace(/[^a-zA-Z0-9._\s-]+/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 64) || "companion";
  const ext = file.name.split(".").pop()?.toLowerCase();
  const safeExt =
    ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "png";
  const path = `${userId}/ai-companions/${slug}/${Date.now()}.${safeExt}`;
  const contentType =
    file.type ||
    (safeExt === "jpg" || safeExt === "jpeg"
      ? "image/jpeg"
      : safeExt === "png"
        ? "image/png"
        : safeExt === "webp"
          ? "image/webp"
          : "image/gif");
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

function buildLocalDefaultAvatars(): AIAvatar[] {
  return DEFAULT_AI_COMPANIONS.map((c) => ({
    id: `local:${c.name}`,
    name: c.name,
    gender: c.gender,
    ageRange: c.age_range,
    personality: c.personality,
    specialty: [...c.specialties],
    description: c.description,
    image: "",
    voiceType: c.voice_type,
    accentType: c.accent_type,
    totalUsers: 0,
    totalSessions: 0,
    avgSessionLength: 0,
    isActive: true,
    createdAt: "",
    isLocalDefault: true,
  }));
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const SESSIONS_PAGE_SIZE = 20;

export function AIAvatarManager() {
  const { user } = useAuth();
  const [avatars, setAvatars] = useState<AIAvatar[]>([]);
  /** When false, the list is filled from `DEFAULT_AI_COMPANIONS` only (database is empty). */
  const [usingDbRows, setUsingDbRows] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState<string | null>(null);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AIAvatar | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Talk it out modal state
  const [sessionsModal, setSessionsModal] = useState<{ avatar: AIAvatar | null; open: boolean }>({ avatar: null, open: false });
  const [sessionsData, setSessionsData] = useState<{ items: AvatarSession[]; total: number }>({ items: [], total: 0 });
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Transcript modal state
  const [transcriptModal, setTranscriptModal] = useState<{
    open: boolean;
    session: AvatarSession | null;
    messages: TranscriptMessage[];
    loading: boolean;
  }>({ open: false, session: null, messages: [], loading: false });

  // Users modal state
  const [usersModal, setUsersModal] = useState<{ avatar: AIAvatar | null; open: boolean }>({ avatar: null, open: false });
  const [usersData, setUsersData] = useState<AvatarUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // New Avatar Form State
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    ageRange: '',
    personality: '',
    specialty: [] as string[],
    description: '',
    image: '',
    voiceType: '',
    accentType: ''
  });

  const fetchAvatars = async () => {
    try {
      setIsLoading(true);
      const data = await api.aiAvatars.getAllWithUsageStats();
      const rows = Array.isArray(data) ? data : [];
      const mapped = rows.map((item: any) => ({
        id: item.id,
        name: item.name,
        gender: item.gender,
        ageRange: item.age_range,
        personality: item.personality,
        specialty: item.specialties || [],
        description: item.description,
        image: effectiveAvatarImageUrlFromDb(
          typeof item.image_url === "string" ? item.image_url : ""
        ),
        voiceType: item.voice_type,
        accentType: item.accent_type,
        totalUsers: typeof item.unique_users === 'number' ? item.unique_users : 0,
        totalSessions: typeof item.session_count === 'number' ? item.session_count : 0,
        avgSessionLength: typeof item.avg_session_minutes === 'number' ? item.avg_session_minutes : 0,
        isActive: item.is_active,
        createdAt: item.created_at
      }));
      if (mapped.length > 0) {
        setAvatars(mapped);
        setUsingDbRows(true);
      } else {
        setAvatars(buildLocalDefaultAvatars());
        setUsingDbRows(false);
      }
    } catch (error) {
      console.error("Failed to fetch avatars", error);
      setAvatars(buildLocalDefaultAvatars());
      setUsingDbRows(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAvatars();
  }, []);

  const stats = useMemo(() => {
    if (!usingDbRows) {
      return {
        totalAvatars: 0,
        activeAvatars: 0,
        totalSessionUsage: 0,
        totalUsers: 0,
      };
    }
    return {
      totalAvatars: avatars.length,
      activeAvatars: avatars.filter((a) => a.isActive).length,
      totalSessionUsage: avatars.reduce((sum, a) => sum + a.totalSessions, 0),
      totalUsers: avatars.reduce((sum, a) => sum + a.totalUsers, 0),
    };
  }, [avatars, usingDbRows]);

  const filteredAvatars = avatars.filter(
    (avatar) =>
      avatar.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      avatar.specialty.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  /** Active DB companions — same names users see in Session Lobby (portrait from lobby assets or URL). */
  const inAppCompanionChips = useMemo(() => {
    return avatars
      .filter(
        (a) =>
          !a.isLocalDefault && a.isActive && !isPlaceholderAvatarName(a.name)
      )
      .map((a) => {
        const raw = effectiveAvatarImageUrlFromDb(a.image?.trim() ?? "");
        const src =
          raw || tryResolveCompanionPortraitUrl(a.name) || undefined;
        return { id: a.id, name: a.name, src };
      });
  }, [avatars]);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (id.startsWith("local:")) {
      toast.message("Save companions to the database first", {
        description: "Run the API seed script or use Create / Add to database.",
      });
      return;
    }
    try {
      await api.aiAvatars.update(id, { is_active: !currentStatus });
      fetchAvatars();
    } catch (error) {
      console.error("Failed to toggle status", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("local:")) {
      toast.message("Nothing to delete yet", {
        description: "These previews are not stored in the database.",
      });
      return;
    }
    try {
      await api.aiAvatars.delete(id);
      setShowDeleteConfirm(false);
      fetchAvatars();
    } catch (error) {
      console.error("Failed to delete avatar", error);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (portraitFile && !user?.id) {
      toast.error("Sign in to upload a portrait");
      return;
    }
    setIsSavingAvatar(true);
    try {
      let imageUrl: string | null = formData.image.trim() || null;
      if (portraitFile && user?.id) {
        imageUrl = await uploadCompanionPortraitFile(
          portraitFile,
          user.id,
          formData.name
        );
      }
      const payload = {
        name: formData.name,
        gender: formData.gender,
        age_range: formData.ageRange,
        personality: formData.personality,
        specialties: formData.specialty,
        description: formData.description,
        image_url: imageUrl,
        voice_type: formData.voiceType,
        accent_type: formData.accentType,
        is_active: true
      };
      await api.aiAvatars.create(payload);
      toast.success("Avatar created — portrait URL saved on the record");
      setShowCreateModal(false);
      resetForm();
      fetchAvatars();
    } catch (error) {
      console.error("Failed to create avatar", error);
      toast.error(
        error instanceof Error ? error.message : "Could not create avatar"
      );
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleEdit = async () => {
    if (selectedAvatar) {
      if (!formData.name.trim()) {
        toast.error("Name is required");
        return;
      }
      if (portraitFile && !user?.id) {
        toast.error("Sign in to upload a portrait");
        return;
      }
      setIsSavingAvatar(true);
      try {
        let imageUrl: string | null = formData.image.trim() || null;
        if (portraitFile && user?.id) {
          imageUrl = await uploadCompanionPortraitFile(
            portraitFile,
            user.id,
            formData.name
          );
        }
        const payload = {
          name: formData.name,
          gender: formData.gender,
          age_range: formData.ageRange,
          personality: formData.personality,
          specialties: formData.specialty,
          description: formData.description,
          image_url: imageUrl,
          voice_type: formData.voiceType,
          accent_type: formData.accentType
        };
        await api.aiAvatars.update(selectedAvatar.id, payload);
        toast.success("Avatar updated");
        setShowEditModal(false);
        setSelectedAvatar(null);
        resetForm();
        fetchAvatars();
      } catch (error) {
        console.error("Failed to update avatar", error);
        toast.error(
          error instanceof Error ? error.message : "Could not update avatar"
        );
      } finally {
        setIsSavingAvatar(false);
      }
    }
  };

  const openEditModal = (avatar: AIAvatar) => {
    clearPortraitPick();
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

  /** Pre-filled create flow for a default preview row (database empty). */
  const openCreateFromDefault = (avatar: AIAvatar) => {
    clearPortraitPick();
    setSelectedAvatar(null);
    setFormData({
      name: avatar.name,
      gender: avatar.gender,
      ageRange: avatar.ageRange,
      personality: avatar.personality,
      specialty: avatar.specialty,
      description: avatar.description,
      image: "",
      voiceType: avatar.voiceType,
      accentType: avatar.accentType,
    });
    setShowCreateModal(true);
  };

  const clearPortraitPick = useCallback(() => {
    setPortraitPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setPortraitFile(null);
  }, []);

  const resetForm = () => {
    clearPortraitPick();
    setFormData({
      name: '',
      gender: '',
      ageRange: '',
      personality: '',
      specialty: [],
      description: '',
      image: '',
      voiceType: '',
      accentType: ''
    });
  };

  const onPortraitFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5 MB or smaller");
      return;
    }
    setPortraitFile(f);
    setPortraitPreviewUrl((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  };

  const modalPortraitPreview = useMemo(() => {
    if (portraitPreviewUrl) return portraitPreviewUrl;
    const raw = formData.image.trim();
    if (raw) {
      const eff = effectiveAvatarImageUrlFromDb(raw);
      if (eff) return eff;
      if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
    }
    if (formData.name.trim()) {
      return tryResolveCompanionPortraitUrl(formData.name) ?? undefined;
    }
    return undefined;
  }, [portraitPreviewUrl, formData.image, formData.name]);

  // Talk it out modal handlers
  const fetchAvatarSessions = useCallback(async (avatarId: string, page: number) => {
    setSessionsLoading(true);
    try {
      const data = await api.aiAvatars.getAvatarSessions(avatarId, { page, limit: SESSIONS_PAGE_SIZE }) as { items: AvatarSession[]; total: number };
      setSessionsData({ items: data.items ?? [], total: data.total ?? 0 });
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const openSessionsModal = useCallback((avatar: AIAvatar) => {
    if (avatar.isLocalDefault) return;
    setSessionsModal({ avatar, open: true });
    setSessionsPage(1);
    fetchAvatarSessions(avatar.id, 1);
  }, [fetchAvatarSessions]);

  const handleSessionsPageChange = useCallback((newPage: number) => {
    if (!sessionsModal.avatar) return;
    setSessionsPage(newPage);
    fetchAvatarSessions(sessionsModal.avatar.id, newPage);
  }, [sessionsModal.avatar, fetchAvatarSessions]);

  const openTranscript = useCallback(async (session: AvatarSession) => {
    setTranscriptModal({ open: true, session, messages: [], loading: true });
    try {
      const messages = await api.admin.getSessionRecordingTranscript(session.id);
      setTranscriptModal((prev) => ({
        ...prev,
        messages: Array.isArray(messages) ? (messages as TranscriptMessage[]) : [],
        loading: false,
      }));
    } catch {
      toast.error('Failed to load transcript');
      setTranscriptModal((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  // Users modal handlers
  const openUsersModal = useCallback(async (avatar: AIAvatar) => {
    if (avatar.isLocalDefault) return;
    setUsersModal({ avatar, open: true });
    setUsersLoading(true);
    try {
      const users = await api.aiAvatars.getAvatarUsers(avatar.id);
      setUsersData(Array.isArray(users) ? (users as AvatarUser[]) : []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <AdminLayoutNew>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
        </div>
      </AdminLayoutNew>
    );
  }

  const sessionsTotalPages = Math.ceil(sessionsData.total / SESSIONS_PAGE_SIZE);

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
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
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
                <Users className="w-8 h-8 text-green-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.activeAvatars}</span>
              </div>
              <p className="text-sm text-gray-600">Active Avatars</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-8 h-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">
                  {stats.totalSessionUsage.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-600">Total Talk it out</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-indigo-600" />
                <span className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600">Users Engaged</p>
              <p className="text-xs text-gray-400 mt-0.5">Unique users per avatar (summed)</p>
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

        {!usingDbRows && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">No companion rows in the database yet</p>
            <p className="text-amber-900/90 mt-1">
              The cards below are previews from product defaults. Stats stay at 0 until you seed or create
              records. Use <span className="font-semibold">Add to database</span> on a card (or{" "}
              <span className="font-semibold">Create New Avatar</span>) to save them.
            </p>
          </div>
        )}

        {/* Avatars List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredAvatars.map((avatar, index) => (
            <motion.div
              key={avatar.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white rounded-2xl border-2 p-6 shadow-lg transition-all ${
                avatar.isLocalDefault
                  ? "border-dashed border-amber-200"
                  : avatar.isActive
                    ? "border-green-200"
                    : "border-gray-200 opacity-60"
              }`}
            >
              {avatar.isLocalDefault && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Preview — not in database
                </p>
              )}
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <AdminAvatarVisual name={avatar.name} imageFallback={avatar.image} />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{avatar.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{avatar.gender} • {avatar.ageRange} years</p>
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <button
                        onClick={() => openUsersModal(avatar)}
                        disabled={avatar.isLocalDefault}
                        className={cn(
                          'flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors',
                          avatar.isLocalDefault
                            ? 'cursor-default'
                            : 'hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer'
                        )}
                        aria-label={`View ${avatar.totalUsers} users for ${avatar.name}`}
                      >
                        <Users className="w-4 h-4" />
                        <span className="font-medium">{avatar.totalUsers.toLocaleString()} users</span>
                        {!avatar.isLocalDefault && <span className="text-indigo-400">↗</span>}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {avatar.isLocalDefault ? (
                    <span className="text-xs text-amber-700 font-medium px-2 py-1 rounded-lg bg-amber-100">
                      DB pending
                    </span>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleToggleActive(avatar.id, avatar.isActive)}
                      className={`p-2 rounded-lg transition-all ${
                        avatar.isActive
                          ? "bg-green-100 text-green-600 hover:bg-green-200"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      {avatar.isActive ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                    </motion.button>
                  )}
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
                <button
                  onClick={() => openSessionsModal(avatar)}
                  disabled={avatar.isLocalDefault}
                  className={cn(
                    'text-center rounded-xl p-2 transition-colors',
                    avatar.isLocalDefault
                      ? 'cursor-default'
                      : 'hover:bg-purple-50 cursor-pointer group'
                  )}
                  aria-label={`View ${avatar.totalSessions} sessions for ${avatar.name}`}
                >
                  <p className={cn('text-lg font-bold text-gray-900', !avatar.isLocalDefault && 'group-hover:text-purple-700 transition-colors')}>
                    {avatar.totalSessions.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600 flex items-center justify-center gap-0.5">
                    Talk it out{!avatar.isLocalDefault && <span className="text-purple-400 ml-0.5">↗</span>}
                  </p>
                </button>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{avatar.avgSessionLength} min</p>
                  <p className="text-xs text-gray-600">Avg Length</p>
                </div>
                <button
                  onClick={() => openUsersModal(avatar)}
                  disabled={avatar.isLocalDefault}
                  className={cn(
                    'text-center rounded-xl p-2 transition-colors',
                    avatar.isLocalDefault
                      ? 'cursor-default'
                      : 'hover:bg-indigo-50 cursor-pointer group'
                  )}
                  aria-label={`View ${avatar.totalUsers} users for ${avatar.name}`}
                >
                  <p className={cn('text-lg font-bold text-gray-900', !avatar.isLocalDefault && 'group-hover:text-indigo-700 transition-colors')}>
                    {avatar.totalUsers}
                  </p>
                  <p className="text-xs text-gray-600 flex items-center justify-center gap-0.5">
                    Users{!avatar.isLocalDefault && <span className="text-indigo-400 ml-0.5">↗</span>}
                  </p>
                </button>
              </div>

              {/* Rating placeholder */}
              <div className="mb-4 px-3 py-2.5 bg-yellow-50 rounded-xl border border-yellow-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-semibold text-gray-700">Rating</span>
                  <div className="flex gap-0.5 ml-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-3.5 h-3.5 text-gray-200 fill-gray-200" />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-400 italic">Coming soon</span>
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
                  onClick={() =>
                    avatar.isLocalDefault ? openCreateFromDefault(avatar) : openEditModal(avatar)
                  }
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  {avatar.isLocalDefault ? "Add to database" : "Edit"}
                </motion.button>

                {!avatar.isLocalDefault && (
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
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State (e.g. search has no matches) */}
        {filteredAvatars.length === 0 && (
          <div className="text-center py-16">
            <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No matches</h3>
            <p className="text-gray-600">Try adjusting your search or create a new avatar</p>
          </div>
        )}

        {/* Same companions users see in Session Lobby */}
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
              names that match PNG files in{" "}
              <code className="text-xs bg-gray-100 px-1 rounded">public/avatars</code> (e.g.{" "}
              <code className="text-xs">Alex</code>, <code className="text-xs">Jordan Taylor</code>,{" "}
              <code className="text-xs">Maya Chen</code>, <code className="text-xs">Sara Mitchell</code>).
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
                    <div
                      className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center"
                      aria-hidden
                    >
                      <User className="w-8 h-8 text-gray-400" />
                    </div>
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto"
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
                  {/* Portrait */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Portrait
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      <span className="font-medium text-gray-700">Upload</span> saves the file to Supabase
                      Storage and stores the public URL in <code className="text-xs bg-gray-100 px-1 rounded">image_url</code>.
                      Or leave upload empty and use a URL, or rely on{" "}
                      <code className="text-xs bg-gray-100 px-1 rounded">public/avatars/&lt;Name&gt;.png</code> when
                      both are empty.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <Upload className="h-4 w-4" />
                        Choose image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                          onChange={onPortraitFileChange}
                        />
                      </label>
                      {portraitFile && (
                        <button
                          type="button"
                          onClick={() => {
                            clearPortraitPick();
                          }}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove upload
                        </button>
                      )}
                    </div>
                    {modalPortraitPreview && (
                      <div className="mb-3 flex items-center gap-3">
                        <img
                          src={modalPortraitPreview}
                          alt=""
                          className="h-20 w-20 rounded-full object-cover object-top border border-gray-200 shadow-sm"
                        />
                        <span className="text-xs text-gray-500">
                          {portraitFile ? "New upload (will be saved on create/update)" : "Preview"}
                        </span>
                      </div>
                    )}
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Optional image URL (used if you do not upload)
                    </label>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 text-sm"
                      placeholder="https://… or /path/to/image.png (optional)"
                    />
                    {showCreateModal && avatars.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Existing avatars — click to copy optional URL (or clear field for folder PNG only)
                        </p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 rounded-lg border border-gray-100 bg-gray-50/80">
                          {avatars.map((a) => {
                            const eff = effectiveAvatarImageUrlFromDb(a.image?.trim() ?? "");
                            const thumbSrc =
                              eff ||
                              tryResolveCompanionPortraitUrl(a.name) ||
                              findLobbyAvatar(a.name)?.cardImage ||
                              undefined;
                            return (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => setFormData({ ...formData, image: eff })}
                                className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border-2 text-left transition-all min-w-[4.5rem] ${
                                  formData.image === eff && eff !== ""
                                    ? "border-purple-500 bg-purple-50"
                                    : "border-gray-200 hover:border-purple-300 bg-white"
                                }`}
                                title={a.name}
                              >
                                <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center bg-gray-50">
                                  {thumbSrc ? (
                                    <img
                                      src={thumbSrc}
                                      alt=""
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-6 h-6 text-gray-400" />
                                  )}
                                </div>
                                <span className="text-[10px] font-medium text-gray-700 truncate max-w-[5rem]">
                                  {a.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
                      placeholder="e.g., anxiousness, Low morale support, Stress Management"
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
                    disabled={isSavingAvatar}
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium disabled:opacity-60"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isSavingAvatar}
                    onClick={showCreateModal ? handleCreate : handleEdit}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSavingAvatar ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {isSavingAvatar
                      ? "Saving…"
                      : showCreateModal
                        ? "Create Avatar"
                        : "Save Changes"}
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
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
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

        {/* Talk it out Modal */}
        <AnimatePresence>
          {sessionsModal.open && sessionsModal.avatar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
              onClick={() => setSessionsModal({ avatar: null, open: false })}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Talk it out — {sessionsModal.avatar.name}</h3>
                      <p className="text-xs text-gray-500">{sessionsData.total.toLocaleString()} total sessions</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSessionsModal({ avatar: null, open: false })}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Talk it out list */}
                <div className="flex-1 overflow-y-auto">
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                  ) : sessionsData.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Clock className="w-12 h-12 mb-3" />
                      <p className="font-medium">No sessions found</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Messages</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sessionsData.items.map((session) => (
                          <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3">
                              <div className="font-medium text-gray-900">{session.full_name || 'Unknown'}</div>
                              <div className="text-xs text-gray-400">{session.email || '—'}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                {formatDateTime(session.started_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {session.duration_minutes != null ? `${session.duration_minutes} min` : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                                {session.message_count}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => openTranscript(session)}
                                className="text-xs font-medium text-purple-600 hover:text-purple-800 hover:underline whitespace-nowrap"
                              >
                                View Transcript
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {sessionsTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 flex-shrink-0">
                    <p className="text-sm text-gray-500">
                      Page {sessionsPage} of {sessionsTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSessionsPageChange(sessionsPage - 1)}
                        disabled={sessionsPage <= 1 || sessionsLoading}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSessionsPageChange(sessionsPage + 1)}
                        disabled={sessionsPage >= sessionsTotalPages || sessionsLoading}
                        className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transcript Modal */}
        <AnimatePresence>
          {transcriptModal.open && transcriptModal.session && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              onClick={() => setTranscriptModal({ open: false, session: null, messages: [], loading: false })}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Session Transcript</h3>
                    <p className="text-xs text-gray-500">
                      {transcriptModal.session.full_name || transcriptModal.session.email || 'Unknown user'} · {formatDateTime(transcriptModal.session.started_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => setTranscriptModal({ open: false, session: null, messages: [], loading: false })}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                    aria-label="Close transcript"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {transcriptModal.loading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                  ) : transcriptModal.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <MessageSquare className="w-12 h-12 mb-3" />
                      <p className="font-medium">No messages in this session</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transcriptModal.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] rounded-2xl px-4 py-3',
                              msg.role === 'user'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-800'
                            )}
                          >
                            <p className={cn('text-[10px] font-semibold mb-1 uppercase tracking-wide', msg.role === 'user' ? 'text-purple-200' : 'text-gray-400')}>
                              {msg.role === 'user' ? 'User' : sessionsModal.avatar?.name ?? 'AI'}
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <p className={cn('text-[10px] mt-1', msg.role === 'user' ? 'text-purple-300' : 'text-gray-400')}>
                              {formatDateTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Users Modal */}
        <AnimatePresence>
          {usersModal.open && usersModal.avatar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
              onClick={() => setUsersModal({ avatar: null, open: false })}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Users — {usersModal.avatar.name}</h3>
                      <p className="text-xs text-gray-500">{usersData.length.toLocaleString()} unique users</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUsersModal({ avatar: null, open: false })}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                  ) : usersData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Users className="w-12 h-12 mb-3" />
                      <p className="font-medium">No users found</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Session</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Talk it out</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {usersData.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3">
                              <div className="flex items-center gap-3">
                                {u.avatar_url ? (
                                  <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-indigo-500" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-gray-900">{u.full_name || 'Unnamed user'}</div>
                                  <div className="text-xs text-gray-400">{u.email || '—'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                              {formatDate(u.last_session)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                                <Clock className="w-3 h-3" />
                                {u.session_count}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayoutNew>
  );
}

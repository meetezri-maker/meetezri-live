import { AppLayout } from "../../components/AppLayout";
import { motion } from "motion/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Edit,
  Camera,
  Bell,
  Lock,
  Shield,
  Heart,
  Volume2,
  Palette,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Activity,
  Target,
  Zap,
  Users,
  Loader2,
  Trophy,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { profileAgeStorageToDisplayYears } from "@/lib/profileAge";
import { resolveVerificationRedirectForFlow } from "@/lib/verificationRedirect";
import { Skeleton } from "../../components/ui/skeleton";
import { Progress } from "../../components/ui/progress";
import { Switch } from "../../components/ui/switch";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { PhoneInput } from "../../components/ui/phone-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

/* ─── style constants (orange → pink dashboard theme) ─── */
const GRAD =
  "linear-gradient(135deg, #ff7a18 0%, #ff5c87 48%, #e040fb 100%)";
const GRAD_SOFT = "linear-gradient(135deg, rgba(255,122,24,0.12) 0%, rgba(224,64,251,0.1) 100%)";
const GRAD2 = "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)";
const PILL =
  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold";
const CARD_SHELL =
  "rounded-[1.25rem] bg-white dark:bg-gray-950 shadow-[0_4px_24px_rgba(15,23,42,0.06)] border border-gray-100/90 dark:border-gray-800";
const CARD_HEADER_ROW = "flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800";

const goalsOptions = [
  { value: "reduce-stress", label: "Reduce Stress", emoji: "🧘" },
  { value: "manage-anxiety", label: "Manage Anxiety", emoji: "💭" },
  { value: "improve-sleep", label: "Improve Sleep", emoji: "😴" },
  { value: "boost-mood", label: "Boost Mood", emoji: "✨" },
  { value: "build-confidence", label: "Build Confidence", emoji: "💪" },
  { value: "work-life-balance", label: "Work-Life Balance", emoji: "⚖️" },
  { value: "relationship-support", label: "Relationship Support", emoji: "❤️" },
  { value: "grief-loss", label: "Grief & Loss", emoji: "🕊️" },
];

const triggersOptions = [
  { value: "violence", label: "Violence" },
  { value: "self-harm", label: "Self-harm" },
  { value: "substance-abuse", label: "Substance Abuse" },
  { value: "eating-disorders", label: "Eating Disorders" },
  { value: "trauma", label: "Trauma/PTSD" },
  { value: "none", label: "None of the above" },
];
const pronounsOptions = [
  "she/her",
  "he/him",
  "they/them",
  "she/they",
  "he/they",
  "prefer not to say",
];

const MAX_PHONE_DIGITS = 12;
const countPhoneDigits = (v: string) => (v.match(/\d/g) || []).length;

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\+?[\d\s\-().]+$/.test(v), "Invalid phone")
    .refine((v) => !v || countPhoneDigits(v) <= MAX_PHONE_DIGITS, "Max 12 digits"),
  birthday: z.string().optional(),
  pronouns: z.string().optional(),
  location: z.string().optional(),
  in_therapy: z.string().optional(),
  selected_goals: z.array(z.string()).optional(),
  selected_triggers: z.array(z.string()).optional(),
  emergency_contact_name: z.string().min(2).optional().or(z.literal("")),
  emergency_contact_phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\+?[\d\s\-().]+$/.test(v), "Invalid phone")
    .refine((v) => !v || countPhoneDigits(v) <= MAX_PHONE_DIGITS, "Max 12 digits"),
  emergency_contact_relationship: z.string().optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const toProfileGoals = (value: unknown): string[] => {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string")
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

/* ─── small reusable field wrapper ─── */
function FieldRow({
  icon,
  label,
  editing,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  editing: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl transition-all border ${
        editing
          ? "border-orange-200/80 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900/40"
          : "border-transparent bg-gray-50/80 dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50"
      }`}
    >
      <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm text-gray-500 dark:text-gray-400 ring-1 ring-gray-100 dark:ring-gray-700">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1 font-semibold">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

export function UserProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showVerifiedAlert, setShowVerifiedAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string>("");
  const [resending, setResending] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarEditorImageUrl, setAvatarEditorImageUrl] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [avatarSourceSize, setAvatarSourceSize] = useState<{ width: number; height: number } | null>(null);
  const avatarPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "true") {
      setShowVerifiedAlert(true);
      refreshProfile().catch(() => {});
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, refreshProfile]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema as any),
    defaultValues: {
      name: "", email: "", phone: "", birthday: "", location: "",
      pronouns: "", emergency_contact_name: "", emergency_contact_phone: "",
      emergency_contact_relationship: "", in_therapy: "",
      selected_goals: [], selected_triggers: [],
    },
  });

  const [userStats, setUserStats] = useState({ sessions: 0, checkins: 0, daysActive: 0 });
  const [preferencesData, setPreferencesData] = useState({
    selected_avatar: "", selected_voice: "", selected_environment: "",
  });
  const [rawProfile, setRawProfile] = useState<any | null>(null);
  const avatarPrivacySaveRef = useRef(0);

  useEffect(() => { if (user) loadProfile(); }, [user]);

  const loadProfile = async () => {
    try {
      const profile = await api.getMe();
      setRawProfile(profile);
      form.reset({
        name: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        birthday: profileAgeStorageToDisplayYears(profile.age),
        location: profile.timezone || "",
        pronouns: profile.pronouns || "",
        emergency_contact_name: profile.emergency_contact_name || "",
        emergency_contact_phone: profile.emergency_contact_phone || "",
        emergency_contact_relationship: profile.emergency_contact_relationship || "",
        in_therapy: profile.in_therapy || "Not specified",
        selected_goals: Array.isArray(profile.selected_goals)
          ? profile.selected_goals
          : typeof profile.selected_goals === "string"
          ? profile.selected_goals.split(",").map((s: string) => s.trim())
          : [],
        selected_triggers: Array.isArray(profile.selected_triggers)
          ? profile.selected_triggers
          : typeof profile.selected_triggers === "string"
          ? profile.selected_triggers.split(",").map((s: string) => s.trim())
          : [],
      });
      setPreferencesData({
        selected_avatar: profile.selected_avatar || "Default Avatar",
        selected_voice: profile.selected_voice || "Default Voice",
        selected_environment: profile.selected_environment || "Default Environment",
      });
      setProfileImage(profile.avatar_url);
      if (profile.created_at)
        setJoinedAt(new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short" }));
      if (profile.stats) {
        setUserStats({ sessions: profile.stats.completed_sessions || 0, checkins: profile.stats.total_checkins || 0, daysActive: profile.stats.streak_days || 0 });
      } else {
        setUserStats({ sessions: 0, checkins: 0, daysActive: profile.streak_days || 0 });
      }
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const watchedValues = form.watch();

  const profileCompletion = useMemo(() => {
    const values = watchedValues as ProfileFormValues;
    const fields: { key: keyof ProfileFormValues; label: string; type?: "string" | "array"; treatNotSpecifiedAsEmpty?: boolean }[] = [
      { key: "name", label: "Name", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "birthday", label: "Birthday", type: "string" },
      { key: "location", label: "Location", type: "string" },
      { key: "pronouns", label: "Pronouns", type: "string" },
      { key: "in_therapy", label: "In therapy", type: "string", treatNotSpecifiedAsEmpty: true },
      { key: "emergency_contact_name", label: "Emergency contact name", type: "string" },
      { key: "emergency_contact_phone", label: "Emergency contact phone", type: "string" },
      { key: "emergency_contact_relationship", label: "Emergency contact relationship", type: "string" },
      { key: "selected_goals", label: "Wellness goals", type: "array" },
      { key: "selected_triggers", label: "Content triggers", type: "array" },
    ];
    let completed = 0;
    const missingFields: { label: string; key: string }[] = [];
    fields.forEach((f) => {
      const value = values[f.key] as any;
      let filled = false;
      if (f.type === "array") filled = Array.isArray(value) && value.length > 0;
      else {
        const str = (value ?? "").toString().trim();
        filled = f.treatNotSpecifiedAsEmpty && str.toLowerCase() === "not specified" ? false : str.length > 0;
      }
      if (filled) completed++;
      else missingFields.push({ label: f.label, key: f.key as string });
    });
    const percent = Math.round((completed / fields.length) * 100);
    return { percent, missingFields, isComplete: percent === 100 };
  }, [watchedValues]);

  const milestones = useMemo(() => {
    const { sessions, checkins, daysActive: streak } = userStats;
    return [
      { id: "join", label: "Joined MeetEzri", unlocked: Boolean(rawProfile?.created_at) },
      { id: "onboarding", label: "Completed onboarding", unlocked: Boolean(rawProfile?.onboarding_completed) },
      { id: "first-session", label: "First session completed", unlocked: sessions >= 1 },
      { id: "sessions-5", label: "5 sessions completed", unlocked: sessions >= 5 },
      { id: "sessions-10", label: "10 sessions completed", unlocked: sessions >= 10 },
      { id: "checkins-10", label: "10 mood check-ins", unlocked: checkins >= 10 },
      { id: "streak-7", label: "7-day activity streak", unlocked: streak >= 7 },
      { id: "profile-full", label: "Profile fully complete", unlocked: profileCompletion.isComplete },
    ];
  }, [rawProfile, userStats, profileCompletion.isComplete]);

  const joiningDetails = useMemo(() => {
    const created = rawProfile?.created_at as string | undefined;
    if (!created) return { joinDateLabel: "—", tenureLabel: "", onboardingDoneLabel: null as string | null, planLabel: "—" };
    try {
      const d = parseISO(created);
      const days = differenceInCalendarDays(new Date(), d);
      const obAt = rawProfile?.onboarding_completed_at as string | undefined;
      let onboardingDoneLabel: string | null = null;
      if (obAt) { try { onboardingDoneLabel = format(parseISO(obAt), "MMM d, yyyy"); } catch {} }
      return {
        joinDateLabel: format(d, "MMMM d, yyyy"),
        tenureLabel: days >= 0 ? `${days} day${days === 1 ? "" : "s"} with Ezri` : "",
        onboardingDoneLabel,
        planLabel: typeof rawProfile?.subscription_plan === "string" ? rawProfile.subscription_plan : "trial",
      };
    } catch { return { joinDateLabel: joinedAt || "—", tenureLabel: "", onboardingDoneLabel: null, planLabel: "—" }; }
  }, [rawProfile, joinedAt]);

  const scrollToProfileField = (key: string) => {
    document.getElementById(`profile-field-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const communityAvatarPublic =
    (rawProfile?.privacy_settings as { showAvatarInCommunity?: boolean } | undefined)?.showAvatarInCommunity !== false;

  const handleCommunityAvatarToggle = async (nextPublic: boolean) => {
    const saveId = ++avatarPrivacySaveRef.current;
    const prevPrivacy = rawProfile?.privacy_settings;
    const nextPrivacy = { ...(rawProfile?.privacy_settings && typeof rawProfile.privacy_settings === "object" ? rawProfile.privacy_settings : {}), showAvatarInCommunity: nextPublic };
    setRawProfile((p: any) => p ? { ...p, privacy_settings: nextPrivacy } : p);
    try {
      const updated = await api.updateProfile({ privacy_settings: nextPrivacy });
      if (avatarPrivacySaveRef.current !== saveId) return;
      if (updated && typeof updated === "object") setRawProfile(updated);
      void refreshProfile();
      toast.success(nextPublic ? "Photo visible in community" : "Photo hidden from community");
    } catch (err: any) {
      if (avatarPrivacySaveRef.current !== saveId) return;
      setRawProfile((p: any) => p ? { ...p, privacy_settings: prevPrivacy } : p);
      toast.error(err instanceof Error ? err.message : "Could not update visibility");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : null;
      if (!imageUrl) return;
      const img = new Image();
      img.onload = () => {
        setAvatarSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
        setAvatarEditorImageUrl(imageUrl);
        setAvatarZoom(1);
        setAvatarOffsetX(0);
        setAvatarOffsetY(0);
        setAvatarEditorOpen(true);
      };
      img.src = imageUrl;
    };
    reader.readAsDataURL(file);
    // Allow selecting the same file again.
    e.target.value = "";
  };

  useEffect(() => {
    if (!avatarEditorOpen || !avatarEditorImageUrl || !avatarSourceSize || !avatarPreviewCanvasRef.current) return;
    const canvas = avatarPreviewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const { width, height } = avatarSourceSize;
      const baseCrop = Math.min(width, height);
      const cropSize = baseCrop / avatarZoom;
      const maxShiftX = Math.max(0, (width - cropSize) / 2);
      const maxShiftY = Math.max(0, (height - cropSize) / 2);
      const centerX = width / 2 + avatarOffsetX * maxShiftX;
      const centerY = height / 2 + avatarOffsetY * maxShiftY;
      const sx = Math.min(Math.max(0, centerX - cropSize / 2), width - cropSize);
      const sy = Math.min(Math.max(0, centerY - cropSize / 2), height - cropSize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
    };
    img.src = avatarEditorImageUrl;
  }, [avatarEditorOpen, avatarEditorImageUrl, avatarSourceSize, avatarZoom, avatarOffsetX, avatarOffsetY]);

  const handleAvatarSave = async () => {
    if (!avatarPreviewCanvasRef.current || !user) return;
    setIsUploading(true);
    try {
      const uploadBlob = await new Promise<Blob>((resolve, reject) => {
        avatarPreviewCanvasRef.current?.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not prepare image"));
        }, "image/jpeg", 0.92);
      });
      const filePath = `${user.id}/${Math.random()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, uploadBlob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setProfileImage(publicUrl);
      await api.updateProfile({ avatar_url: publicUrl });
      setAvatarEditorOpen(false);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true);
    try {
      const dirty = form.formState.dirtyFields;
      const patch: Record<string, unknown> = {};
      const nextPronouns = (data.pronouns || "").trim();
      const currentPronouns = (rawProfile?.pronouns || "").trim();
      if (dirty.name) patch.full_name = data.name;
      if (dirty.email) patch.email = data.email;
      if (dirty.phone) patch.phone = data.phone;
      if (dirty.birthday) patch.age = data.birthday;
      // Pronouns can be changed via dropdown/custom input; compare values directly
      // so updates do not depend on dirty field tracking quirks.
      if (nextPronouns !== currentPronouns) patch.pronouns = nextPronouns;
      if (dirty.location) patch.timezone = data.location;
      if (dirty.in_therapy) patch.in_therapy = data.in_therapy;
      if (dirty.selected_goals) patch.selected_goals = data.selected_goals || [];
      if (dirty.selected_triggers) patch.selected_triggers = data.selected_triggers || [];
      if (profileImage !== rawProfile?.avatar_url) patch.avatar_url = profileImage;
      if (dirty.emergency_contact_name || dirty.emergency_contact_phone || dirty.emergency_contact_relationship) {
        patch.emergency_contact_name = data.emergency_contact_name || rawProfile?.emergency_contact_name || "";
        patch.emergency_contact_phone = data.emergency_contact_phone || rawProfile?.emergency_contact_phone || "";
        patch.emergency_contact_relationship = data.emergency_contact_relationship || rawProfile?.emergency_contact_relationship || "";
      }
      if (!Object.keys(patch).length) { toast.success("No changes to save"); setIsEditing(false); return; }
      const updated = await api.updateProfile(patch);
      form.reset({
        name: updated.full_name || "", email: updated.email || "", phone: updated.phone || "",
        birthday: profileAgeStorageToDisplayYears(updated.age), pronouns: updated.pronouns || "",
        location: updated.timezone || "", in_therapy: updated.in_therapy || "Not specified",
        selected_goals: toProfileGoals(updated.selected_goals),
        selected_triggers: toProfileGoals(updated.selected_triggers),
        emergency_contact_name: updated.emergency_contact_name || "",
        emergency_contact_phone: updated.emergency_contact_phone || "",
        emergency_contact_relationship: updated.emergency_contact_relationship || "",
      });
      toast.success("Profile updated!");
      setIsEditing(false);
    } catch { toast.error("Failed to update profile"); }
    finally { setIsSaving(false); }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      const signupType = (user as any)?.user_metadata?.signup_type === "trial" ? "trial" : "plan";
      const { emailRedirectTo: redirectTo } = resolveVerificationRedirectForFlow(signupType);
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      toast.success("Verification email sent!");
    } catch (err: any) { toast.error(err.message || "Failed to resend"); }
    finally { setResending(false); }
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to log out?")) return;
    setIsLoggingOut(true);
    try { await signOut(); navigate("/login"); }
    catch { toast.error("Failed to log out"); setIsLoggingOut(false); }
  };

  // Use auth session as source of truth for verification state.
  // Profile patch responses may not include reliable verification flags.
  const effectiveNeedsVerification = !!user && !(user as any).email_confirmed_at;

  /* ─── loading skeleton ─── */
  if (isLoading) {
    return (
      <AppLayout>
        <div className="relative min-h-screen bg-[#eef0f4] dark:bg-[#0c0e12] overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-[2.5rem] bg-gradient-to-br from-orange-400/25 via-pink-400/20 to-fuchsia-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-[2rem] bg-gradient-to-tr from-amber-300/20 to-pink-500/15 blur-3xl" />
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
            <Skeleton className="h-9 w-56 rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-6">
              <div className="space-y-4 min-w-0">
                <Skeleton className="h-72 rounded-[1.25rem]" />
                <Skeleton className="h-40 rounded-[1.25rem]" />
              </div>
              <div className="space-y-4 min-w-0">
                <Skeleton className="h-48 rounded-[1.25rem]" />
                <Skeleton className="h-64 rounded-[1.25rem]" />
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* ─── main render ─── */
  return (
    <AppLayout>
      {/* ── page background (dashboard-style) ── */}
      <div className="relative min-h-screen bg-[#eef0f4] dark:bg-[#0c0e12] overflow-hidden">
        <div className="pointer-events-none absolute -top-28 -right-20 h-[28rem] w-[28rem] rounded-[3rem] bg-gradient-to-bl from-orange-400/30 via-pink-400/15 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -left-24 h-80 w-80 rounded-[2.5rem] bg-gradient-to-tr from-fuchsia-500/12 to-amber-300/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-96 rounded-full bg-gradient-to-t from-pink-400/10 to-transparent blur-3xl" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">

          {/* email verification banner */}
          {effectiveNeedsVerification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 flex items-center justify-between gap-4 px-5 py-4 ${CARD_SHELL} bg-amber-50/90 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-300 text-sm">Verify your email</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">Secure your account and unlock all features.</p>
                </div>
              </div>
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60"
              >
                {resending ? "Sending…" : "Resend link"}
              </button>
            </motion.div>
          )}

          {/* page title */}
          {/* <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 sm:mb-10"
          >
            <div className="inline-flex flex-col gap-2 sm:gap-3 max-w-2xl">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-orange-600/90 dark:text-orange-400/90">
                Account
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900 dark:text-white">
                My Profile
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Welcome back — manage your account, wellness goals, and preferences.
              </p>
            </div>
          </motion.div> */}

          {/* ── main layout: 40% left / 60% right (lg+) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-6">

            {/* LEFT: profile card + prefs */}
            <div className="space-y-5 min-w-0">
              {/* profile card (dashboard-style) */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                <div className={`${CARD_SHELL} overflow-hidden`}>
                  <div className="relative aspect-[4/3] max-h-64 sm:max-h-72 w-full">
                    <div
                      className="absolute inset-0 opacity-40"
                      style={{ background: GRAD }}
                    />
                    <input type="file" id="profile-image-upload" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      onClick={() => !isUploading && document.getElementById("profile-image-upload")?.click()}
                      className="absolute inset-4 sm:inset-6 rounded-2xl overflow-hidden border-4 border-white/90 dark:border-gray-800 shadow-xl cursor-pointer bg-gray-300 dark:bg-gray-700"
                    >
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}
                      {profileImage ? (
                        <img src={profileImage} alt="" className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-800">👤</div>
                      )}
                      <div className="absolute inset-0 bg-black/35 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-10 h-10 text-white drop-shadow-lg" />
                      </div>
                    </motion.div>
                    <button
                      type="button"
                      onClick={() => document.getElementById("profile-image-upload")?.click()}
                      className="absolute bottom-6 right-6 w-10 h-10 rounded-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform ring-2 ring-orange-200/80 dark:ring-orange-900/50"
                      aria-label="Change photo"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">Photo in community</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
                        Show your profile picture to other members
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        id="community-avatar-toggle-profile"
                        checked={communityAvatarPublic}
                        onCheckedChange={handleCommunityAvatarToggle}
                      />
                      <label
                        htmlFor="community-avatar-toggle-profile"
                        className="text-[11px] font-medium text-gray-600 dark:text-gray-300 cursor-pointer select-none whitespace-nowrap"
                      >
                        {communityAvatarPublic ? "Public" : "Hidden"}
                      </label>
                    </div>
                  </div>

                  <div className="px-5 pt-5 pb-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">My profile</h2>
                      <div className="text-right text-[11px] text-gray-400 dark:text-gray-500 leading-tight max-w-[55%]">
                        <p>Member since</p>
                        <p className="font-semibold text-gray-600 dark:text-gray-300">{joinedAt || "—"}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">Plan · {joiningDetails.planLabel}</p>
                      </div>
                    </div>

                    <p className="text-center text-base font-semibold text-gray-900 dark:text-white mb-1">
                      {form.watch("name") || "Your name"}
                    </p>
                    <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-5 line-clamp-2">
                      {form.watch("email") || user?.email || ""}
                    </p>

                    <div className="flex justify-center gap-4 sm:gap-6 py-4 rounded-2xl bg-gray-50/90 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                      {[
                        { label: "Sessions", value: userStats.sessions },
                        { label: "Check-ins", value: userStats.checkins },
                        { label: "Days", value: userStats.daysActive },
                      ].map((s) => (
                        <div key={s.label} className="flex flex-col items-center min-w-[3.5rem]">
                          <span className="text-xl font-black bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent tabular-nums">
                            {s.value}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">{s.label}</span>
                        </div>
                      ))}
                    </div>

                    {!profileCompletion.isComplete && (
                      <div
                        className="mt-4 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3"
                        style={{ background: GRAD_SOFT }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm"
                              style={{ background: GRAD }}
                            >
                              <Activity className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Profile progress</p>
                              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                {profileCompletion.percent}% complete
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-white/70 dark:bg-gray-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${profileCompletion.percent}%`, background: GRAD }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {profileCompletion.missingFields.slice(0, 5).map((f) => (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => scrollToProfileField(f.key)}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 dark:bg-gray-900/60 text-orange-600 dark:text-orange-400 border border-orange-200/80 dark:border-orange-800 hover:bg-white dark:hover:bg-gray-800 transition-colors"
                            >
                              {f.label}
                            </button>
                          ))}
                          {profileCompletion.missingFields.length > 5 && (
                            <span className="text-[10px] text-gray-400 self-center">
                              +{profileCompletion.missingFields.length - 5} more
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => scrollToProfileField(profileCompletion.missingFields[0]?.key || "name")}
                          className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline w-full text-left"
                        >
                          Finish profile →
                        </button>
                      </div>
                    )}

                    <div className="mt-6">
                      {isEditing ? (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            type="button"
                            onClick={form.handleSubmit(onSubmit)}
                            disabled={isSaving}
                            className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-opacity hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2"
                            style={{ background: GRAD }}
                          >
                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save changes
                          </button>
                          <button
                            type="button"
                            onClick={() => { setIsEditing(false); loadProfile(); }}
                            disabled={isSaving}
                            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          className="w-full py-3.5 rounded-2xl text-sm font-bold text-white shadow-md transition-opacity hover:opacity-95 flex items-center justify-center gap-2"
                          style={{ background: GRAD }}
                        >
                          <Edit className="w-4 h-4" /> Edit profile
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* session preferences */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <div className={`${CARD_SHELL} p-5`}>
                  <p className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-4">Session preferences</p>
                  <div className="space-y-2">
                    {[
                      { icon: <Volume2 className="w-4 h-4" />, title: "Voice", value: preferencesData.selected_voice || "Not set", link: "/app/session-lobby?customize=voice" },
                      { icon: <User className="w-4 h-4" />, title: "Avatar", value: preferencesData.selected_avatar || "Not set", link: "/app/settings/change-avatar" },
                      { icon: <Palette className="w-4 h-4" />, title: "Environment", value: preferencesData.selected_environment || "Not set", link: "/app/session-lobby?customize=environment" },
                    ].map((p, i) => (
                      <Link key={i} to={p.link}>
                        <motion.div
                          whileHover={{ x: 3 }}
                          className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group cursor-pointer"
                        >
                          <span className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800 group-hover:text-white group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:via-pink-500 group-hover:to-fuchsia-500 flex items-center justify-center text-gray-500 transition-colors">
                            {p.icon}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">{p.title}</p>
                            <p className="text-xs text-gray-400">{p.value}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                        </motion.div>
                      </Link>
                    ))}
                  </div>
                </div>
              </motion.div>
              <Dialog open={avatarEditorOpen} onOpenChange={setAvatarEditorOpen}>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Adjust profile photo</DialogTitle>
                    <DialogDescription>Crop and zoom your image before saving.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="mx-auto w-full max-w-[22rem] rounded-2xl border border-gray-200 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-900">
                      <canvas
                        ref={avatarPreviewCanvasRef}
                        width={640}
                        height={640}
                        className="w-full rounded-xl bg-gray-200 dark:bg-gray-800"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Zoom ({avatarZoom.toFixed(1)}x)
                        <input
                          type="range"
                          min={1}
                          max={3}
                          step={0.1}
                          value={avatarZoom}
                          onChange={(e) => setAvatarZoom(Number(e.target.value))}
                          className="mt-1 w-full"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Position left/right
                        <input
                          type="range"
                          min={-1}
                          max={1}
                          step={0.01}
                          value={avatarOffsetX}
                          onChange={(e) => setAvatarOffsetX(Number(e.target.value))}
                          className="mt-1 w-full"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Position up/down
                        <input
                          type="range"
                          min={-1}
                          max={1}
                          step={0.01}
                          value={avatarOffsetY}
                          onChange={(e) => setAvatarOffsetY(Number(e.target.value))}
                          className="mt-1 w-full"
                        />
                      </label>
                    </div>
                  </div>
                  <DialogFooter>
                    <button
                      type="button"
                      onClick={() => setAvatarEditorOpen(false)}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAvatarSave}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                      style={{ background: GRAD }}
                    >
                      {isUploading ? "Saving..." : "Save photo"}
                    </button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* account settings */}
              {[
                {
                  title: "Account",
                  items: [
                    { icon: <Bell className="w-4 h-4" />, label: "Notifications", link: "/app/settings/notifications" },
                    { icon: <Lock className="w-4 h-4" />, label: "Privacy & Security", link: "/app/settings/privacy" },
                    { icon: <Shield className="w-4 h-4" />, label: "Data & Permissions", link: "/app/settings/privacy" },
                  ],
                },
                {
                  title: "Support",
                  items: [
                    { icon: <Heart className="w-4 h-4" />, label: "Emergency Contacts", link: "/app/settings/emergency-contacts" },
                    { icon: <Mail className="w-4 h-4" />, label: "Contact Support", link: "/app/settings/help-support" },
                    { icon: <Shield className="w-4 h-4" />, label: "Safety Plan", link: "/app/settings/safety-plan" },
                  ],
                },
              ].map((section, si) => (
                <motion.div
                  key={si}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + si * 0.05 }}
                >
                  <div className={`${CARD_SHELL} p-5`}>
                    <p className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-3">{section.title}</p>
                    <div className="space-y-1">
                      {section.items.map((item, ii) => (
                        <Link key={ii} to={item.link}>
                          <motion.div
                            whileHover={{ x: 3 }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group cursor-pointer"
                          >
                            <span className="text-gray-400 group-hover:text-orange-500 transition-colors">{item.icon}</span>
                            <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                          </motion.div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* danger zone */}
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                <div className={`${CARD_SHELL} border-red-100 dark:border-red-900/30 p-5`}>
                  <p className="text-xs uppercase tracking-widest font-bold text-red-400 mb-3">Danger Zone</p>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors group disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      {isLoggingOut
                        ? <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                        : <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-600" />}
                      <div className="text-left">
                        <p className="text-sm font-bold text-red-500">{isLoggingOut ? "Logging out…" : "Log Out"}</p>
                        <p className="text-[10px] text-red-300">End your current session</p>
                      </div>
                    </div>
                    {!isLoggingOut && <ChevronRight className="w-4 h-4 text-red-300 group-hover:text-red-500" />}
                  </button>
                </div>
              </motion.div>
            </div>

            {/* RIGHT: main form */}
            <div className="space-y-5 min-w-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                  {/* personal info */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <div className={`${CARD_SHELL} transition-all overflow-hidden ${isEditing ? "ring-2 ring-orange-200/60 dark:ring-orange-900/40 border-orange-200/80 dark:border-orange-900/50" : ""}`}>
                      <div className={`${CARD_HEADER_ROW} bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-950/20`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md" style={{ background: GRAD }}>
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Personal information</h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Name, contact &amp; location</p>
                          </div>
                        </div>
                        {isEditing && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-bold px-3 py-1.5 rounded-full text-white shadow-sm" style={{ background: GRAD }}>
                              Editing
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { name: "name" as const, label: "Full Name", icon: <User className="w-3.5 h-3.5" />, placeholder: "Your name" },
                          { name: "email" as const, label: "Email", icon: <Mail className="w-3.5 h-3.5" />, placeholder: "you@email.com" },
                          { name: "birthday" as const, label: "Age", icon: <Calendar className="w-3.5 h-3.5" />, placeholder: "Age", numeric: true },
                          { name: "pronouns" as const, label: "Pronouns", icon: <User className="w-3.5 h-3.5" />, placeholder: "they/them" },
                          { name: "location" as const, label: "Location / Timezone", icon: <MapPin className="w-3.5 h-3.5" />, placeholder: "City, Timezone" },
                        ].map((f) => (
                          <FormField
                            key={f.name}
                            control={form.control}
                            name={f.name}
                            render={({ field }) => (
                              <FormItem id={`profile-field-${f.name}`} className="scroll-mt-24">
                                <FieldRow icon={f.icon} label={f.label} editing={isEditing}>
                                  {isEditing ? (
                                    f.name === "pronouns" ? (
                                      <div className="space-y-2">
                                        <select
                                          value={pronounsOptions.includes((field.value || "").toLowerCase()) ? (field.value || "").toLowerCase() : "__custom__"}
                                          disabled={isSaving}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            if (v === "__custom__") {
                                              field.onChange("");
                                              return;
                                            }
                                            field.onChange(v);
                                          }}
                                          className="w-full text-sm font-semibold bg-transparent outline-none text-gray-900 dark:text-white disabled:opacity-60"
                                        >
                                          <option value="">Select pronouns</option>
                                          {pronounsOptions.map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                          <option value="__custom__">Other (custom)</option>
                                        </select>
                                        {!pronounsOptions.includes((field.value || "").toLowerCase()) && (
                                          <input
                                            value={field.value || ""}
                                            disabled={isSaving}
                                            placeholder="Type custom pronouns"
                                            onChange={(e) => field.onChange(e.target.value)}
                                            className="w-full text-sm font-semibold bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 disabled:opacity-60"
                                          />
                                        )}
                                      </div>
                                    ) : (
                                      <input
                                        {...field}
                                        disabled={isSaving}
                                        placeholder={f.placeholder}
                                        inputMode={f.numeric ? "numeric" : undefined}
                                        onChange={f.numeric ? (e) => field.onChange(e.target.value.replace(/\D/g, "")) : field.onChange}
                                        className="w-full text-sm font-semibold bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 disabled:opacity-60"
                                      />
                                    )
                                  ) : (
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                      {f.numeric && field.value ? `${String(field.value).replace(/\D/g, "")} years old` : field.value || <span className="text-gray-300 dark:text-gray-600 font-normal">Not set</span>}
                                    </p>
                                  )}
                                </FieldRow>
                                <FormMessage className="text-xs mt-0.5 px-1" />
                              </FormItem>
                            )}
                          />
                        ))}

                        {/* phone (special input) */}
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem id="profile-field-phone" className="scroll-mt-24 sm:col-span-2">
                              <FieldRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" editing={isEditing}>
                                {isEditing ? (
                                  <PhoneInput
                                    value={field.value}
                                    onChange={field.onChange}
                                    disabled={isSaving}
                                    placeholder="Phone number"
                                    className="w-full min-w-0"
                                  />
                                ) : (
                                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                    {field.value || <span className="text-gray-300 dark:text-gray-600 font-normal">Not set</span>}
                                  </p>
                                )}
                              </FieldRow>
                              <FormMessage className="text-xs mt-0.5 px-1" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* wellness profile */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <div className={`${CARD_SHELL} overflow-hidden`}>
                      <div className={`${CARD_HEADER_ROW} bg-gradient-to-r from-violet-50/50 to-transparent dark:from-violet-950/20`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md" style={{ background: GRAD2 }}>
                            <Activity className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Wellness profile</h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Goals &amp; content preferences</p>
                          </div>
                        </div>
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-violet-500 shrink-0" />}
                      </div>

                      <div className="p-5 space-y-6">
                        {/* in therapy */}
                        <FormField
                          control={form.control}
                          name="in_therapy"
                          render={({ field }) => (
                            <FormItem id="profile-field-in_therapy" className="scroll-mt-24">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-purple-500" />
                                <FormLabel className="font-bold text-sm text-gray-700 dark:text-gray-300">Professional Companion</FormLabel>
                              </div>
                              <FormControl>
                                {isEditing ? (
                                  <select
                                    {...field}
                                    disabled={isSaving}
                                    className="w-full sm:w-48 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-300"
                                  >
                                    <option value="">Select…</option>
                                    <option>Yes</option>
                                    <option>No</option>
                                    <option>Prefer not to say</option>
                                  </select>
                                ) : (
                                  <span className={`${PILL} bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800`}>
                                    {field.value || "Not specified"}
                                  </span>
                                )}
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {/* goals */}
                        <FormField
                          control={form.control}
                          name="selected_goals"
                          render={({ field }) => (
                            <FormItem id="profile-field-selected_goals" className="scroll-mt-24">
                              <div className="flex items-center gap-2 mb-3">
                                <Target className="w-4 h-4 text-emerald-500" />
                                <FormLabel className="font-bold text-sm text-gray-700 dark:text-gray-300">Wellness Goals</FormLabel>
                              </div>
                              <FormControl>
                                {isEditing ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {goalsOptions.map((g) => {
                                      const selected = (field.value || []).includes(g.value);
                                      return (
                                        <button
                                          key={g.value}
                                          type="button"
                                          disabled={isSaving}
                                          onClick={() => field.onChange(selected ? field.value!.filter((v: string) => v !== g.value) : [...(field.value || []), g.value])}
                                          className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold text-left transition-all border-2 ${selected ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300" : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-emerald-200"}`}
                                        >
                                          <span className="text-base">{g.emoji}</span> {g.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {field.value?.length ? field.value.map((v: string, i: number) => {
                                      const opt = goalsOptions.find(o => o.value === v);
                                      return (
                                        <span key={i} className={`${PILL} bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800`}>
                                          {opt?.emoji} {opt?.label || v}
                                        </span>
                                      );
                                    }) : <p className="text-sm text-gray-400 italic">No goals selected</p>}
                                  </div>
                                )}
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        {/* triggers */}
                        <FormField
                          control={form.control}
                          name="selected_triggers"
                          render={({ field }) => (
                            <FormItem id="profile-field-selected_triggers" className="scroll-mt-24">
                              <div className="flex items-center gap-2 mb-3">
                                <Zap className="w-4 h-4 text-orange-500" />
                                <FormLabel className="font-bold text-sm text-gray-700 dark:text-gray-300">Triggers / Challenges</FormLabel>
                              </div>
                              <FormControl>
                                {isEditing ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {triggersOptions.map((t) => {
                                      const selected = (field.value || []).includes(t.value);
                                      return (
                                        <button
                                          key={t.value}
                                          type="button"
                                          disabled={isSaving}
                                          onClick={() => field.onChange(selected ? field.value!.filter((v: string) => v !== t.value) : [...(field.value || []), t.value])}
                                          className={`px-3 py-2.5 rounded-2xl text-sm font-semibold text-left transition-all border-2 ${selected ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300" : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-orange-200"}`}
                                        >
                                          {t.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {field.value?.length ? field.value.map((v: string, i: number) => {
                                      const opt = triggersOptions.find(o => o.value === v);
                                      return (
                                        <span key={i} className={`${PILL} bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800`}>
                                          {opt?.label || v}
                                        </span>
                                      );
                                    }) : <p className="text-sm text-gray-400 italic">None specified</p>}
                                  </div>
                                )}
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>

                  {/* milestones — directly below wellness profile */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.27 }}
                    className={`overflow-hidden ${CARD_SHELL}`}
                  >
                    <div className="bg-gradient-to-r from-amber-50/80 via-white to-orange-50/40 dark:from-amber-950/25 dark:via-gray-950 dark:to-orange-950/20 px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-widest font-semibold mb-0.5">Progress</p>
                          <h2 className="text-gray-900 dark:text-white font-bold text-lg flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" /> Milestones
                          </h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Track achievements on your MeetEzri journey</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-5 sm:p-6">
                      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
                        {milestones.map((m) => (
                          <li
                            key={m.id}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                              m.unlocked
                                ? "border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                                : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30"
                            }`}
                          >
                            {m.unlocked ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                            )}
                            <span className={m.unlocked ? "text-gray-900 dark:text-gray-100 font-medium" : "text-gray-400"}>
                              {m.label}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>

                  {/* emergency contact */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <div className={`${CARD_SHELL} overflow-hidden border-l-[3px] border-l-pink-500`}>
                      <div className={`${CARD_HEADER_ROW} bg-gradient-to-r from-rose-50/50 to-transparent dark:from-rose-950/20`}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                            <Shield className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Emergency contact</h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Trusted person we can reach if needed</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { name: "emergency_contact_name" as const, label: "Name", placeholder: "Contact name" },
                          { name: "emergency_contact_relationship" as const, label: "Relationship", placeholder: "e.g. Parent" },
                        ].map((f) => (
                          <FormField
                            key={f.name}
                            control={form.control}
                            name={f.name}
                            render={({ field }) => (
                              <FormItem id={`profile-field-${f.name}`} className="scroll-mt-24">
                                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1.5">{f.label}</p>
                                {isEditing ? (
                                  <input
                                    {...field}
                                    disabled={isSaving}
                                    placeholder={f.placeholder}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-red-200 transition-all"
                                  />
                                ) : (
                                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{field.value || <span className="text-gray-300 font-normal">Not set</span>}</p>
                                )}
                                <FormMessage className="text-xs mt-0.5" />
                              </FormItem>
                            )}
                          />
                        ))}
                        <FormField
                          control={form.control}
                          name="emergency_contact_phone"
                          render={({ field }) => (
                            <FormItem id="profile-field-emergency_contact_phone" className="scroll-mt-24">
                              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-1.5">Phone</p>
                              {isEditing ? (
                                <PhoneInput value={field.value} onChange={field.onChange} disabled={isSaving} placeholder="Contact phone" />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{field.value || <span className="text-gray-300 font-normal">Not set</span>}</p>
                                </div>
                              )}
                              <FormMessage className="text-xs mt-0.5" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>

                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>

      {/* verified alert */}
      <AlertDialog open={showVerifiedAlert} onOpenChange={setShowVerifiedAlert}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" /> Email Verified!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your account is now fully active. Complete your profile to personalise your experience.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => { setShowVerifiedAlert(false); setIsEditing(true); }}
              className="rounded-2xl"
              style={{ background: GRAD }}
            >
              Complete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
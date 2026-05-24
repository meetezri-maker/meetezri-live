import { motion } from "motion/react";
import { useNavigate, useLocation } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { type Area } from "react-easy-crop";
import { Shield } from "lucide-react";
import { profileIconCircle, profilePill } from "./profile/profileUi";
import { ProfileSanctuaryLayout } from "./profile/ProfileSanctuaryLayout";
import { useState, useEffect, useMemo, useRef } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  birthIsoToAgeYears,
  isIsoDobString,
  MIN_ACCOUNT_AGE_YEARS,
  minAccountAgeMessage,
  profileAgeStorageToDisplayYears,
} from "@/lib/profileAge";
import { resolveVerificationRedirectForFlow } from "@/lib/verificationRedirect";
import {
  resetAppMainScrollAfterProfileEdit,
  scrollElementInAppMain,
} from "@/lib/scrollAppMain";
import { Skeleton } from "../../components/ui/skeleton";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";

const GRAD =
  "linear-gradient(135deg, #7c3aed 0%, #c026d3 48%, #a855f7 100%)";
const AVATAR_EXPORT_WIDTH = 1200;
const AVATAR_EXPORT_HEIGHT = 900;
type CropArea = { x: number; y: number; width: number; height: number };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const getCroppedAvatarBlob = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  canvas.width = AVATAR_EXPORT_WIDTH;
  canvas.height = AVATAR_EXPORT_HEIGHT;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not export cropped image"));
    }, "image/jpeg", 0.92);
  });
};

const toCropArea = (value: unknown): CropArea | null => {
  if (!value || typeof value !== "object") return null;
  const maybe = value as Partial<CropArea>;
  const { x, y, width, height } = maybe;
  if ([x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return { x: x as number, y: y as number, width: width as number, height: height as number };
  }
  return null;
};
const PILL = profilePill;

import { wellnessGoalProfileOptions } from "@/lib/wellnessGoals";

const goalsOptions = wellnessGoalProfileOptions;

const triggersOptions = [
  { value: "crowds", label: "Crowds" },
  { value: "procrastination", label: "Procrastination" },
  { value: "overthinking", label: "Overthinking" },
  { value: "low-energy-days", label: "Low-energy days" },
  { value: "focus-issues", label: "Focus issues" },
  { value: "motivation-dips", label: "Motivation dips" },
  { value: "sleep-routine", label: "Sleep routine" },
  { value: "time-management", label: "Time management" },
  { value: "difficult-conversations", label: "Difficult conversations" },
  { value: "uncertainty", label: "Uncertainty" },
  { value: "workload-pressure", label: "Workload pressure" },
  { value: "decision-making", label: "Decision-making" },
  { value: "distractions", label: "Distractions" },
  { value: "confidence-dips", label: "Confidence dips" },
  { value: "social-situations", label: "Social situations" },
];
const pronounsOptions = [
  "she/her",
  "he/him",
  "they/them",
  "she/they",
  "he/they",
  "prefer not to say",
];
const fallbackTimezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const formatTimezoneOptionLabel = (timezone: string) => {
  const place = timezone.replace(/_/g, " ").replace(/\//g, ", ");
  try {
    const offsetPart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;
    return offsetPart ? `${place} (${offsetPart})` : place;
  } catch {
    return place;
  }
};

const MAX_PHONE_DIGITS = 12;
const countPhoneDigits = (v: string) => (v.match(/\d/g) || []).length;

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\+[\d\s\-().]+$/.test(v), "Select a country from the dropdown first")
    .refine((v) => !v || countPhoneDigits(v) === MAX_PHONE_DIGITS, "Enter exactly 12 digits total (country code + number)"),
  birthday: z
    .string()
    .optional()
    .refine((v) => {
      const trimmed = (v ?? "").trim();
      if (!trimmed) return true;
      if (isIsoDobString(trimmed)) {
        const years = birthIsoToAgeYears(trimmed);
        return years !== undefined && years >= MIN_ACCOUNT_AGE_YEARS;
      }
      const asYears = Number.parseInt(trimmed, 10);
      if (Number.isFinite(asYears)) return asYears >= MIN_ACCOUNT_AGE_YEARS;
      return true;
    }, minAccountAgeMessage),
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
    .refine((v) => !v || /^\+[\d\s\-().]+$/.test(v), "Select a country from the dropdown first")
    .refine((v) => !v || countPhoneDigits(v) === MAX_PHONE_DIGITS, "Enter exactly 12 digits total (country code + number)"),
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
  iconTone = "violet",
}: {
  icon: React.ReactNode;
  label: string;
  editing: boolean;
  children: React.ReactNode;
  iconTone?: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald";
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition-all ${
        editing
          ? "border-violet-400/30 bg-violet-500/[0.08]"
          : "border-white/[0.06] bg-white/[0.03] hover:border-violet-400/20 hover:bg-violet-500/[0.04]"
      }`}
    >
      <span className={profileIconCircle(iconTone)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
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
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarInitialCropArea, setAvatarInitialCropArea] = useState<CropArea | null>(null);
  const [avatarCroppedAreaPercentages, setAvatarCroppedAreaPercentages] = useState<CropArea | null>(null);
  const [avatarCroppedAreaPixels, setAvatarCroppedAreaPixels] = useState<Area | null>(null);
  const [avatarSourceSize, setAvatarSourceSize] = useState<{ width: number; height: number } | null>(null);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [emergencyInfoOpen, setEmergencyInfoOpen] = useState(false);
  const [emergencyConsentChecked, setEmergencyConsentChecked] = useState(false);
  const availableTimezones = useMemo<string[]>(() => {
    try {
      const list = ((Intl as any).supportedValuesOf?.("timeZone") || []) as string[];
      return list.length ? list : fallbackTimezones;
    } catch {
      return fallbackTimezones;
    }
  }, []);

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
        birthday: isIsoDobString(profile.age ?? "")
          ? profile.age!.trim()
          : profileAgeStorageToDisplayYears(profile.age),
        location: profile.timezone || getBrowserTimezone(),
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
      { id: "join", label: "Joined Solace", unlocked: Boolean(rawProfile?.created_at) },
      { id: "onboarding", label: "Completed onboarding", unlocked: Boolean(rawProfile?.onboarding_completed) },
      { id: "first-talk", label: "First Talk completed", unlocked: sessions >= 1 },
      { id: "talks-5", label: "5 Talks completed", unlocked: sessions >= 5 },
      { id: "talks-10", label: "10 Talks completed", unlocked: sessions >= 10 },
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
        tenureLabel: days >= 0 ? `${days} day${days === 1 ? "" : "s"} with Solace` : "",
        onboardingDoneLabel,
        planLabel: typeof rawProfile?.subscription_plan === "string" ? rawProfile.subscription_plan : "trial",
      };
    } catch { return { joinDateLabel: joinedAt || "—", tenureLabel: "", onboardingDoneLabel: null, planLabel: "—" }; }
  }, [rawProfile, joinedAt]);

  const scrollToProfileField = (key: string) => {
    const el = document.getElementById(`profile-field-${key}`);
    if (el) scrollElementInAppMain(el);
  };

  const communityAvatarPublic =
    (rawProfile?.privacy_settings as { showAvatarInCommunity?: boolean } | undefined)?.showAvatarInCommunity !== false;
  const avatarOriginalUrl =
    (rawProfile?.privacy_settings as { avatarOriginalUrl?: string } | undefined)?.avatarOriginalUrl || null;
  const avatarSavedCropArea = toCropArea(
    (rawProfile?.privacy_settings as { avatarCropAreaPercentages?: unknown } | undefined)?.avatarCropAreaPercentages
  );

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
        setAvatarCrop({ x: 0, y: 0 });
        setAvatarZoom(1);
        setAvatarInitialCropArea(null);
        setAvatarCroppedAreaPercentages(null);
        setAvatarCroppedAreaPixels(null);
        setAvatarEditorOpen(true);
      };
      img.src = imageUrl;
    };
    reader.readAsDataURL(file);
    // Allow selecting the same file again.
    e.target.value = "";
  };

  const handleOpenExistingAvatarEditor = async () => {
    const sourceForEdit = avatarOriginalUrl || profileImage;
    if (!sourceForEdit) {
      document.getElementById("profile-image-upload")?.click();
      return;
    }
    try {
      let editableUrl = sourceForEdit;
      // Convert remote image to data URL so canvas export remains reliable.
      if (!sourceForEdit.startsWith("data:")) {
        const resp = await fetch(sourceForEdit);
        const blob = await resp.blob();
        editableUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : "");
          fr.onerror = () => reject(new Error("Could not load image"));
          fr.readAsDataURL(blob);
        });
      }
      const img = new Image();
      img.onload = () => {
        setAvatarSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
        setAvatarEditorImageUrl(editableUrl);
        setAvatarCrop({ x: 0, y: 0 });
        setAvatarZoom(1);
        setAvatarInitialCropArea(avatarSavedCropArea);
        setAvatarCroppedAreaPercentages(avatarSavedCropArea);
        setAvatarCroppedAreaPixels(null);
        setAvatarEditorOpen(true);
      };
      img.src = editableUrl;
    } catch {
      toast.error("Could not open current photo for editing");
    }
  };

  const handleAvatarSave = async () => {
    if (!avatarEditorImageUrl || !avatarCroppedAreaPixels || !user) return;
    setIsUploading(true);
    try {
      const uploadBlob = await getCroppedAvatarBlob(avatarEditorImageUrl, avatarCroppedAreaPixels);
      const originalBlob = await fetch(avatarEditorImageUrl).then((r) => r.blob());
      const filePath = `${user.id}/${Math.random()}.jpg`;
      const originalPath = `${user.id}/original-${Math.random()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, uploadBlob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { error: originalUploadError } = await supabase.storage
        .from("avatars")
        .upload(originalPath, originalBlob, { contentType: originalBlob.type || "image/jpeg", upsert: true });
      if (originalUploadError) throw originalUploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const { data: { publicUrl: originalUrl } } = supabase.storage.from("avatars").getPublicUrl(originalPath);
      setProfileImage(publicUrl);
      const nextPrivacy = {
        ...(rawProfile?.privacy_settings && typeof rawProfile.privacy_settings === "object" ? rawProfile.privacy_settings : {}),
        avatarOriginalUrl: originalUrl,
        avatarCropAreaPercentages: avatarCroppedAreaPercentages || avatarSavedCropArea || undefined,
      };
      const updated = await api.updateProfile({ avatar_url: publicUrl, privacy_settings: nextPrivacy });
      if (updated && typeof updated === "object") setRawProfile(updated);
      await refreshProfile();
      setAvatarEditorOpen(false);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!isEditing || !rawProfile) return;
    // Ensure emergency contact fields are hydrated immediately when entering edit mode.
    form.setValue("emergency_contact_name", rawProfile.emergency_contact_name || "", { shouldDirty: false });
    form.setValue("emergency_contact_relationship", rawProfile.emergency_contact_relationship || "", { shouldDirty: false });
    form.setValue("emergency_contact_phone", rawProfile.emergency_contact_phone || "", { shouldDirty: false });
    const hasExistingEmergencyContact = Boolean(
      rawProfile.emergency_contact_name || rawProfile.emergency_contact_phone || rawProfile.emergency_contact_relationship
    );
    setEmergencyConsentChecked(hasExistingEmergencyContact);
  }, [isEditing, rawProfile, form]);

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true);
    try {
      const hasEmergencyContactInput = Boolean(
        data.emergency_contact_name?.trim() ||
        data.emergency_contact_phone?.trim() ||
        data.emergency_contact_relationship?.trim()
      );
      if (hasEmergencyContactInput && !emergencyConsentChecked) {
        toast.error("Please confirm emergency contact consent before saving");
        scrollToProfileField("emergency_contact_name");
        setIsSaving(false);
        return;
      }
      const dirty = form.formState.dirtyFields;
      const patch: Record<string, unknown> = {};
      const nextPronouns = (data.pronouns || "").trim();
      const currentPronouns = (rawProfile?.pronouns || "").trim();
      if (dirty.name) patch.full_name = data.name;
      if (dirty.email) patch.email = data.email;
      if (dirty.phone) patch.phone = data.phone;
      if (dirty.birthday) {
        patch.age = (data.birthday ?? "").trim();
      }
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
      setRawProfile(updated);
      form.reset({
        name: updated.full_name || "", email: updated.email || "", phone: updated.phone || "",
        birthday: isIsoDobString(updated.age ?? "")
          ? updated.age!.trim()
          : profileAgeStorageToDisplayYears(updated.age),
        pronouns: updated.pronouns || "",
        location: updated.timezone || "", in_therapy: updated.in_therapy || "Not specified",
        selected_goals: toProfileGoals(updated.selected_goals),
        selected_triggers: toProfileGoals(updated.selected_triggers),
        emergency_contact_name: updated.emergency_contact_name || "",
        emergency_contact_phone: updated.emergency_contact_phone || "",
        emergency_contact_relationship: updated.emergency_contact_relationship || "",
      });
      toast.success("Profile updated!");
      setIsEditing(false);
      requestAnimationFrame(() => {
        resetAppMainScrollAfterProfileEdit();
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      const isAgeError =
        /must be at least\s*18/i.test(message) ||
        /18\+/i.test(message) ||
        /18\s*years/i.test(message);
      if (isAgeError) {
        form.setError("birthday", { type: "manual", message });
        scrollToProfileField("birthday");
      } else {
        toast.error(message || "Failed to update profile");
      }
    } finally { setIsSaving(false); }
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
  const isTrialUser =
    (rawProfile as any)?.signup_type === "trial" ||
    (rawProfile as any)?.subscription_plan === "trial" ||
    (user as any)?.user_metadata?.signup_type === "trial";
  const showTrialIncompleteBanner = isTrialUser && !profileCompletion.isComplete;

  const personalBio = typeof rawProfile?.bio === "string" ? rawProfile.bio : null;

  /* ─── loading skeleton ─── */
  if (isLoading) {
    return (
      <motion.div className="relative min-h-full overflow-hidden pb-10">
        <div className="relative z-10 w-full max-w-[1600px] space-y-6 px-1 sm:px-2">
          <Skeleton className="h-[320px] rounded-[1.25rem] bg-white/5" />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[68%_32%]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Skeleton className="h-48 rounded-[1.25rem] bg-white/5" />
                <Skeleton className="h-48 rounded-[1.25rem] bg-white/5" />
              </div>
              <Skeleton className="h-56 rounded-[1.25rem] bg-white/5" />
              <Skeleton className="h-40 rounded-[1.25rem] bg-white/5" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-72 rounded-[1.25rem] bg-white/5" />
              <Skeleton className="h-56 rounded-[1.25rem] bg-white/5" />
              <Skeleton className="h-52 rounded-[1.25rem] bg-white/5" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  /* ─── main render ─── */
  return (
    <>
      <ProfileSanctuaryLayout
        form={form}
        effectiveNeedsVerification={effectiveNeedsVerification}
        showTrialIncompleteBanner={showTrialIncompleteBanner}
        profileCompletion={profileCompletion}
        resending={resending}
        handleResendVerification={handleResendVerification}
        scrollToProfileField={scrollToProfileField}
        setIsEditing={setIsEditing}
        profileImage={profileImage}
        isUploading={isUploading}
        handleImageUpload={handleImageUpload}
        handleOpenExistingAvatarEditor={handleOpenExistingAvatarEditor}
        joinedAt={joinedAt}
        planLabel={joiningDetails.planLabel}
        personalBio={personalBio}
        userStats={userStats}
        communityAvatarPublic={communityAvatarPublic}
        handleCommunityAvatarToggle={handleCommunityAvatarToggle}
        preferencesData={preferencesData}
        milestones={milestones}
        isLoggingOut={isLoggingOut}
        handleLogout={handleLogout}
        isEditing={isEditing}
        isSaving={isSaving}
        onSubmit={onSubmit}
        loadProfile={loadProfile}
        pronounsOptions={pronounsOptions}
        timezoneOpen={timezoneOpen}
        setTimezoneOpen={setTimezoneOpen}
        availableTimezones={availableTimezones}
        formatTimezoneOptionLabel={formatTimezoneOptionLabel}
        goalsOptions={goalsOptions}
        triggersOptions={triggersOptions}
        emergencyInfoOpen={emergencyInfoOpen}
        setEmergencyInfoOpen={setEmergencyInfoOpen}
        emergencyConsentChecked={emergencyConsentChecked}
        setEmergencyConsentChecked={setEmergencyConsentChecked}
        avatarEditorOpen={avatarEditorOpen}
        setAvatarEditorOpen={setAvatarEditorOpen}
        avatarEditorImageUrl={avatarEditorImageUrl}
        avatarCrop={avatarCrop}
        setAvatarCrop={setAvatarCrop}
        avatarZoom={avatarZoom}
        setAvatarZoom={setAvatarZoom}
        avatarInitialCropArea={avatarInitialCropArea}
        avatarCroppedAreaPercentages={avatarCroppedAreaPercentages}
        avatarCroppedAreaPixels={avatarCroppedAreaPixels}
        setAvatarCroppedAreaPercentages={setAvatarCroppedAreaPercentages}
        setAvatarCroppedAreaPixels={setAvatarCroppedAreaPixels}
        avatarSourceSize={avatarSourceSize}
        handleAvatarSave={handleAvatarSave}
        AVATAR_EXPORT_WIDTH={AVATAR_EXPORT_WIDTH}
        AVATAR_EXPORT_HEIGHT={AVATAR_EXPORT_HEIGHT}
        FieldRow={FieldRow}
        PILL={PILL}
        profileAgeStorage={rawProfile?.age ?? null}
      />

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
    </>
  );
}
import { motion } from "motion/react";
import { useNavigate, useLocation } from "react-router-dom";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { type Area } from "react-easy-crop";
import { Loader2, LogOut, Shield } from "lucide-react";
import {
  profileFieldRow,
  profileFieldRowLabel,
  profileIconCircle,
  profilePill,
} from "./profile/profileUi";
import { ProfileSanctuaryLayout } from "./profile/ProfileSanctuaryLayout";
import { ProfileEditModal } from "./profile/ProfileEditModal";
import {
  buildProfileFormDefaults,
  computeProfileCompletion,
  formatTimezoneOptionLabel,
  goalsOptions,
  triggersOptions,
} from "./profile/profileFormMapping";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSafetyConsent } from "@/app/contexts/SafetyContext";
import {
  getPaidOnboardingChecklistStatus,
  isPaidPlanUser,
  type PaidOnboardingStepAction,
} from "@/lib/onboarding/paidOnboardingSteps";

import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { resolveVerificationRedirectForFlow } from "@/lib/verificationRedirect";
import { scrollElementInAppMain } from "@/lib/scrollAppMain";
import { Skeleton } from "../../components/ui/skeleton";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  modalBodyText,
  modalDestructiveButton,
  modalSecondaryButton,
  modalTitle,
} from "@/lib/modalTheme";

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
    <div className={profileFieldRow(editing)}>
      <span className={profileIconCircle(iconTone)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={profileFieldRowLabel}>{label}</p>
        {children}
      </div>
    </div>
  );
}

export function UserProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user, refreshProfile } = useAuth();
  const { consent } = useSafetyConsent();
  /** The one edit surface on this page. */
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editFocusField, setEditFocusField] = useState<string | null>(null);
  const [showVerifiedAlert, setShowVerifiedAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
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
  const [emergencyInfoOpen, setEmergencyInfoOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "true") {
      setShowVerifiedAlert(true);
      refreshProfile().catch(() => {});
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, refreshProfile]);

  const [userStats, setUserStats] = useState({ sessions: 0, checkins: 0, daysActive: 0 });
  const [preferencesData, setPreferencesData] = useState({
    selected_avatar: "", selected_voice: "", selected_environment: "",
  });
  const [rawProfile, setRawProfile] = useState<any | null>(null);
  const avatarPrivacySaveRef = useRef(0);

  useEffect(() => {
    if (user) loadProfile();
  }, [user, location.pathname, location.key]);

  const loadProfile = async () => {
    try {
      const profile = await api.getMe();
      setRawProfile(profile);
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

  /**
   * One mapping feeds the read-only sidebar, the modal's defaults, and the completion metric,
   * so the three can never disagree. Completion now settles on save rather than per keystroke,
   * which is the expected behaviour once editing lives in a modal.
   */
  const profileView = useMemo(
    () => buildProfileFormDefaults(rawProfile, user?.email),
    [rawProfile, user?.email]
  );

  const profileCompletion = useMemo(() => computeProfileCompletion(profileView), [profileView]);

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

  const handleOpenEditModal = useCallback((focusField?: string) => {
    setEditFocusField(focusField ?? null);
    setIsEditOpen(true);
  }, []);

  /**
   * Runs while the modal is still mounted, so the sidebar behind the overlay is already
   * up to date the moment the modal closes.
   */
  const handleProfileSaved = useCallback(
    async (updatedProfile: any) => {
      if (updatedProfile && typeof updatedProfile === "object") {
        // Merge rather than replace: PATCH returns the canonical profile, but merging keeps any
        // page-only key that a future response shape might omit.
        setRawProfile((prev: any) => (prev ? { ...prev, ...updatedProfile } : updatedProfile));
        setProfileImage(updatedProfile.avatar_url ?? null);
      }
      // Clears the client /users/me cache and repopulates AuthContext for nav, greetings, etc.
      await refreshProfile().catch(() => {});
    },
    [refreshProfile]
  );

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

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      setShowLogoutModal(false);
      navigate("/login");
    } catch {
      toast.error("Failed to log out");
      setIsLoggingOut(false);
    }
  };

  // Use auth session as source of truth for verification state.
  // Profile patch responses may not include reliable verification flags.
  const effectiveNeedsVerification = !!user && !(user as any).email_confirmed_at;
  const isTrialUser =
    (rawProfile as any)?.signup_type === "trial" ||
    (rawProfile as any)?.subscription_plan === "trial" ||
    (user as any)?.user_metadata?.signup_type === "trial";
  const showTrialIncompleteBanner = isTrialUser && !profileCompletion.isComplete;

  const paidOnboardingChecklist = useMemo(() => {
    if (!rawProfile || isTrialUser || !isPaidPlanUser(rawProfile)) return null;
    return getPaidOnboardingChecklistStatus(rawProfile, {
      safetyConsentAgreed: consent.agreedToSafetyNotice,
    });
  }, [rawProfile, isTrialUser, consent.agreedToSafetyNotice]);

  const handlePaidOnboardingStepAction = useCallback(
    (action: PaidOnboardingStepAction) => {
      navigate(action.path);
    },
    [navigate],
  );

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
        profileView={profileView}
        effectiveNeedsVerification={effectiveNeedsVerification}
        showTrialIncompleteBanner={showTrialIncompleteBanner}
        paidOnboardingChecklist={paidOnboardingChecklist}
        onPaidOnboardingStepAction={handlePaidOnboardingStepAction}
        profileCompletion={profileCompletion}
        resending={resending}
        handleResendVerification={handleResendVerification}
        onEditProfile={handleOpenEditModal}
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
        formatTimezoneOptionLabel={formatTimezoneOptionLabel}
        goalsOptions={goalsOptions}
        triggersOptions={triggersOptions}
        emergencyInfoOpen={emergencyInfoOpen}
        setEmergencyInfoOpen={setEmergencyInfoOpen}
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

      {/* Mounted only while open, so every opening builds a fresh form from current data. */}
      {isEditOpen && (
        <ProfileEditModal
          open={isEditOpen}
          profile={rawProfile}
          authEmail={user?.email}
          initialFocusField={editFocusField}
          onOpenChange={setIsEditOpen}
          onSaved={handleProfileSaved}
        />
      )}

      <AlertDialog
        open={showLogoutModal}
        onOpenChange={(open) => {
          if (isLoggingOut) return;
          setShowLogoutModal(open);
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="p-6 pb-5">
            <div className="flex items-start gap-4">
              <span className={profileIconCircle("rose")}>
                <LogOut className="h-5 w-5" aria-hidden />
              </span>
              <AlertDialogHeader className="min-w-0 flex-1 gap-1.5 text-left">
                <AlertDialogTitle className={cn(modalTitle, "text-xl")}>
                  Log out?
                </AlertDialogTitle>
                <AlertDialogDescription className={modalBodyText}>
                  Are you sure you want to log out of your account? You can sign back in anytime.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
          </div>
          <AlertDialogFooter className="flex-row justify-end gap-3 border-t border-white/[0.08] bg-black/20 px-6 py-4 sm:justify-end">
            <AlertDialogCancel disabled={isLoggingOut} className={modalSecondaryButton}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              className={modalDestructiveButton}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging out...
                </span>
              ) : (
                "Log Out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              onClick={() => { setShowVerifiedAlert(false); handleOpenEditModal(); }}
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
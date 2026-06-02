import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import Cropper, { type Area } from "react-easy-crop";
import type { LucideIcon } from "lucide-react";
import { 
  User,
  Mail,
  Phone,
  MapPin,
  Camera,
  Key,
  UserX,
  Save,
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronsUpDown,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Lightbulb,
  Lock,
  Heart,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useMemo, useRef } from "react";
import { PasswordStrengthMeter } from "@/app/components/ui/PasswordStrengthMeter";
import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import {
  birthIsoToAgeYears,
  isIsoDobString,
  profileAgeStorageToDateInput,
} from "@/lib/profileAge";
import { PhoneInput } from "@/app/components/ui/phone-input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/app/components/ui/input-otp";
import { normalizeStoredPhoneForInput } from "@/lib/normalizeStoredPhone";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import { SolaceDateOfBirthPicker, SolaceSelect } from "@/app/solace";
import { formatSubscriptionPlanLabel } from "@/app/pages/app/profile/profileUi";
import {
  ACCOUNT_HELP_IMG,
  ACCOUNT_HERO_IMG,
  account2faCard,
  accountAvatarEditBtn,
  accountAvatarHalo,
  accountAvatarRing,
  accountBackLink,
  accountBtnDanger,
  accountBtnEnable,
  accountBtnGhost,
  accountBtnPrimary,
  accountBtnUpload,
  accountDangerCard,
  accountDangerInner,
  accountDropdownCommand,
  accountDropdownCommandEmpty,
  accountDropdownCommandInput,
  accountDropdownCommandItem,
  accountDropdownCommandList,
  accountDropdownPopover,
  accountFooterFine,
  accountFooterMuted,
  accountHelpImage,
  accountHelpOverlay,
  accountHelpOverlayLight,
  accountRailDisplayName,
  accountRailHeading,
  accountRailPlanBadge,
  accountTipDesc,
  accountTipTitle,
  accountHeroCard,
  accountHeroImage,
  accountHeroOverlayLeft,
  accountHeroOverlayTop,
  accountHeroEyebrow,
  accountHeroHeading,
  accountHeroInsetShadow,
  accountHeroLightScrimLayer,
  accountHeroOverlayMoon,
  accountHeroOverlayPurple,
  accountHeroOverlayWarmth,
  accountTextMuted,
  accountTextPrimary,
  accountTextSecondary,
  accountTextSubtle,
  accountIconChip,
  accountInput,
  accountLabel,
  accountLabelWithIcon,
  accountModalBtnCancel,
  accountModalBtnDanger,
  accountModalBtnPrimary,
  accountModalInput,
  accountModalMuted,
  accountModalOverlay,
  accountModalPanel,
  accountModalTitle,
  accountMfaBackLink,
  accountMfaInfoBanner,
  accountMfaMethodDesc,
  accountMfaMethodOption,
  accountMfaMethodTitle,
  accountMfaOtpInput,
  accountMfaSegmentBtn,
  accountOtpSlot,
  accountPageAtmosphere,
  accountPageFogMid,
  accountPageGlowBottom,
  accountPageGlowTop,
  accountPageNoise,
  accountPageSubtitle,
  accountPageTitle,
  accountPageVignette,
  accountPasswordRow,
  accountPhoneButton,
  accountPhoneInput,
  accountRailCard,
  accountRailProfileGlow,
  accountSafeCard,
  accountSaveButton,
  accountSaveButtonContent,
  accountSaveButtonIcon,
  accountSectionCard,
  accountSectionTitle,
  accountSuccessBanner,
  accountTextarea,
  accountTipRow,
  accountTipsList,
} from "@/app/pages/app/account-settings/accountSettingsUi";

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

/** Supabase returns TOTP factors in `data.totp`; some versions also include them in `data.all`. */
function getTotpFactorsFromMfaList(data: { totp?: unknown; all?: unknown } | null | undefined) {
  const fromTotp = Array.isArray(data?.totp) ? data.totp : [];
  const fromAll = Array.isArray(data?.all)
    ? (data.all as { factor_type?: string; id?: string }[]).filter(
        (f) => f?.factor_type === "totp"
      )
    : [];
  const byId = new Map<string, (typeof fromTotp)[number]>();
  for (const f of [...fromTotp, ...fromAll] as { id?: string }[]) {
    if (f?.id) byId.set(f.id, f as (typeof fromTotp)[number]);
  }
  return Array.from(byId.values());
}

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

const PasswordInput = ({ 
  value, 
  onChange, 
  className = "",
  placeholder 
}: { 
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  placeholder?: string;
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.75)]"
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>
    </div>
  );
};

export function AccountSettings() {
  const navigate = useNavigate();
  const { user, profile: authProfile } = useAuth();
  const [loading, setLoading] = useState(() => !authProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    location: "",
    bio: "",
    avatar_url: ""
  });

  const initials = `${profileData.firstName[0] || ""}${profileData.lastName[0] || ""}`.toUpperCase();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarEditorImageUrl, setAvatarEditorImageUrl] = useState<string | null>(null);
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarInitialCropArea, setAvatarInitialCropArea] = useState<CropArea | null>(null);
  const [avatarCroppedAreaPercentages, setAvatarCroppedAreaPercentages] = useState<CropArea | null>(null);
  const [avatarCroppedAreaPixels, setAvatarCroppedAreaPixels] = useState<Area | null>(null);
  const [avatarSourceSize, setAvatarSourceSize] = useState<{ width: number; height: number } | null>(null);
  const [avatarOriginalUrl, setAvatarOriginalUrl] = useState<string>("");
  const [privacySettings, setPrivacySettings] = useState<Record<string, unknown>>({});
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const availableTimezones = useMemo<string[]>(() => {
    try {
      const list = ((Intl as any).supportedValuesOf?.("timeZone") || []) as string[];
      return list.length ? list : fallbackTimezones;
    } catch {
      return fallbackTimezones;
    }
  }, []);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateConfirmation, setDeactivateConfirmation] = useState("");
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  // Password change state
  const [passwordState, setPasswordState] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMfaCode, setPasswordMfaCode] = useState("");

  // 2FA state
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaStep, setMfaStep] = useState<'method' | 'knowledgeSetup' | 'enroll' | 'verify'>('method');
  const [mfaMethod, setMfaMethod] = useState<'authenticator' | 'knowledge' | 'knowledge_email'>('authenticator');
  const [mfaData, setMfaData] = useState<{ id: string; qr_code: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [showDisableAuthenticatorModal, setShowDisableAuthenticatorModal] = useState(false);
  const [disableAuthenticatorCode, setDisableAuthenticatorCode] = useState('');
  const [showDisableKnowledgeModal, setShowDisableKnowledgeModal] = useState(false);
  const [disableKnowledgeCode, setDisableKnowledgeCode] = useState('');
  const [disableKnowledgeUseEmail, setDisableKnowledgeUseEmail] = useState(false);
  const [disableKnowledgeEmailCode, setDisableKnowledgeEmailCode] = useState('');
  const [disableKnowledgeEmailCodeSent, setDisableKnowledgeEmailCodeSent] = useState(false);
  const [disableKnowledgeUsePin, setDisableKnowledgeUsePin] = useState(true);
  const [disableKnowledgeEmailOtpKey, setDisableKnowledgeEmailOtpKey] = useState(0);
  const [knowledge2fa, setKnowledge2fa] = useState<{
    enabled: boolean;
    question: string | null;
    emailCodeEnabled: boolean;
  }>({
    enabled: false,
    question: null,
    emailCodeEnabled: false,
  });
  const [knowledgeSetup, setKnowledgeSetup] = useState({
    pin: '',
    securityQuestion: '',
    securityAnswer: '',
  });
  const genericSecurityQuestions = [
    "What is your favorite book?",
    "What city were you born in?",
    "What was the name of your first school?",
    "What is your favorite teacher's last name?",
    "What is your favorite childhood nickname?",
    "What is the name of your first pet?",
  ];

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setMfaFactors(getTotpFactorsFromMfaList(data));
      const knowledge = (await api.getKnowledgeTwoFactorStatus()) as {
        enabled: boolean;
        question: string | null;
        email_code_enabled?: boolean;
      };
      setKnowledge2fa({
        enabled: knowledge.enabled === true,
        question: knowledge.question || null,
        emailCodeEnabled: knowledge.email_code_enabled === true,
      });
    } catch (error) {
      console.error('Error fetching MFA status:', error);
    }
  };

  const startAuthenticatorEnrollment = async () => {
    try {
      setMfaLoading(true);

      // Clean up any existing TOTP factors to prevent conflicts
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const existingTotp = getTotpFactorsFromMfaList(factors);
      
      if (existingTotp.length > 0) {
        await Promise.all(existingTotp.map(f => supabase.auth.mfa.unenroll({ factorId: f.id })));
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const enrollWithRetry = async (attempt = 0): Promise<any> => {
        try {
          const friendlyName = attempt === 0 ? 'MeetEzri' : `MeetEzri (${attempt})`;
          return await supabase.auth.mfa.enroll({
            factorType: 'totp',
            friendlyName,
          });
        } catch (error: any) {
          if (error?.code === 'mfa_factor_name_conflict' && attempt < 5) {
            return enrollWithRetry(attempt + 1);
          }
          throw error;
        }
      };

      const { data, error } = await enrollWithRetry();

      if (error) throw error;
      
      console.log('MFA Enroll Data:', data);

      setMfaData({
        id: data.id,
        qr_code: data.totp?.qr_code || data.qr_code,
        secret: data.totp?.secret || data.secret
      });
      setMfaStep('enroll');
      setShowMfaModal(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to start MFA enrollment');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleEnrollMfa = async () => {
    setMfaMethod('authenticator');
    setMfaData(null);
    setMfaCode('');
    setMfaStep('method');
    setShowMfaModal(true);
  };

  const handleSetupKnowledgeMfa = async () => {
    try {
      if (!/^\d{4}$/.test(knowledgeSetup.pin)) {
        toast.error('PIN must be exactly 4 digits');
        return;
      }
      if (knowledgeSetup.securityQuestion.trim().length < 6) {
        toast.error('Security question must be at least 6 characters');
        return;
      }
      if (knowledgeSetup.securityAnswer.trim().length < 2) {
        toast.error('Security answer must be at least 2 characters');
        return;
      }
      setMfaLoading(true);
      const setupResult = await api.setupKnowledgeTwoFactor({
        pin: knowledgeSetup.pin,
        securityQuestion: knowledgeSetup.securityQuestion,
        securityAnswer: knowledgeSetup.securityAnswer,
      });
      // Update immediately to avoid any stale status caching delay.
      if (setupResult?.enabled === true) {
        setKnowledge2fa({
          enabled: true,
          question: setupResult?.question ?? knowledgeSetup.securityQuestion,
          emailCodeEnabled: setupResult?.email_code_enabled === true,
        });
      }
      toast.success('Knowledge-based 2FA enabled');
      setShowMfaModal(false);
      setMfaStep('method');
      setKnowledgeSetup({ pin: '', securityQuestion: '', securityAnswer: '' });
      await fetchMfaStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to setup knowledge 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleSetupKnowledgeEmailMfa = async () => {
    try {
      setMfaLoading(true);
      await api.setupKnowledgeTwoFactorEmail();
      toast.success('Email authentication code 2FA enabled');
      setShowMfaModal(false);
      setMfaStep('method');
      // Refresh flags from backend.
      await fetchMfaStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to setup email authentication code 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    try {
      if (!mfaData) return;
      setMfaLoading(true);

      const { data, error } = await supabase.auth.mfa.challenge({
        factorId: mfaData.id,
      });

      if (error) throw error;

      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaData.id,
        challengeId: data.id,
        code: mfaCode,
      });

      if (verifyError) throw verifyError;

      toast.success('Two-Factor Authentication enabled successfully');
      setShowMfaModal(false);
      fetchMfaStatus();
    } catch (error: any) {
      toast.error(error.message || 'Invalid code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    try {
      setMfaLoading(true);
      // This handler is only used as a fallback. We always require verification
      // via the disable modals when knowledge/authenticator 2FA is enabled.
      if (knowledge2fa.enabled) {
        throw new Error('Knowledge-based 2FA must be verified before disabling');
      }
      toast.success('Two-Factor Authentication disabled');
      fetchMfaStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmDisableAuthenticator = async () => {
    if (!/^\d{6}$/.test(disableAuthenticatorCode)) {
      toast.error('Enter a valid 6-digit authenticator code');
      return;
    }

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message || 'Failed to load authenticator factor');
      return;
    }
    const totpFactors = getTotpFactorsFromMfaList(data);
    setMfaFactors(totpFactors);
    const factorId = totpFactors[0]?.id;
    if (!factorId) {
      toast.error('Authenticator factor is not available');
      return;
    }

    try {
      setMfaLoading(true);
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: disableAuthenticatorCode,
      });
      if (verifyError) throw verifyError;

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;

      const knowledge = (await api.getKnowledgeTwoFactorStatus()) as {
        enabled: boolean;
        question: string | null;
      };

      setShowDisableAuthenticatorModal(false);
      setDisableAuthenticatorCode('');

      if (knowledge.enabled === true || knowledge.question) {
      setKnowledge2fa({ enabled: true, question: knowledge.question, emailCodeEnabled: knowledge.email_code_enabled === true });
        setDisableKnowledgeCode('');
        setShowDisableKnowledgeModal(true);
        return;
      }

      setKnowledge2fa({ enabled: false, question: null });
      toast.success('Two-Factor Authentication disabled');
      fetchMfaStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable authenticator');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmDisableKnowledge = async () => {
    if (disableKnowledgeUseEmail) {
      if (!knowledge2fa.emailCodeEnabled) {
        toast.error('Email authentication code is not enabled for your account');
        return;
      }
      if (!/^\d{6}$/.test(disableKnowledgeEmailCode.trim())) {
        toast.error('Enter your 6-digit email authentication code');
        return;
      }
    } else {
      if (disableKnowledgeUsePin) {
        if (!/^\d{4}$/.test(disableKnowledgeCode.trim())) {
          toast.error('Enter your 4-digit PIN');
          return;
        }
      } else {
        if (disableKnowledgeCode.trim().length < 2) {
          toast.error('Enter your security answer');
          return;
        }
      }
    }

    try {
      setMfaLoading(true);
      if (disableKnowledgeUseEmail) {
        await api.verifyKnowledgeTwoFactorLoginCode(disableKnowledgeEmailCode.trim());
      } else {
        // Verification accepts either PIN or security answer (backend checks pin_hash and answer_hash).
        await api.verifyKnowledgeTwoFactor(disableKnowledgeCode.trim());
      }
      await api.disableKnowledgeTwoFactor();

      setShowDisableKnowledgeModal(false);
      setDisableKnowledgeCode('');
      setDisableKnowledgeEmailCode('');
      setDisableKnowledgeEmailCodeSent(false);
      setDisableKnowledgeUseEmail(false);
      toast.success('Knowledge-based 2FA disabled');
      fetchMfaStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable knowledge-based 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleRequestDisableKnowledgeEmailCode = async () => {
    try {
      setMfaLoading(true);
      setDisableKnowledgeEmailCode('');
      setDisableKnowledgeEmailCodeSent(false);
      setDisableKnowledgeEmailOtpKey((k) => k + 1);
      await api.requestKnowledgeTwoFactorLoginCode();
      setDisableKnowledgeEmailCodeSent(true);
      toast.success('Authentication code sent to your email.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send authentication code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableClick = async () => {
    if (mfaLoading) return;
    try {
      // Always use latest factor state before deciding the disable path.
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totpFactors = getTotpFactorsFromMfaList(data);
      setMfaFactors(totpFactors);

      const knowledge = (await api.getKnowledgeTwoFactorStatus()) as {
        enabled: boolean;
        question: string | null;
        email_code_enabled?: boolean;
      };
      setKnowledge2fa({
        enabled: knowledge.enabled === true,
        question: knowledge.question || null,
        emailCodeEnabled: knowledge.email_code_enabled === true,
      });

      if (totpFactors.length > 0) {
        setDisableAuthenticatorCode('');
        setShowDisableAuthenticatorModal(true);
        return;
      }

      if (knowledge.enabled === true || knowledge.question) {
        setDisableKnowledgeCode('');
        setShowDisableKnowledgeModal(true);
        return;
      }

      await handleDisableMfa();
    } catch (error: any) {
      toast.error(error.message || 'Failed to check authenticator status');
    }
  };

  const handleDeactivateAccount = async () => {
    if (deactivateConfirmation !== "DEACTIVATE") return;

    setDeactivateLoading(true);
    try {
      await api.deactivateAccount();
      await supabase.auth.signOut();
      toast.success("Account deactivated", {
        description: "Sign in again anytime and use the activation email to restore access.",
      });
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Failed to deactivate account");
    } finally {
      setDeactivateLoading(false);
      setShowDeactivateModal(false);
      setDeactivateConfirmation("");
    }
  };

  const handlePasswordUpdate = async () => {
    try {
      if (!passwordState.currentPassword || !passwordState.newPassword || !passwordState.confirmPassword) {
        toast.error("Please fill in all fields");
        return;
      }

      if (passwordState.newPassword !== passwordState.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }

      if (passwordState.newPassword.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }

      setPasswordLoading(true);

      // Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: passwordState.currentPassword
      });

      if (signInError) {
        throw new Error("Incorrect current password");
      }

      // If MFA is enabled, verify second factor before sensitive updates.
      if (mfaFactors.length > 0 || knowledge2fa.enabled) {
        if (!passwordMfaCode) {
          throw new Error(
            mfaFactors.length > 0
              ? "Enter your 6-digit authenticator code to update password"
              : "Enter your 2FA PIN or security answer to update password"
          );
        }
        if (mfaFactors.length > 0) {
          if (passwordMfaCode.length !== 6) {
            throw new Error("Enter your 6-digit authenticator code to update password");
          }
          const factorId = mfaFactors[0]?.id;
          if (!factorId) {
            throw new Error("Two-factor factor is not available. Please re-enable 2FA.");
          }
          const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
            factorId,
          });
          if (challengeError) throw challengeError;

          const { error: verifyError } = await supabase.auth.mfa.verify({
            factorId,
            challengeId: challengeData.id,
            code: passwordMfaCode,
          });
          if (verifyError) throw verifyError;
        } else if (knowledge2fa.enabled) {
          await api.verifyKnowledgeTwoFactor(passwordMfaCode);
        }
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordState.newPassword
      });

      if (updateError) {
        throw updateError;
      }

      toast.success("Password updated successfully");
      setShowPasswordModal(false);
      setPasswordState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setPasswordMfaCode("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  useEffect(() => {
    async function hydrate() {
      if (!user) return;

      // Prefer cached profile from AuthContext to avoid refetching on every remount.
      const data = authProfile;
      if (data) {
        try {
          const nameParts = (data.full_name || "").split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          const profileBio =
            typeof (data as { bio?: string | null }).bio === "string" &&
            (data as { bio?: string | null }).bio!.trim().length > 0
              ? (data as { bio?: string | null }).bio!
              : "";
          const legacyBioFromMood =
            !profileBio && typeof data.current_mood === "string" ? data.current_mood : "";

          const nextPrivacy =
            data.privacy_settings && typeof data.privacy_settings === "object"
              ? (data.privacy_settings as Record<string, unknown>)
              : {};

          setProfileData({
            firstName,
            lastName,
            email: data.email || user.email || "",
            phone: normalizeStoredPhoneForInput(data.phone || ""),
            dateOfBirth: profileAgeStorageToDateInput(data.age),
            location: data.timezone || getBrowserTimezone(),
            bio: profileBio || legacyBioFromMood,
            avatar_url: data.avatar_url || "",
          });
          setPrivacySettings(nextPrivacy);
          setAvatarOriginalUrl(
            typeof nextPrivacy.avatarOriginalUrl === "string" ? nextPrivacy.avatarOriginalUrl : ""
          );
          setLoading(false);
        } catch (error) {
          console.error("Failed to hydrate profile from cache:", error);
          setLoading(false);
        }
        return;
      }

      // Fallback: fetch if cache isn't available yet.
      try {
        setLoading(true);
        const fetched = await api.getMe();

        const nameParts = (fetched.full_name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const profileBio =
          typeof (fetched as { bio?: string | null }).bio === "string" &&
          (fetched as { bio?: string | null }).bio!.trim().length > 0
            ? (fetched as { bio?: string | null }).bio!
            : "";
        const legacyBioFromMood =
          !profileBio && typeof fetched.current_mood === "string" ? fetched.current_mood : "";

        const nextPrivacy =
          fetched.privacy_settings && typeof fetched.privacy_settings === "object"
            ? (fetched.privacy_settings as Record<string, unknown>)
            : {};

        setProfileData({
          firstName,
          lastName,
          email: fetched.email || user.email || "",
          phone: normalizeStoredPhoneForInput(fetched.phone || ""),
          dateOfBirth: profileAgeStorageToDateInput(fetched.age),
          location: fetched.timezone || getBrowserTimezone(),
          bio: profileBio || legacyBioFromMood,
          avatar_url: fetched.avatar_url || "",
        });
        setPrivacySettings(nextPrivacy);
        setAvatarOriginalUrl(
          typeof nextPrivacy.avatarOriginalUrl === "string" ? nextPrivacy.avatarOriginalUrl : ""
        );
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    }

    void hydrate();
  }, [user, authProfile]);

const openAvatarEditorFromUrl = (imageUrl: string, initialCropArea: CropArea | null = null) => {
    const img = new Image();
    img.onload = () => {
      setAvatarSourceSize({ width: img.naturalWidth, height: img.naturalHeight });
      setAvatarEditorImageUrl(imageUrl);
      setAvatarCrop({ x: 0, y: 0 });
      setAvatarZoom(1);
      setAvatarInitialCropArea(initialCropArea);
      setAvatarCroppedAreaPercentages(initialCropArea);
      setAvatarCroppedAreaPixels(null);
      setAvatarEditorOpen(true);
    };
    img.src = imageUrl;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = typeof reader.result === "string" ? reader.result : null;
        if (!imageUrl) return;
        openAvatarEditorFromUrl(imageUrl, null);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    } catch (error) {
      console.error('Error preparing avatar:', error);
      toast.error('Error preparing avatar');
    }
  };

  const handleOpenExistingAvatarEditor = async () => {
    const sourceForEdit = avatarOriginalUrl || profileData.avatar_url;
    const savedCropArea = toCropArea(privacySettings.avatarCropAreaPercentages);
    if (!sourceForEdit) {
      fileInputRef.current?.click();
      return;
    }
    try {
      let editableUrl = sourceForEdit;
      if (!editableUrl.startsWith("data:")) {
        const resp = await fetch(editableUrl);
        const blob = await resp.blob();
        editableUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : "");
          fr.onerror = () => reject(new Error("Could not load current image"));
          fr.readAsDataURL(blob);
        });
      }
      openAvatarEditorFromUrl(editableUrl, savedCropArea);
    } catch (error) {
      console.error('Error opening avatar editor:', error);
      toast.error('Could not open current photo for editing');
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
        .from('avatars')
        .upload(filePath, uploadBlob, { contentType: "image/jpeg", upsert: true });

      if (uploadError) throw uploadError;
      const { error: originalUploadError } = await supabase.storage
        .from('avatars')
        .upload(originalPath, originalBlob, { contentType: originalBlob.type || "image/jpeg", upsert: true });
      if (originalUploadError) throw originalUploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatar_url = data.publicUrl;
      const { data: originalData } = supabase.storage.from("avatars").getPublicUrl(originalPath);
      const originalUrl = originalData.publicUrl;
      const nextPrivacy = {
        ...privacySettings,
        avatarOriginalUrl: originalUrl,
        avatarCropAreaPercentages: avatarCroppedAreaPercentages || toCropArea(privacySettings.avatarCropAreaPercentages) || undefined,
      };

      setProfileData(prev => ({ ...prev, avatar_url }));
      setPrivacySettings(nextPrivacy);
      setAvatarOriginalUrl(originalUrl);
      await api.updateProfile({ avatar_url, privacy_settings: nextPrivacy });
      setAvatarEditorOpen(false);
      toast.success("Profile picture updated");
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Error uploading avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setIsRemoving(true);
      setProfileData(prev => ({ ...prev, avatar_url: "" }));
      
      await api.updateProfile({ avatar_url: null });
      
      toast.success("Profile picture removed");
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Error removing avatar');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const full_name = `${profileData.firstName} ${profileData.lastName}`.trim();
      if (full_name.length < 2) {
        toast.error("Please enter at least 2 characters for your name.");
        return;
      }

      const dobIso = profileData.dateOfBirth.trim();
      if (dobIso && !isIsoDobString(dobIso)) {
        toast.error(
          "Please enter a valid date of birth."
        );
        return;
      }
      if (dobIso) {
        const ageYears = birthIsoToAgeYears(dobIso);
        if (ageYears === undefined) {
          toast.error("You must be at least 13 years old.");
          return;
        }
      }

      const patch: Record<string, unknown> = {
        full_name,
        phone: profileData.phone,
        timezone: profileData.location,
        bio: profileData.bio.trim(),
      };
      // Store YYYY-MM-DD in `profiles.age` so the date picker can round-trip after refresh.
      if (dobIso) {
        patch.age = dobIso;
      }

      await api.updateProfile(patch);

      setSaved(true);
      toast.success("Profile updated successfully");
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    `${profileData.firstName} ${profileData.lastName}`.trim() ||
    (typeof authProfile?.full_name === "string" && authProfile.full_name.trim()) ||
    user?.email?.split("@")[0] ||
    "Member";

  const planLabel = formatSubscriptionPlanLabel(
    typeof authProfile?.subscription_plan === "string" ? authProfile.subscription_plan : undefined
  );

  if (loading) {
    return (
      <motion.div className={cn(accountPageAtmosphere, "flex min-h-[50vh] items-center justify-center")}>
        <Loader2 className="h-8 w-8 animate-spin text-violet-400/80" aria-label="Loading account settings" />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={accountPageAtmosphere}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div className={accountPageGlowTop} />
        <motion.div className={accountPageFogMid} />
        <motion.div className={accountPageGlowBottom} />
        <motion.div className={accountPageVignette} />
        <motion.div className={accountPageNoise} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1600px] px-1 sm:px-2">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 px-1 sm:px-2"
        >
          <Link to="/app/settings" className={accountBackLink}>
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Back to Settings
          </Link>
          <h1 className={cn(accountPageTitle, "mt-4")}>Account Settings</h1>
          <p className={accountPageSubtitle}>
            Manage your personal information and account details
          </p>
        </motion.div>

        {saved ? (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(accountSuccessBanner, "mx-1 sm:mx-2")}
            role="status"
          >
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-300/90" aria-hidden />
            <span className="font-medium text-emerald-100/95">Settings saved successfully!</span>
          </motion.div>
        ) : null}

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <motion.div
            className="min-w-0 flex-[7] space-y-6 px-1 sm:px-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >

            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={accountHeroCard}
            >
              <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
                <img
                  src={ACCOUNT_HERO_IMG}
                  alt="Calm moonlit landscape"
                  className={accountHeroImage}
                  width={1600}
                  height={900}
                  loading="eager"
                  decoding="async"
                />
                <div className={accountHeroLightScrimLayer} />
                <div className={accountHeroOverlayLeft} />
                <div className={accountHeroOverlayTop} />
                <div className={accountHeroOverlayPurple} />
                <div className={accountHeroOverlayWarmth} />
                <div className={accountHeroOverlayMoon} />
                <div className={accountHeroInsetShadow} />
              </div>
              <div className="relative z-10 flex min-h-[260px] flex-col justify-center lg:min-h-[280px]">
                <div className="flex flex-1 flex-col justify-center gap-6 p-7 sm:p-9 lg:max-w-[58%]">
                  <p className={accountHeroEyebrow}>Profile picture</p>
                  <motion.div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                    <div className="relative shrink-0">
                      <div className={accountAvatarHalo} aria-hidden />
                      {profileData.avatar_url ? (
                        <motion.img
                          whileHover={{ scale: 1.02 }}
                          src={profileData.avatar_url}
                          alt="Profile"
                          className={cn(accountAvatarRing, "h-28 w-28 sm:h-32 sm:w-32")}
                        />
                      ) : (
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          className={cn(
                            accountAvatarRing,
                            "relative flex h-28 w-28 items-center justify-center bg-gradient-to-br from-violet-600/45 to-fuchsia-600/28 text-3xl font-semibold text-white sm:h-32 sm:w-32"
                          )}
                        >
                          {initials || "?"}
                        </motion.div>
                      )}
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleOpenExistingAvatarEditor}
                        className={accountAvatarEditBtn}
                        aria-label="Edit profile photo"
                      >
                        <Camera className="h-4 w-4 text-violet-300" />
                      </motion.button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className={accountHeroHeading}>Change photo</h2>
                      <p className={cn("mt-1.5", accountTextSecondary)}>
                        Upload a new profile picture (JPG, PNG, max 5MB)
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading || isRemoving}
                          className={cn(accountBtnUpload, "disabled:cursor-not-allowed disabled:opacity-50")}
                        >
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {isUploading ? "Saving..." : "Upload photo"}
                        </motion.button>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleRemovePhoto}
                          disabled={isUploading || isRemoving || !profileData.avatar_url}
                          className={cn(accountBtnGhost, "disabled:cursor-not-allowed disabled:opacity-50")}
                        >
                          {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {isRemoving ? "Removing..." : "Remove"}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.section>

          {avatarEditorOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-zinc-100">Adjust profile photo</h3>
                    <p className="text-sm text-zinc-400">Crop and zoom your image before saving.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAvatarEditorOpen(false)}
                    disabled={isUploading}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative mx-auto w-full max-w-[22rem] rounded-2xl border border-gray-200 dark:border-slate-700 p-2 bg-gray-50 dark:bg-slate-800">
                    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-200 dark:bg-slate-700">
                      {avatarEditorImageUrl && (
                        <Cropper
                          key={`${avatarEditorImageUrl || "none"}-${avatarInitialCropArea ? JSON.stringify(avatarInitialCropArea) : "no-initial-crop"}`}
                          image={avatarEditorImageUrl}
                          crop={avatarCrop}
                          zoom={avatarZoom}
                          aspect={4 / 3}
                          initialCroppedAreaPercentages={avatarInitialCropArea || undefined}
                          onCropChange={setAvatarCrop}
                          onZoomChange={setAvatarZoom}
                          onCropComplete={(croppedAreaPercentages, croppedAreaPixels) => {
                            setAvatarCroppedAreaPercentages(croppedAreaPercentages as CropArea);
                            setAvatarCroppedAreaPixels(croppedAreaPixels);
                          }}
                          showGrid
                        />
                      )}
                    </div>
                    <span className="absolute bottom-4 right-4 rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                      {AVATAR_EXPORT_WIDTH} x {AVATAR_EXPORT_HEIGHT}px
                    </span>
                  </div>
                  {avatarSourceSize && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Original image: {avatarSourceSize.width} x {avatarSourceSize.height}px
                    </p>
                  )}

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
                  <p className="text-xs text-gray-500 dark:text-gray-400">Drag the image to adjust crop area.</p>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setAvatarEditorOpen(false)}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAvatarSave}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold disabled:opacity-60"
                    >
                      {isUploading ? "Saving..." : "Save photo"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className={accountSectionCard}
            >
              <div className="mb-8 flex items-center gap-3">
                <div className={accountIconChip("violet")}>
                  <User className="h-5 w-5" aria-hidden />
                </div>
                <h2 className={accountSectionTitle}>Personal information</h2>
              </div>

              <div className="space-y-7">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className={accountLabel}>
                    <User className="w-4 h-4 inline mr-1" />
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                    className={accountInput}
                  />
                </div>

                <div>
                  <label className={accountLabel}>
                    <User className="w-4 h-4 inline mr-1" />
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                    className={accountInput}
                  />
                </div>
              </div>

              <div>
                <label className={accountLabel}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  className={accountInput}
                />
              </div>

              <div>
                <label className={accountLabel}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone number
                </label>
                <p className={cn("mb-2", accountTextSubtle)}>
                  Country code and number (exactly 12 digits including code).
                </p>
                <PhoneInput
                  value={profileData.phone}
                  onChange={(v) => setProfileData({ ...profileData, phone: v })}
                  placeholder="Your phone number"
                  buttonClassName={accountPhoneButton}
                  inputClassName={accountPhoneInput}
                  popoverClassName={accountDropdownPopover}
                  commandClassName={accountDropdownCommand}
                  commandInputClassName={accountDropdownCommandInput}
                  commandListClassName={accountDropdownCommandList}
                  commandItemClassName={accountDropdownCommandItem}
                  commandEmptyClassName={accountDropdownCommandEmpty}
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <SolaceDateOfBirthPicker
                    id="account-date-of-birth"
                    label="Date of Birth"
                    labelClassName={accountLabelWithIcon}
                    value={profileData.dateOfBirth}
                    onChange={(iso) =>
                      setProfileData({ ...profileData, dateOfBirth: iso })
                    }
                    triggerClassName={accountInput}
                    placeholder="MM/DD/YYYY"
                    minAgeYears={13}
                    showAgeHint
                  />
                </div>

                <div>
                  <label className={accountLabel}>
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </label>
                  <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(accountInput, "flex items-center justify-between")}
                      >
                        <span className="truncate text-left">
                          {profileData.location
                            ? formatTimezoneOptionLabel(profileData.location)
                            : "Select timezone"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className={cn(
                        accountDropdownPopover,
                        "w-[--radix-popover-trigger-width]"
                      )}
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      avoidCollisions
                      collisionPadding={16}
                    >
                      <Command className={accountDropdownCommand}>
                        <CommandInput
                          placeholder="Search timezone or city..."
                          className={accountDropdownCommandInput}
                        />
                        <CommandList className={accountDropdownCommandList}>
                          <CommandEmpty className={accountDropdownCommandEmpty}>
                            No timezone found.
                          </CommandEmpty>
                          <CommandGroup>
                            {availableTimezones.map((timezone) => (
                              <CommandItem
                                key={timezone}
                                className={accountDropdownCommandItem}
                                value={`${timezone} ${formatTimezoneOptionLabel(timezone)}`}
                                onSelect={() => {
                                  setProfileData((prev) => ({ ...prev, location: timezone }));
                                  setTimezoneOpen(false);
                                }}
                              >
                                <Check
                                  className={`h-4 w-4 ${profileData.location === timezone ? "opacity-100" : "opacity-0"}`}
                                />
                                <span className="truncate">{formatTimezoneOptionLabel(timezone)}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <label className={accountLabel}>Bio</label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  rows={5}
                  className={accountTextarea}
                />
              </div>
            </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className={accountSectionCard}
            >
              <div className="mb-8 flex items-center gap-3">
                <div className={accountIconChip("pink")}>
                  <Shield className="h-5 w-5" aria-hidden />
                </div>
                <h2 className={accountSectionTitle}>Security</h2>
              </div>

              <div className="space-y-5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setShowPasswordModal(true)}
                className={cn(accountPasswordRow, "w-full")}
              >
                <div className="flex items-center gap-3">
                  <div className={accountIconChip("violet")}>
                    <Key className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="text-left">
                    <p className={accountTextPrimary}>Change password</p>
                    <p className={accountTextMuted}>
                      {user?.updated_at 
                        ? `Last changed ${formatDistanceToNow(new Date(user.updated_at), { addSuffix: true })}`
                        : 'Never changed'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-violet-300/90">Change</span>
              </motion.button>

              <div className={account2faCard}>
                <div className="relative z-[1] flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className={accountIconChip("violet")}>
                      <Shield className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <p className={accountTextPrimary}>Two-factor authentication</p>
                      <p className={cn("mt-1", accountTextSecondary)}>
                        {mfaFactors.length > 0 || knowledge2fa.enabled
                          ? `Enabled via ${
                              mfaFactors.length > 0 && knowledge2fa.enabled
                                ? 'authenticator app and knowledge factor'
                                : mfaFactors.length > 0
                                  ? 'authenticator app'
                                  : 'password/PIN/security question'
                            }`
                          : 'Add an extra layer of security to your account'}
                      </p>
                      <div className={cn("mt-3 space-y-1.5", accountTextSubtle)}>
                        <p>Available options:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Authenticator app (Google Authenticator/Authy)</li>
                          <li>A password, PIN, or answers to security questions</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  {mfaFactors.length > 0 || knowledge2fa.enabled ? (
                    <button 
                      onClick={handleDisableClick}
                      disabled={mfaLoading}
                      className="shrink-0 text-sm font-semibold text-rose-300/90 hover:text-rose-200 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Disable
                    </button>
                  ) : (
                    <button 
                      onClick={handleEnrollMfa}
                      disabled={mfaLoading}
                      className={accountBtnEnable}
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={accountDangerCard}
            >
              <div className="mb-6 flex items-center gap-3">
                <div className={accountIconChip("rose")}>
                  <AlertCircle className="h-5 w-5" aria-hidden />
                </div>
                <h2 className="font-serif text-[1.35rem] font-light tracking-tight text-rose-100/90 sm:text-[1.45rem]">
                  Danger zone
                </h2>
              </div>

              <div className={accountDangerInner}>
                <div>
                  <p className={accountTextPrimary}>Deactivate account</p>
                  <p className={cn("mt-1", accountTextMuted)}>
                    Pause your account — you can reactivate anytime via email
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeactivateModal(true)}
                  className={accountBtnDanger}
                >
                  <UserX className="h-4 w-4" aria-hidden />
                  Deactivate
                </motion.button>
              </div>
            </motion.section>

            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleSave}
              disabled={saving}
              className={cn(accountSaveButton, "disabled:cursor-not-allowed disabled:opacity-50")}
            >
              <span className={accountSaveButtonContent}>
                {saving ? (
                  <Loader2 className={cn(accountSaveButtonIcon, "animate-spin")} aria-hidden />
                ) : (
                  <Save className={accountSaveButtonIcon} aria-hidden />
                )}
                <span>{saving ? "Saving..." : "Save changes"}</span>
              </span>
            </motion.button>

            <footer className="pb-2 pt-4 text-center">
              <div className={cn("mb-2 flex items-center justify-center gap-2 text-sm", accountFooterMuted)}>
                <Heart className="h-4 w-4 text-fuchsia-400/70" aria-hidden />
                <span>Made with care for your wellbeing</span>
              </div>
              <p className={accountFooterFine}>
                Solace v1.0.0 • © 2026 •{" "}
                <Link to="/privacy" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
                  Privacy
                </Link>{" "}
                •{" "}
                <Link to="/terms" className="underline-offset-2 hover:text-violet-300/80 hover:underline">
                  Terms
                </Link>
              </p>
            </footer>
          </motion.div>

          <aside className="w-full shrink-0 space-y-5 xl:sticky xl:top-4 xl:w-[min(100%,320px)] xl:flex-[3] xl:self-start">
            <div className={cn(accountRailCard, "relative overflow-hidden p-6")}>
              <div className={accountRailProfileGlow} aria-hidden />
              <h2 className={cn("relative", accountRailHeading)}>Your profile</h2>
              <div className="relative mt-5 flex flex-col items-center text-center">
                <div className="relative">
                  <div className={accountAvatarHalo} aria-hidden />
                  {profileData.avatar_url ? (
                    <img
                      src={profileData.avatar_url}
                      alt=""
                      className={cn(accountAvatarRing, "h-16 w-16")}
                    />
                  ) : (
                    <motion.div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500/30 to-cyan-500/15 text-xl font-semibold text-white">
                      {initials || "?"}
                    </motion.div>
                  )}
                </div>
                <p className={accountRailDisplayName}>{displayName}</p>
                <span className={accountRailPlanBadge}>{planLabel}</span>
                <Link to="/app/billing" className={cn(accountBtnPrimary, "mt-4 w-full")}>
                  Manage Plan
                </Link>
              </div>
            </div>

            <div className={cn(accountRailCard, "p-6")}>
              <h2 className={accountRailHeading}>Account tips</h2>
              <ul className={accountTipsList}>
                <AccountTipRow
                  icon={User}
                  tone="violet"
                  title="Keep information updated"
                  description="Accurate details help personalize your sanctuary."
                />
                <AccountTipRow
                  icon={Shield}
                  tone="pink"
                  title="Protect your account with 2FA"
                  description="Add an extra layer of calm security."
                />
                <AccountTipRow
                  icon={Lock}
                  tone="emerald"
                  title="Your data is private"
                  description="We never share your personal wellness data."
                />
              </ul>
            </div>

            <div className={cn(accountRailCard, "relative min-h-[200px] overflow-hidden bg-transparent p-6 before:opacity-35")}>
              <img
                src={ACCOUNT_HELP_IMG}
                alt="Calm mountain landscape at dusk with soft twilight light"
                className={accountHelpImage}
                width={400}
                height={320}
                loading="lazy"
                decoding="async"
              />
              <div className={accountHelpOverlay} aria-hidden />
              <div className={accountHelpOverlayLight} aria-hidden />
              <div className="relative z-10 flex min-h-[152px] flex-col justify-end">
                <h2 className={accountRailHeading}>Need help?</h2>
                <p className={cn("mt-1.5 text-sm", accountTextSecondary)}>We&apos;re here for you</p>
                <Link to="/app/settings/help-support" className={cn(accountBtnPrimary, "relative mt-4 w-full")}>
                  Contact support
                </Link>
              </div>
            </div>

            <div className={accountSafeCard}>
              <div className="flex items-start gap-3">
                <div className={accountIconChip("emerald")}>
                  <Lock className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className={accountRailHeading}>Your data is safe</h2>
                  <p className={cn("mt-2 text-xs leading-relaxed", accountTextMuted)}>
                    We use advanced encryption to keep your information private and secure.
                  </p>
                  <Link
                    to="/app/settings/privacy"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-300 transition hover:text-fuchsia-200"
                  >
                    Learn more
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

          {/* Deactivate Account Modal */}
          {showDeactivateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
              onClick={() => setShowDeactivateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0d14] p-6 shadow-2xl transition-colors duration-300"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-rose-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-rose-400" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-2">Deactivate account?</h3>
                  <p className="text-zinc-400 mb-4">
                    You will be signed out immediately. Your data stays saved. Sign in later and use
                    the activation email to restore access.
                  </p>
                  <input
                    type="text"
                    value={deactivateConfirmation}
                    onChange={(e) => setDeactivateConfirmation(e.target.value)}
                    placeholder='Type "DEACTIVATE" to confirm'
                    className={cn(accountInput, "text-center")}
                  />
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowDeactivateModal(false);
                      setDeactivateConfirmation("");
                    }}
                    className={accountModalBtnCancel}
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeactivateAccount}
                    disabled={deactivateConfirmation !== "DEACTIVATE" || deactivateLoading}
                    className={cn(accountModalBtnDanger, "flex-1 flex items-center justify-center gap-2")}
                  >
                    {deactivateLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Deactivate account
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* MFA Modal */}
          {showMfaModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={accountModalOverlay}
              onClick={() => {
                setShowMfaModal(false);
                setMfaStep('method');
              }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className={accountModalPanel}
              >
                <h3 className={cn(accountModalTitle, "mb-6")}>
                  {mfaStep === 'method'
                    ? 'Choose 2FA Method'
                    : mfaStep === 'knowledgeSetup'
                      ? 'Setup Knowledge-Based 2FA'
                    : mfaStep === 'enroll'
                      ? 'Setup 2FA'
                      : 'Verify Code'}
                </h3>

                {mfaStep === 'method' && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setMfaMethod('authenticator')}
                      className={accountMfaMethodOption(mfaMethod === 'authenticator')}
                    >
                      <p className={accountMfaMethodTitle}>Authenticator app</p>
                      <p className={accountMfaMethodDesc}>
                        Google Authenticator, Authy, Microsoft Authenticator
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMfaMethod('knowledge')}
                      className={accountMfaMethodOption(mfaMethod === 'knowledge')}
                    >
                      <p className={accountMfaMethodTitle}>
                        PIN (with security answer)
                      </p>
                      <p className={accountMfaMethodDesc}>
                        Knowledge-based second factor
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMfaMethod('knowledge_email')}
                      className={accountMfaMethodOption(mfaMethod === 'knowledge_email')}
                    >
                      <p className={accountMfaMethodTitle}>
                        Email authentication code
                      </p>
                      <p className={accountMfaMethodDesc}>
                        Use an email 6-digit code at login (no PIN required)
                      </p>
                    </button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (mfaMethod === 'authenticator') {
                          startAuthenticatorEnrollment();
                        } else {
                          setMfaStep('knowledgeSetup');
                        }
                      }}
                      disabled={mfaLoading}
                      className={cn(accountModalBtnPrimary, "flex w-full items-center justify-center gap-2 disabled:opacity-50")}
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Continue
                    </motion.button>
                  </div>
                )}

                {mfaStep === 'knowledgeSetup' && (
                  <div className="space-y-4">
                    {mfaMethod === 'knowledge_email' ? (
                      <>
                        <div className={accountMfaInfoBanner}>
                          Email authentication code is enabled. At login, we&apos;ll email you a 6-digit code for verification.
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSetupKnowledgeEmailMfa}
                          disabled={mfaLoading}
                          className={cn(accountModalBtnPrimary, "flex w-full items-center justify-center gap-2 disabled:opacity-50")}
                        >
                          {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Enable Email Authentication Code
                        </motion.button>

                        <button
                          type="button"
                          onClick={() => setMfaStep('method')}
                          className={accountMfaBackLink}
                        >
                          Back
                        </button>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className={accountLabel}>
                            PIN (4 digits)
                          </label>
                          <div className="flex justify-center">
                            <InputOTP
                              maxLength={4}
                              value={knowledgeSetup.pin}
                              onChange={(value) =>
                                setKnowledgeSetup((prev) => ({
                                  ...prev,
                                  pin: value.replace(/\D/g, '').slice(0, 4),
                                }))
                              }
                            >
                              <InputOTPGroup>
                                <InputOTPSlot index={0} className={accountOtpSlot} />
                                <InputOTPSlot index={1} className={accountOtpSlot} />
                                <InputOTPSlot index={2} className={accountOtpSlot} />
                                <InputOTPSlot index={3} className={accountOtpSlot} />
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                        </div>

                        <div>
                          <label className={accountLabel}>
                            Security Question
                          </label>
                          <SolaceSelect
                            value={knowledgeSetup.securityQuestion}
                            onValueChange={(securityQuestion) =>
                              setKnowledgeSetup((prev) => ({ ...prev, securityQuestion }))
                            }
                            ariaLabel="Security question"
                            placeholder="Select a security question"
                            variant="form"
                            triggerClassName={cn(accountInput, "h-auto min-h-[56px]")}
                            options={genericSecurityQuestions.map((question) => ({
                              value: question,
                              label: question,
                            }))}
                          />
                        </div>

                        <div>
                          <label className={accountLabel}>
                            Security Answer
                          </label>
                          <input
                            type="password"
                            value={knowledgeSetup.securityAnswer}
                            onChange={(e) =>
                              setKnowledgeSetup((prev) => ({ ...prev, securityAnswer: e.target.value }))
                            }
                            placeholder="Enter answer"
                            className={accountInput}
                          />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSetupKnowledgeMfa}
                          disabled={mfaLoading}
                          className={cn(accountModalBtnPrimary, "flex w-full items-center justify-center gap-2 disabled:opacity-50")}
                        >
                          {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Save & Enable
                        </motion.button>

                        <button
                          type="button"
                          onClick={() => setMfaStep('method')}
                          className={accountMfaBackLink}
                        >
                          Back
                        </button>
                      </>
                    )}
                  </div>
                )}

                {mfaStep === 'enroll' && mfaData ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className={cn(accountModalMuted, "mb-4")}>
                        Scan this QR code with your authenticator app (like Google Authenticator or Authy)
                      </p>
                      <div className="mb-4 flex justify-center">
                        {mfaData.qr_code && (
                          <img 
                            src={mfaData.qr_code.startsWith('data:') ? mfaData.qr_code : `data:image/svg+xml;utf-8,${encodeURIComponent(mfaData.qr_code)}`} 
                            alt="QR Code" 
                            className="h-48 w-48 rounded-xl bg-white p-3 ring-1 ring-white/20" 
                          />
                        )}
                      </div>
                      <p className={cn(accountModalMuted, "break-all text-xs")}>
                        Secret: {mfaData.secret}
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setMfaStep('verify')}
                      className={cn(accountModalBtnPrimary, "w-full")}
                    >
                      Next
                    </motion.button>
                  </div>
                ) : mfaStep === 'enroll' ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                  </div>
                ) : null}

                {mfaStep === 'verify' && (
                  <div className="space-y-6">
                    <div>
                      <label className={accountLabel}>
                        Enter Verification Code
                      </label>
                      <input
                        type="text"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className={accountMfaOtpInput}
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleVerifyMfa}
                      disabled={mfaLoading || mfaCode.length !== 6}
                      className={cn(accountModalBtnPrimary, "flex w-full items-center justify-center gap-2 disabled:opacity-50")}
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Verify & Enable
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {showDisableAuthenticatorModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={accountModalOverlay}
              onClick={() => setShowDisableAuthenticatorModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className={accountModalPanel}
              >
                <h3 className={cn(accountModalTitle, "mb-2")}>
                  Disable Authenticator
                </h3>
                <p className={cn(accountModalMuted, "mb-4")}>
                  Enter your current 6-digit authenticator code to disable authenticator-based 2FA.
                </p>
                <input
                  type="text"
                  value={disableAuthenticatorCode}
                  onChange={(e) => setDisableAuthenticatorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className={accountMfaOtpInput}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDisableAuthenticatorModal(false)}
                    className={cn(accountModalBtnCancel, "flex-1")}
                    disabled={mfaLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDisableAuthenticator}
                    className={cn(accountModalBtnDanger, "flex items-center justify-center gap-2")}
                    disabled={mfaLoading || disableAuthenticatorCode.length !== 6}
                  >
                    {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Disable
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showDisableKnowledgeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={accountModalOverlay}
              onClick={() => setShowDisableKnowledgeModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className={accountModalPanel}
              >
                <h3 className={cn(accountModalTitle, "mb-2")}>
                  Disable Knowledge 2FA
                </h3>
                <p className={cn(accountModalMuted, "mb-4")}>
                  Disable using PIN/security answer, or use an email authentication code instead.
                </p>

                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDisableKnowledgeUseEmail(false);
                      setDisableKnowledgeUsePin(true);
                      setDisableKnowledgeEmailCode('');
                      setDisableKnowledgeEmailCodeSent(false);
                      setDisableKnowledgeEmailOtpKey((k) => k + 1);
                    }}
                    className={accountMfaSegmentBtn(!disableKnowledgeUseEmail)}
                  >
                    PIN / Answer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!knowledge2fa.emailCodeEnabled) return;
                      setDisableKnowledgeUseEmail(true);
                      setDisableKnowledgeUsePin(true);
                      setDisableKnowledgeCode('');
                      setDisableKnowledgeEmailCode('');
                      setDisableKnowledgeEmailCodeSent(false);
                      setDisableKnowledgeEmailOtpKey((k) => k + 1);
                    }}
                    className={cn(
                      accountMfaSegmentBtn(disableKnowledgeUseEmail),
                      !knowledge2fa.emailCodeEnabled && "cursor-not-allowed opacity-40"
                    )}
                    disabled={!knowledge2fa.emailCodeEnabled}
                  >
                    Email Code
                  </button>
                </div>

                {!disableKnowledgeUseEmail ? (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDisableKnowledgeUsePin(true)}
                        className={accountMfaSegmentBtn(disableKnowledgeUsePin)}
                      >
                        PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisableKnowledgeUsePin(false)}
                        className={accountMfaSegmentBtn(!disableKnowledgeUsePin)}
                      >
                        Security Answer
                      </button>
                    </div>

                    {disableKnowledgeUsePin ? (
                      <div className="space-y-2">
                        <div className={accountModalMuted}>
                          Enter your 4-digit PIN
                        </div>
                        <div className="flex justify-center">
                          <InputOTP
                            maxLength={4}
                            value={disableKnowledgeCode}
                            onChange={(value) =>
                              setDisableKnowledgeCode(value.replace(/\D/g, "").slice(0, 4))
                            }
                          >
                            <InputOTPGroup>
                              <InputOTPSlot index={0} className={accountOtpSlot} />
                              <InputOTPSlot index={1} className={accountOtpSlot} />
                              <InputOTPSlot index={2} className={accountOtpSlot} />
                              <InputOTPSlot index={3} className={accountOtpSlot} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className={accountModalMuted}>
                          Enter your security answer
                        </div>
                        <input
                          type="password"
                          value={disableKnowledgeCode}
                          onChange={(e) => setDisableKnowledgeCode(e.target.value)}
                          placeholder="Enter security answer"
                          className={accountInput}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className={accountModalMuted}>
                      We&apos;ll email a 6-digit authentication code to your account email.
                    </p>

                    <button
                      type="button"
                      onClick={handleRequestDisableKnowledgeEmailCode}
                      disabled={mfaLoading}
                      className={cn(accountModalBtnPrimary, "flex w-full items-center justify-center gap-2 disabled:opacity-50")}
                    >
                      {disableKnowledgeEmailCodeSent ? "Resend code" : "Send code"}
                    </button>

                    <div className="flex justify-center">
                      <InputOTP
                        key={disableKnowledgeEmailOtpKey}
                        maxLength={6}
                        value={disableKnowledgeEmailCode}
                        onChange={(value) => setDisableKnowledgeEmailCode(value)}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className={accountOtpSlot} />
                          <InputOTPSlot index={1} className={accountOtpSlot} />
                          <InputOTPSlot index={2} className={accountOtpSlot} />
                          <InputOTPSlot index={3} className={accountOtpSlot} />
                          <InputOTPSlot index={4} className={accountOtpSlot} />
                          <InputOTPSlot index={5} className={accountOtpSlot} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDisableKnowledgeModal(false)}
                    className={cn(accountModalBtnCancel, "flex-1")}
                    disabled={mfaLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDisableKnowledge}
                    className={cn(accountModalBtnDanger, "flex items-center justify-center gap-2")}
                    disabled={
                      mfaLoading ||
                      (!disableKnowledgeUseEmail
                        ? disableKnowledgeUsePin
                          ? !/^\d{4}$/.test(disableKnowledgeCode.trim())
                          : disableKnowledgeCode.trim().length < 2
                        : !/^\d{6}$/.test(disableKnowledgeEmailCode.trim()))
                    }
                  >
                    {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Disable
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Change Password Modal */}
          {showPasswordModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
              onClick={() => setShowPasswordModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0d14] p-6 shadow-2xl transition-colors duration-300"
              >
                <h3 className="text-xl font-bold text-zinc-100 mb-6">Change Password</h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className={accountLabel}>Current Password</label>
                    <PasswordInput
                      value={passwordState.currentPassword}
                      onChange={(e) => setPasswordState({...passwordState, currentPassword: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className={accountLabel}>New Password</label>
                    <PasswordInput
                      value={passwordState.newPassword}
                      onChange={(e) => setPasswordState({...passwordState, newPassword: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                    <PasswordStrengthMeter password={passwordState.newPassword} />
                  </div>

                  <div>
                    <label className={accountLabel}>Confirm New Password</label>
                    <PasswordInput
                      value={passwordState.confirmPassword}
                      onChange={(e) => setPasswordState({...passwordState, confirmPassword: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                  </div>

                  {(mfaFactors.length > 0 || knowledge2fa.enabled) && (
                    <div>
                      <label className={accountLabel}>
                        {mfaFactors.length > 0 ? 'Authenticator Code (2FA)' : 'PIN / Security Answer (2FA)'}
                      </label>
                      <input
                        type={mfaFactors.length > 0 ? 'text' : 'password'}
                        value={passwordMfaCode}
                        onChange={(e) =>
                          setPasswordMfaCode(
                            mfaFactors.length > 0
                              ? e.target.value.replace(/\D/g, '').slice(0, 6)
                              : e.target.value
                          )
                        }
                        placeholder={mfaFactors.length > 0 ? '000000' : 'Enter PIN or answer'}
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none text-center text-xl tracking-widest transition-colors"
                        maxLength={mfaFactors.length > 0 ? 6 : 120}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Required because two-factor authentication is enabled.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordMfaCode("");
                    }}
                    disabled={passwordLoading}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePasswordUpdate}
                    disabled={passwordLoading}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Update Password
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
    </motion.div>
  );
}

interface AccountTipRowProps {
  icon: LucideIcon;
  tone: "violet" | "pink" | "emerald";
  title: string;
  description: string;
}

function AccountTipRow({ icon: Icon, tone, title, description }: AccountTipRowProps) {
  return (
    <li className={accountTipRow}>
      <div className={accountIconChip(tone)}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <p className={accountTipTitle}>{title}</p>
        <p className={accountTipDesc}>{description}</p>
      </div>
    </li>
  );
}
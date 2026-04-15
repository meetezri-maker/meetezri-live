import { motion } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import { 
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Camera,
  Key,
  Trash2,
  Save,
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronsUpDown,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useState, useEffect, useMemo, useRef } from "react";
import { AppLayout } from "@/app/components/AppLayout";
import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import {
  birthIsoToAgeYears,
  profileAgeStorageToDateInput,
} from "@/lib/profileAge";
import { PhoneInput } from "@/app/components/ui/phone-input";
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
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const availableTimezones = useMemo<string[]>(() => {
    try {
      const list = ((Intl as any).supportedValuesOf?.("timeZone") || []) as string[];
      return list.length ? list : fallbackTimezones;
    } catch {
      return fallbackTimezones;
    }
  }, []);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
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
  const [mfaMethod, setMfaMethod] = useState<'authenticator' | 'knowledge'>('authenticator');
  const [mfaData, setMfaData] = useState<{ id: string; qr_code: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [knowledge2fa, setKnowledge2fa] = useState<{ enabled: boolean; question: string | null }>({
    enabled: false,
    question: null,
  });
  const [knowledgeSetup, setKnowledgeSetup] = useState({
    pin: '',
    securityQuestion: '',
    securityAnswer: '',
  });

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setMfaFactors(data.totp);
      const knowledge = (await api.getKnowledgeTwoFactorStatus()) as {
        enabled: boolean;
        question: string | null;
      };
      setKnowledge2fa({
        enabled: knowledge.enabled === true,
        question: knowledge.question || null,
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
      const existingTotp = factors?.all?.filter(f => f.factor_type === 'totp') || [];
      
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
      if (!/^\d{4,10}$/.test(knowledgeSetup.pin)) {
        toast.error('PIN must be 4 to 10 digits');
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
      await api.setupKnowledgeTwoFactor({
        pin: knowledgeSetup.pin,
        securityQuestion: knowledgeSetup.securityQuestion,
        securityAnswer: knowledgeSetup.securityAnswer,
      });
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
      if (mfaFactors.length > 0) {
        const factorId = mfaFactors[0]?.id;
        if (!factorId) return;
        const { error } = await supabase.auth.mfa.unenroll({ factorId });
        if (error) throw error;
      }
      if (knowledge2fa.enabled) {
        await api.disableKnowledgeTwoFactor();
      }
      toast.success('Two-Factor Authentication disabled');
      fetchMfaStatus();
    } catch (error: any) {
      toast.error(error.message || 'Failed to disable MFA');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;
    
    setDeleteLoading(true);
    try {
      await api.deleteAccount();
      await supabase.auth.signOut();
      toast.success("Account deleted successfully");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
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
    async function fetchProfile() {
      if (!user) return;
      
      try {
        setLoading(true);
        const data = await api.getMe();
        
        // Split full name into first and last name
        const nameParts = (data.full_name || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const profileBio =
          typeof (data as { bio?: string | null }).bio === "string" &&
          (data as { bio?: string | null }).bio!.trim().length > 0
            ? (data as { bio?: string | null }).bio!
            : "";
        const legacyBioFromMood =
          !profileBio && typeof data.current_mood === "string"
            ? data.current_mood
            : "";

        setProfileData({
          firstName,
          lastName,
          email: data.email || user.email || "",
          phone: normalizeStoredPhoneForInput(data.phone || ""),
          dateOfBirth: profileAgeStorageToDateInput(data.age),
          location: data.timezone || getBrowserTimezone(), // Using timezone as location proxy
          bio: profileBio || legacyBioFromMood,
          avatar_url: data.avatar_url || ""
        });
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        toast.error("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0) {
        return;
      }
      setIsUploading(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const avatar_url = data.publicUrl;

      setProfileData(prev => ({ ...prev, avatar_url }));
      
      // Auto-save the new avatar URL
      await api.updateProfile({ avatar_url });
      
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
      if (dobIso && birthIsoToAgeYears(dobIso) === undefined) {
        toast.error(
          "Please enter a valid date of birth."
        );
        return;
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

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </Link>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Account Settings</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your personal information and account details</p>
          </motion.div>

          {/* Save Success Banner */}
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-300 font-medium">Settings saved successfully!</span>
            </motion.div>
          )}

          {/* Profile Picture */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6 transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Profile Picture</h2>

            <div className="flex items-center gap-6">
              <div className="relative">
                {profileData.avatar_url ? (
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={profileData.avatar_url}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover shadow-lg"
                  />
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg"
                  >
                    {initials || "?"}
                  </motion.div>
                )}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border-2 border-gray-100 dark:border-slate-700 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </motion.button>
              </div>

              <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Change Photo</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Upload a new profile picture (JPG, PNG, max 5MB)</p>
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isRemoving}
                    className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isUploading ? 'Uploading...' : 'Upload Photo'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRemovePhoto}
                    disabled={isUploading || isRemoving || !profileData.avatar_url}
                    className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isRemoving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isRemoving ? 'Removing...' : 'Remove'}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Personal Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6 transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Personal Information</h2>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({...profileData, firstName: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-1" />
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({...profileData, lastName: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone number
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Country code and number (max 12 digits including code).
                </p>
                <PhoneInput
                  value={profileData.phone}
                  onChange={(v) => setProfileData({ ...profileData, phone: v })}
                  placeholder="Your phone number"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={profileData.dateOfBirth}
                    onChange={(e) => setProfileData({...profileData, dateOfBirth: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Location
                  </label>
                  <Popover open={timezoneOpen} onOpenChange={setTimezoneOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors flex items-center justify-between"
                      >
                        <span className="truncate text-left">
                          {profileData.location
                            ? formatTimezoneOptionLabel(profileData.location)
                            : "Select timezone"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search timezone or city..." />
                        <CommandList>
                          <CommandEmpty>No timezone found.</CommandEmpty>
                          <CommandGroup>
                            {availableTimezones.map((timezone) => (
                              <CommandItem
                                key={timezone}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bio</label>
                <textarea
                  value={profileData.bio}
                  onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none transition-colors"
                />
              </div>
            </div>
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-slate-800 mb-6 transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Security</h2>

            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setShowPasswordModal(true)}
                className="w-full bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl p-4 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">Change Password</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {user?.updated_at 
                        ? `Last changed ${formatDistanceToNow(new Date(user.updated_at), { addSuffix: true })}`
                        : 'Never changed'}
                    </p>
                  </div>
                </div>
                <div className="text-blue-600 dark:text-blue-400">Change</div>
              </motion.button>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 transition-colors duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <CheckCircle className={`w-5 h-5 mt-0.5 ${mfaFactors.length > 0 || knowledge2fa.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">Two-Factor Authentication</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
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
                      <div className="mt-2 space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
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
                      onClick={handleDisableMfa}
                      disabled={mfaLoading}
                      className="text-sm text-red-600 dark:text-red-400 font-medium hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Disable
                    </button>
                  ) : (
                    <button 
                      onClick={handleEnrollMfa}
                      disabled={mfaLoading}
                      className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 flex items-center gap-2"
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Enable
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-900/30 rounded-2xl p-6 mb-6 transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-red-900 dark:text-red-200 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Danger Zone
            </h2>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 flex items-center justify-between transition-colors duration-300">
              <div>
                <p className="font-medium text-gray-900 dark:text-white mb-1">Delete Account</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Permanently delete your account and all data</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </motion.button>
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </motion.button>

          {/* Delete Account Modal */}
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl transition-colors duration-300"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Delete Account?</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    This action cannot be undone. All your data, including sessions, journals, and progress will be permanently deleted.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder='Type "DELETE" to confirm'
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-colors"
                  />
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmation !== "DELETE" || deleteLoading}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Delete Account
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
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  onClick={() => {
                    setShowMfaModal(false);
                    setMfaStep('method');
                  }}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl transition-colors duration-300"
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
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
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        mfaMethod === 'authenticator'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">Authenticator app</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Google Authenticator, Authy, Microsoft Authenticator
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMfaMethod('knowledge')}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        mfaMethod === 'knowledge'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700'
                      }`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white">
                        A password, PIN, or answers to security questions
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Knowledge-based second factor
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
                      className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Continue
                    </motion.button>
                  </div>
                )}

                {mfaStep === 'knowledgeSetup' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        PIN (4-10 digits)
                      </label>
                      <input
                        type="password"
                        value={knowledgeSetup.pin}
                        onChange={(e) =>
                          setKnowledgeSetup((prev) => ({
                            ...prev,
                            pin: e.target.value.replace(/\D/g, '').slice(0, 10),
                          }))
                        }
                        placeholder="Enter PIN"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Security Question
                      </label>
                      <input
                        type="text"
                        value={knowledgeSetup.securityQuestion}
                        onChange={(e) =>
                          setKnowledgeSetup((prev) => ({ ...prev, securityQuestion: e.target.value }))
                        }
                        placeholder="e.g. What is your favorite book?"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Security Answer
                      </label>
                      <input
                        type="password"
                        value={knowledgeSetup.securityAnswer}
                        onChange={(e) =>
                          setKnowledgeSetup((prev) => ({ ...prev, securityAnswer: e.target.value }))
                        }
                        placeholder="Enter answer"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSetupKnowledgeMfa}
                      disabled={mfaLoading}
                      className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save & Enable
                    </motion.button>
                    <button
                      type="button"
                      onClick={() => setMfaStep('method')}
                      className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:underline"
                    >
                      Back
                    </button>
                  </div>
                )}

                {mfaStep === 'enroll' && mfaData ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Scan this QR code with your authenticator app (like Google Authenticator or Authy)
                      </p>
                      <div className="flex justify-center mb-4">
                        {mfaData.qr_code && (
                          <img 
                            src={mfaData.qr_code.startsWith('data:') ? mfaData.qr_code : `data:image/svg+xml;utf-8,${encodeURIComponent(mfaData.qr_code)}`} 
                            alt="QR Code" 
                            className="w-48 h-48 bg-white p-2 rounded-lg" 
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                        Secret: {mfaData.secret}
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setMfaStep('verify')}
                      className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium"
                    >
                      Next
                    </motion.button>
                  </div>
                ) : mfaStep === 'enroll' ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : null}

                {mfaStep === 'verify' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Enter Verification Code
                      </label>
                      <input
                        type="text"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="000000"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-center text-2xl tracking-widest transition-colors"
                        maxLength={6}
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleVerifyMfa}
                      disabled={mfaLoading || mfaCode.length !== 6}
                      className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {mfaLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Verify & Enable
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Change Password Modal */}
          {showPasswordModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowPasswordModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl transition-colors duration-300"
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Change Password</h3>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Password</label>
                    <PasswordInput
                      value={passwordState.currentPassword}
                      onChange={(e) => setPasswordState({...passwordState, currentPassword: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
                    <PasswordInput
                      value={passwordState.newPassword}
                      onChange={(e) => setPasswordState({...passwordState, newPassword: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm New Password</label>
                    <PasswordInput
                      value={passwordState.confirmPassword}
                      onChange={(e) => setPasswordState({...passwordState, confirmPassword: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                    />
                  </div>

                  {(mfaFactors.length > 0 || knowledge2fa.enabled) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-center text-xl tracking-widest transition-colors"
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
        </div>
      </div>
    </AppLayout>
  );
}
import { AppLayout } from "../../components/AppLayout";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { motion } from "motion/react";
import { Link, useNavigate, useLocation } from "react-router-dom";
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
  Trash2,
  AlertTriangle,
  X,
  Activity,
  Pill,
  Target,
  Zap,
  Users,
  Loader2
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";

import { api } from "@/lib/api";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "../../components/ui/skeleton";
import { Progress } from "../../components/ui/progress";

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
import { Input } from "../../components/ui/input";
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

const goalsOptions = [
  { value: "reduce-stress", label: "Reduce Stress", emoji: "🧘" },
  { value: "manage-anxiety", label: "Manage Anxiety", emoji: "💭" },
  { value: "improve-sleep", label: "Improve Sleep", emoji: "😴" },
  { value: "boost-mood", label: "Boost Mood", emoji: "✨" },
  { value: "build-confidence", label: "Build Confidence", emoji: "💪" },
  { value: "work-life-balance", label: "Work-Life Balance", emoji: "⚖️" },
  { value: "relationship-support", label: "Relationship Support", emoji: "❤️" },
  { value: "grief-loss", label: "Grief & Loss", emoji: "🕊️" }
];

const triggersOptions = [
  { value: "violence", label: "Violence" },
  { value: "self-harm", label: "Self-harm" },
  { value: "substance-abuse", label: "Substance Abuse" },
  { value: "eating-disorders", label: "Eating Disorders" },
  { value: "trauma", label: "Trauma/PTSD" },
  { value: "none", label: "None of the above" }
];

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),

  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\+?[\d\s-().]+$/.test(v), "Phone must contain valid characters (digits, spaces, dashes, +, ())"),

  birthday: z.string().optional(),
  pronouns: z.string().optional(),
  location: z.string().optional(),
  in_therapy: z.string().optional(),
  on_medication: z.string().optional(),
  selected_goals: z.array(z.string()).optional(),
  selected_triggers: z.array(z.string()).optional(),

  emergency_contact_name: z.string().min(2, "Contact name is required").optional().or(z.literal("")),

  emergency_contact_phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^\+?[\d\s-().]+$/.test(v), "Valid phone number is required"),

  emergency_contact_relationship: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function UserProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showVerifiedAlert, setShowVerifiedAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string>("");
  const [resending, setResending] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "true") {
      setShowVerifiedAlert(true);
      // Clean up the URL
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  // Use React Hook Form
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      birthday: "",
      location: "",
      pronouns: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      emergency_contact_relationship: "",
      in_therapy: "",
      on_medication: "",
      selected_goals: [],
      selected_triggers: [],
    },
  });

  const [userStats, setUserStats] = useState({
    sessions: 0,
    checkins: 0,
    daysActive: 0
  });

  // Additional state for non-form fields if any (e.g. preferences that are not part of main form)
  const [preferencesData, setPreferencesData] = useState({
    selected_avatar: "",
    selected_voice: "",
    selected_environment: ""
  });

  // Keep a copy of raw profile if needed later
  const [rawProfile, setRawProfile] = useState<any | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const profile = await api.getMe();
      console.log("Loaded profile data:", profile); // Debug logging
      setRawProfile(profile);
      
      form.reset({
        name: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        birthday: profile.age ? `${profile.age}` : "",
        location: profile.timezone || "",
        pronouns: profile.pronouns || "",
        emergency_contact_name: profile.emergency_contact_name || "",
        emergency_contact_phone: profile.emergency_contact_phone || "",
        emergency_contact_relationship: profile.emergency_contact_relationship || "",
        in_therapy: profile.in_therapy || "Not specified",
        on_medication: profile.on_medication || "Not specified",
        selected_goals: Array.isArray(profile.selected_goals) 
          ? profile.selected_goals 
          : (typeof profile.selected_goals === 'string' ? profile.selected_goals.split(',').map((s: string) => s.trim()) : []),
        selected_triggers: Array.isArray(profile.selected_triggers) 
          ? profile.selected_triggers 
          : (typeof profile.selected_triggers === 'string' ? profile.selected_triggers.split(',').map((s: string) => s.trim()) : []),
      });
      
      setPreferencesData({
        selected_avatar: profile.selected_avatar || "Default Avatar",
        selected_voice: profile.selected_voice || "Default Voice",
        selected_environment: profile.selected_environment || "Default Environment"
      });

      setProfileImage(profile.avatar_url);
      if (profile.created_at) {
        setJoinedAt(new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
      }

      // Update stats from real data
      if (profile.stats) {
        setUserStats({
          sessions: profile.stats.completed_sessions || 0,
          checkins: profile.stats.total_checkins || 0,
          daysActive: profile.stats.streak_days || 0
        });
      } else {
        // Fallback for partial data
        setUserStats({
          sessions: 0,
          checkins: 0,
          daysActive: profile.streak_days || 0
        });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  // Watch form values so completion updates as the user edits
  const watchedValues = form.watch();

  // Compute profile completion based on current (watched) form values
  const profileCompletion = useMemo(() => {
    const values = watchedValues as ProfileFormValues;

    const fields: {
      key: keyof ProfileFormValues;
      label: string;
      type?: "string" | "array";
      treatNotSpecifiedAsEmpty?: boolean;
    }[] = [
      { key: "name", label: "Name", type: "string" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "birthday", label: "Birthday", type: "string" },
      { key: "location", label: "Location", type: "string" },
      { key: "pronouns", label: "Pronouns", type: "string" },
      { key: "in_therapy", label: "In therapy", type: "string", treatNotSpecifiedAsEmpty: true },
      { key: "on_medication", label: "On medication", type: "string", treatNotSpecifiedAsEmpty: true },
      { key: "emergency_contact_name", label: "Emergency contact name", type: "string" },
      { key: "emergency_contact_phone", label: "Emergency contact phone", type: "string" },
      { key: "emergency_contact_relationship", label: "Emergency contact relationship", type: "string" },
      { key: "selected_goals", label: "Wellness goals", type: "array" },
      { key: "selected_triggers", label: "Content triggers", type: "array" },
    ];

    let completed = 0;
    const missingLabels: string[] = [];
    const missingFields: { label: string; key: string }[] = [];

    fields.forEach((field) => {
      const value = values[field.key] as any;
      let isFilled = false;

      if (field.type === "array") {
        isFilled = Array.isArray(value) && value.length > 0;
      } else {
        const str = (value ?? "").toString().trim();
        if (field.treatNotSpecifiedAsEmpty && str.toLowerCase() === "not specified") {
          isFilled = false;
        } else {
          isFilled = str.length > 0;
        }
      }

      if (isFilled) {
        completed += 1;
      } else {
        missingLabels.push(field.label);
        missingFields.push({ label: field.label, key: field.key as string });
      }
    });

    const total = fields.length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      percent,
      missingLabels,
      missingFields,
      isComplete: percent === 100,
    };
  }, [watchedValues]);

  const scrollToProfileField = (fieldKey: string) => {
    const el = document.getElementById(`profile-field-${fieldKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        setProfileImage(publicUrl);
        
        // Auto-save the profile image
        await api.updateProfile({
          avatar_url: publicUrl
        });
        
        toast.success("Profile photo updated successfully");
      } catch (error) {
        console.error('Error uploading image:', error);
        toast.error("Error uploading image");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true);
    try {
      const updatedProfile = await api.updateProfile({
        full_name: data.name,
        email: data.email,
        phone: data.phone,
        age: data.birthday, // Mapped from birthday field which is actually age
        avatar_url: profileImage,
        pronouns: data.pronouns,
        timezone: data.location,
        in_therapy: data.in_therapy,
        on_medication: data.on_medication,
        selected_goals: data.selected_goals || [],
        selected_triggers: data.selected_triggers || [],
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        emergency_contact_relationship: data.emergency_contact_relationship
      });
      
      // Update form with returned data to ensure sync
      form.reset({
        name: updatedProfile.full_name || '',
        email: updatedProfile.email || '',
        phone: updatedProfile.phone || '',
        birthday: updatedProfile.age || '',
        pronouns: updatedProfile.pronouns || '',
        location: updatedProfile.timezone || '',
        in_therapy: updatedProfile.in_therapy || 'Not specified',
        on_medication: updatedProfile.on_medication || 'Not specified',
        selected_goals: updatedProfile.selected_goals || [],
        selected_triggers: updatedProfile.selected_triggers || [],
        emergency_contact_name: updatedProfile.emergency_contact_name || '',
        emergency_contact_phone: updatedProfile.emergency_contact_phone || '',
        emergency_contact_relationship: updatedProfile.emergency_contact_relationship || ''
      });

      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    try {
      setResending(true);
      
      // Use window.location.origin as the primary source of truth
      let baseUrl = window.location.origin;
      
      // Safety override: If we are on the production domain, ensure we use the HTTPS production URL
      if (baseUrl.includes('meetezri-live-web.vercel.app')) {
        baseUrl = 'https://meetezri-live-web.vercel.app';
      }

      const currentPath = window.location.pathname + window.location.search;
      const redirectTo = `${baseUrl}/auth/callback?redirect=${encodeURIComponent(currentPath)}`;
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email");
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      setIsLoggingOut(true);
      try {
        await signOut();
        navigate('/login');
      } catch (error) {
        console.error("Logout error:", error);
        toast.error("Failed to log out");
        setIsLoggingOut(false);
      }
    }
  };

  const stats = [
    { label: "Sessions", value: userStats.sessions.toString(), icon: Heart },
    { label: "Check-ins", value: userStats.checkins.toString(), icon: Calendar },
    { label: "Days Active", value: userStats.daysActive.toString(), icon: Calendar }
  ];

  const preferences = [
    {
      icon: Volume2,
      title: "Voice",
      value: preferencesData.selected_voice || "Not set",
      link: "/app/settings"
    },
    {
      icon: User,
      title: "Avatar",
      value: preferencesData.selected_avatar || "Not set",
      link: "/app/settings"
    },
    {
      icon: Palette,
      title: "Environment",
      value: preferencesData.selected_environment || "Not set",
      link: "/app/settings"
    }
  ];

  const settingsSections = [
    {
      title: "Account",
      items: [
        { icon: Bell, label: "Notifications", link: "/app/settings/notifications" },
        { icon: Lock, label: "Privacy & Security", link: "/app/settings/privacy" },
        { icon: Shield, label: "Data & Permissions", link: "/app/settings/privacy" }
      ]
    },
    {
      title: "Support",
      items: [
        { icon: Heart, label: "Emergency Contacts", link: "/app/settings/emergency-contacts" },
        { icon: Mail, label: "Contact Support", link: "/app/settings/help-support" },
        { icon: Shield, label: "Safety Plan", link: "/app/settings/safety-plan" }
      ]
    }
  ];
  
  const needsEmailVerification = !!user && !(user as any).email_confirmed_at;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex flex-col items-center mb-6">
                  <Skeleton className="w-32 h-32 rounded-full mb-4" />
                  <Skeleton className="h-5 w-40 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="text-center space-y-2">
                      <Skeleton className="h-4 w-4 mx-auto" />
                      <Skeleton className="h-5 w-10 mx-auto" />
                      <Skeleton className="h-3 w-16 mx-auto" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-10 w-full" />
              </Card>
              <Card className="p-6">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <Skeleton className="h-5 w-48 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-6">
                <Skeleton className="h-5 w-40 mb-4" />
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {needsEmailVerification && (
          <div className="mb-6 p-4 border-2 border-yellow-300 bg-yellow-50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-700" />
              <div>
                <p className="font-semibold text-yellow-900">Verify your email</p>
                <p className="text-sm text-yellow-800">Please verify your email to secure your account and unlock all features.</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleResendVerification} disabled={resending}>
              {resending ? 'Sending...' : 'Resend link'}
            </Button>
          </div>
        )}
        {/* Persistent profile completion status (always visible, independent of any dismissible messages) */}
        <div className="mb-6">
          <Card className="relative overflow-hidden border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-background shadow-sm">
            <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.35),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.25),transparent_55%)]" />
            <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 md:p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      Profile {profileCompletion.percent}% complete
                    </p>
                    {!profileCompletion.isComplete && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                        Recommended setup
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {profileCompletion.isComplete
                      ? "Amazing – your profile is fully set up and Ezri can personalize support for you."
                      : profileCompletion.missingFields.length > 0
                        ? "You’re almost there. Tap a chip below to jump to that part of your profile."
                        : "Add a few more details so Ezri can better understand and support you."}
                  </p>
                  {!profileCompletion.isComplete && profileCompletion.missingFields.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profileCompletion.missingFields.slice(0, 6).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => scrollToProfileField(item.key)}
                          className="inline-flex items-center rounded-full border border-primary/30 bg-background/60 px-2.5 py-0.5 text-[11px] font-medium text-primary shadow-sm hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <span className="mr-1 h-1.5 w-1.5 rounded-full bg-primary" />
                          {item.label}
                        </button>
                      ))}
                      {profileCompletion.missingFields.length > 6 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{profileCompletion.missingFields.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-64">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{profileCompletion.percent >= 50 ? "Looking good" : "Let’s get you set up"}</span>
                  <span className="font-semibold text-foreground">
                    {profileCompletion.percent}%
                  </span>
                </div>
                <Progress value={profileCompletion.percent} />
                {!profileCompletion.isComplete && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-[11px]"
                      onClick={() => scrollToProfileField(profileCompletion.missingFields[0]?.key || "name")}
                    >
                      Finish profile
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Profile & Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and preferences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Profile Card & Preferences */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 shadow-xl">
                <div className="text-center mb-6">
                  <div className="relative inline-block mb-4">
                    <input
                      type="file"
                      id="profile-image-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      onClick={() => !isUploading && document.getElementById('profile-image-upload')?.click()}
                      className="w-32 h-32 bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 rounded-full flex items-center justify-center text-5xl cursor-pointer relative overflow-hidden"
                    >
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                          <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                      )}
                      {profileImage ? (
                        <img src={profileImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        '👤'
                      )}
                      <motion.div
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 transition-opacity"
                      >
                        <div className="text-center">
                          <Camera className="w-8 h-8 text-white mx-auto mb-1" />
                          <p className="text-white text-xs">Change Photo</p>
                        </div>
                      </motion.div>
                    </motion.div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => document.getElementById('profile-image-upload')?.click()}
                      className="absolute bottom-0 right-0 p-2 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{form.watch('name')}</h2>
                  <p className="text-muted-foreground text-sm">Member since {joinedAt || '...'}</p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {stats.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                        className="text-center"
                      >
                        <Icon className="w-5 h-5 text-primary mx-auto mb-1" />
                        <div className="text-xl font-bold">{stat.value}</div>
                        <div className="text-xs text-muted-foreground">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                {isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={form.handleSubmit(onSubmit)}
                      className="flex-1"
                      isLoading={isSaving}
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        // Reset form to last loaded values (reload profile to be safe or use form.reset() with saved values if tracked)
                        loadProfile(); 
                      }}
                      variant="outline"
                      className="flex-1"
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </Card>
            </motion.div>

            {/* Session Preferences */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 shadow-xl">
                <h3 className="font-bold mb-4">Session Preferences</h3>
                <div className="space-y-3">
                  {preferences.map((pref, index) => {
                    const Icon = pref.icon;
                    return (
                      <Link key={index} to={pref.link}>
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          whileHover={{ x: 5 }}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                        >
                          <div className="p-2 bg-white dark:bg-gray-900 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{pref.title}</p>
                            <p className="text-xs text-muted-foreground">{pref.value}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Right Column: Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <Card className={`p-6 shadow-xl transition-all ${isEditing ? 'ring-2 ring-primary shadow-2xl' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-lg">Personal Information</h3>
                      {isEditing && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-xs bg-primary text-white px-3 py-1 rounded-full"
                        >
                          Editing Mode
                        </motion.span>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem id="profile-field-name" className="scroll-mt-24">
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                                  isEditing 
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                                    : 'border-gray-300 dark:border-gray-700'
                                }`}>
                                  <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  <input
                                    {...field}
                                    disabled={!isEditing || isSaving}
                                    className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                                  isEditing 
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                                    : 'border-gray-300 dark:border-gray-700'
                                }`}>
                                  <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  <input
                                    {...field}
                                    disabled={!isEditing || isSaving}
                                    className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem id="profile-field-phone" className="scroll-mt-24">
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <PhoneInput
                                  value={field.value}
                                  onChange={field.onChange}
                                  disabled={!isEditing || isSaving}
                                  placeholder="Phone number"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="birthday"
                          render={({ field }) => (
                            <FormItem id="profile-field-birthday" className="scroll-mt-24">
                              <FormLabel>Age</FormLabel>
                              <FormControl>
                                <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                                  isEditing 
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                                    : 'border-gray-300 dark:border-gray-700'
                                }`}>
                                  <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  {isEditing ? (
                                    <input
                                      value={field.value || ""}
                                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                                      disabled={isSaving}
                                      inputMode="numeric"
                                      className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                                      placeholder="Age"
                                    />
                                  ) : (
                                    <p className="flex-1 font-medium text-gray-900 dark:text-gray-100">
                                      {field.value ? `${field.value.toString().replace(/\D/g, '')} years old` : "Not set"}
                                    </p>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="pronouns"
                          render={({ field }) => (
                            <FormItem id="profile-field-pronouns" className="scroll-mt-24">
                              <FormLabel>Pronouns</FormLabel>
                              <FormControl>
                                <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                                  isEditing 
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                                    : 'border-gray-300 dark:border-gray-700'
                                }`}>
                                  <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  <input
                                    {...field}
                                    disabled={!isEditing || isSaving}
                                    className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem id="profile-field-location" className="scroll-mt-24">
                              <FormLabel>Location/Timezone</FormLabel>
                              <FormControl>
                                <div className={`flex items-center gap-2 p-3 border rounded-lg transition-all ${
                                  isEditing 
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20' 
                                    : 'border-gray-300 dark:border-gray-700'
                                }`}>
                                  <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                  <input
                                    {...field}
                                    disabled={!isEditing || isSaving}
                                    className="flex-1 outline-none bg-transparent disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </Card>
                
            
            {/* Wellness Profile (New Section) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <Card className="p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">Wellness Profile</h3>
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2 text-primary" />}
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* Therapy & Medication */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="in_therapy"
                      render={({ field }) => (
                        <FormItem id="profile-field-in_therapy" className="scroll-mt-24 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-purple-500" />
                            <FormLabel className="font-semibold text-sm">Professionol  Companion</FormLabel>
                          </div>
                          <FormControl>
                            {isEditing ? (
                              <select
                                {...field}
                                disabled={isSaving}
                                className="w-full p-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100"
                              >
                                <option value="">Select...</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Prefer not to say">Prefer Not to Say</option>
                              </select>
                            ) : (
                              <p className="text-sm text-gray-700 dark:text-gray-300">{field.value || "Not specified"}</p>
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="on_medication"
                      render={({ field }) => (
                        <FormItem id="profile-field-on_medication" className="scroll-mt-24 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Pill className="w-4 h-4 text-blue-500" />
                            <FormLabel className="font-semibold text-sm">Medication</FormLabel>
                          </div>
                          <FormControl>
                            {isEditing ? (
                              <select
                                {...field}
                                disabled={isSaving}
                                className="w-full p-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="">Select...</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                              </select>
                            ) : (
                              <p className="text-sm text-gray-700 dark:text-gray-300">{field.value || "Not specified"}</p>
                            )}
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Goals */}
                  <FormField
                    control={form.control}
                    name="selected_goals"
                    render={({ field }) => (
                      <FormItem id="profile-field-selected_goals" className="scroll-mt-24">
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="w-4 h-4 text-green-500" />
                          <FormLabel className="font-semibold text-sm">Selected Goals</FormLabel>
                        </div>
                        <FormControl>
                          {isEditing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {goalsOptions.map((goal) => {
                                const isSelected = (field.value || []).includes(goal.value);
                                return (
                                  <button
                                    key={goal.value}
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => {
                                      const current = field.value || [];
                                      const updated = isSelected
                                        ? current.filter((v: string) => v !== goal.value)
                                        : [...current, goal.value];
                                      field.onChange(updated);
                                    }}
                                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-2 ${
                                      isSelected
                                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-1 ring-green-500"
                                        : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-800 bg-white dark:bg-gray-900"
                                    }`}
                                  >
                                    <span className="text-lg">{goal.emoji}</span>
                                    <span className="font-medium">{goal.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {field.value && field.value.length > 0 ? (
                                field.value.map((val: string, i: number) => {
                                  const option = goalsOptions.find(opt => opt.value === val);
                                  return (
                                    <Badge key={i} variant="secondary" className="px-3 py-1 flex items-center gap-1.5 bg-green-50 text-green-700 border-green-200">
                                      <span>{option?.emoji}</span>
                                      <span>{option?.label || val}</span>
                                    </Badge>
                                  );
                                })
                              ) : (
                                <p className="text-sm text-muted-foreground italic">No goals selected</p>
                              )}
                            </div>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Triggers */}
                  <FormField
                    control={form.control}
                    name="selected_triggers"
                    render={({ field }) => (
                      <FormItem id="profile-field-selected_triggers" className="scroll-mt-24">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="w-4 h-4 text-orange-500" />
                          <FormLabel className="font-semibold text-sm">Triggers / Challenges</FormLabel>
                        </div>
                        <FormControl>
                          {isEditing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {triggersOptions.map((trigger) => {
                                const isSelected = (field.value || []).includes(trigger.value);
                                return (
                                  <button
                                    key={trigger.value}
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => {
                                      const current = field.value || [];
                                      const updated = isSelected
                                        ? current.filter((v: string) => v !== trigger.value)
                                        : [...current, trigger.value];
                                      field.onChange(updated);
                                    }}
                                    className={`p-3 rounded-lg border text-sm text-left transition-all flex items-center gap-2 ${
                                      isSelected
                                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500"
                                        : "border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-800 bg-white dark:bg-gray-900"
                                    }`}
                                  >
                                    <span className="font-medium">{trigger.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {field.value && field.value.length > 0 ? (
                                field.value.map((val: string, i: number) => {
                                  const option = triggersOptions.find(opt => opt.value === val);
                                  return (
                                    <Badge key={i} variant="outline" className="px-3 py-1 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">
                                      {option?.label || val}
                                    </Badge>
                                  );
                                })
                              ) : (
                                <p className="text-sm text-muted-foreground italic">No triggers specified</p>
                              )}
                            </div>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>
            </motion.div>

            {/* Emergency Contact (New Section) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-6"
            >
              <Card className="p-6 shadow-xl border-l-4 border-l-red-400">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-red-500" />
                  <h3 className="font-bold text-lg">Emergency Contact</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="emergency_contact_name"
                    render={({ field }) => (
                      <FormItem id="profile-field-emergency_contact_name" className="scroll-mt-24">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Name</Label>
                        <FormControl>
                          {isEditing ? (
                            <input
                              {...field}
                              disabled={isSaving}
                              className="w-full mt-1 p-2 border rounded-lg border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 outline-none text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="Contact Name"
                            />
                          ) : (
                            <p className="font-medium mt-1">{field.value || "Not set"}</p>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emergency_contact_relationship"
                    render={({ field }) => (
                      <FormItem id="profile-field-emergency_contact_relationship" className="scroll-mt-24">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Relationship</Label>
                        <FormControl>
                          {isEditing ? (
                            <input
                              {...field}
                              disabled={isSaving}
                              className="w-full mt-1 p-2 border rounded-lg border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20 outline-none text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              placeholder="Relationship"
                            />
                          ) : (
                            <p className="font-medium mt-1">{field.value || "Not set"}</p>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emergency_contact_phone"
                    render={({ field }) => (
                      <FormItem id="profile-field-emergency_contact_phone" className="scroll-mt-24">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Phone</Label>
                        <FormControl>
                          {isEditing ? (
                            <PhoneInput
                              value={field.value}
                              onChange={field.onChange}
                              disabled={isSaving}
                              placeholder="Contact Phone"
                              className="mt-1"
                            />
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                              <p className="font-medium">{field.value || "Not set"}</p>
                            </div>
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Card>
            </motion.div>
            </form>
            </Form>
          </motion.div>
            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) => (
              <motion.div
                key={sectionIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + sectionIndex * 0.1 }}
              >
                <Card className="p-6 shadow-xl">
                  <h3 className="font-bold text-lg mb-4">{section.title}</h3>
                  <div className="space-y-2">
                    {section.items.map((item, itemIndex) => {
                      const Icon = item.icon;
                      return (
                        <Link key={itemIndex} to={item.link}>
                          <motion.div
                            whileHover={{ x: 5 }}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary transition-colors" />
                              <span className="font-medium">{item.label}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-primary transition-colors" />
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              </motion.div>
            ))}

            {/* Danger Zone */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="p-6 shadow-xl border-red-200 dark:border-red-900/50">
                <h3 className="font-bold text-lg mb-4 text-red-600 dark:text-red-400">Danger Zone</h3>
                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-between p-3 border-2 border-red-200 dark:border-red-900/50 rounded-lg hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleLogout}
                  >
                    <div className="flex items-center gap-3">
                      {isLoggingOut ? (
                        <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                      ) : (
                        <LogOut className="w-5 h-5 text-red-500 dark:text-red-400 group-hover:text-red-600 dark:group-hover:text-red-300" />
                      )}
                      <div className="text-left">
                        <p className="font-bold text-red-600 dark:text-red-400">
                          {isLoggingOut ? 'Logging Out...' : 'Log Out'}
                        </p>
                        <p className="text-xs text-red-400 dark:text-red-500">End your current session</p>
                      </div>
                    </div>
                    {!isLoggingOut && (
                      <ChevronRight className="w-5 h-5 text-red-300 dark:text-red-700 group-hover:text-red-500 dark:group-hover:text-red-400" />
                    )}
                  </motion.button>
                  
                  {/* Delete Account Button - Hidden by default or separate logic */}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      <AlertDialog open={showVerifiedAlert} onOpenChange={setShowVerifiedAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              Email Verified Successfully!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Thank you for verifying your email. Your account is now fully active.
              <br /><br />
              Please take a moment to complete your profile details to personalize your experience.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowVerifiedAlert(false);
              setIsEditing(true);
            }}>
              Complete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

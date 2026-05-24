import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Camera,
  User,
  Loader2,
  Sparkles,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/app/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
import { Input } from "../../components/ui/input";
import { normalizeStoredPhoneForInput } from "@/lib/normalizeStoredPhone";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";
import { ONBOARDING_PROFILE_SETUP_BG } from "@/lib/solace/referenceImagery";
import { SolaceSelect } from "@/app/solace";

const PROFILE_SETUP_BG = ONBOARDING_PROFILE_SETUP_BG;
const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "4.5rem";
const CURRENT_STEP = 2;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const countPhoneDigits = (value: string) => (value.match(/\d/g) || []).length;

const profileSetupSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  pronouns: z.string().optional(),
  phone: z.preprocess(
    (v) => (v === undefined || v === null ? "" : String(v)),
    z
      .string()
      .refine((v) => {
        const t = v.trim();
        if (!t) return true;
        return t.startsWith("+");
      }, { message: "Select a country from the dropdown first" })
      .refine((v) => {
        const t = v.trim();
        if (!t) return true;
        const n = countPhoneDigits(t);
        return n === 12;
      }, { message: "Enter exactly 12 digits total (country code + number)" }),
  ),
  age: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 18;
  }, "You must be 18+ to use this app"),
  timezone: z.string().min(1, "Timezone is required"),
});

type ProfileSetupValues = z.infer<typeof profileSetupSchema>;

const onboardingInputClass = cn(
  "h-11 w-full rounded-[14px] border border-violet-400/22 bg-[#0b0c20]/60 px-4 text-[15px] text-white/92",
  "placeholder:text-violet-300/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow,background-color] duration-200",
  "focus:border-[#FF4E91]/50 focus:bg-[#10122a]/75 focus:outline-none focus:ring-2 focus:ring-[#FF4E91]/18",
);

const onboardingLabelClass = "text-[13px] font-medium tracking-wide text-white/88";

const onboardingPhoneButtonClass = cn(
  "h-11 shrink-0 justify-between rounded-[14px] border-violet-400/22 bg-[#0b0c20]/60 px-3 text-white/90",
  "hover:bg-[#12132e]/75 hover:text-white focus-visible:border-[#FF4E91]/50 focus-visible:ring-[#FF4E91]/18",
);

function ProfileSetupSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <img
        src={PROFILE_SETUP_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_42%] brightness-[0.55] contrast-[1.04] saturate-[1.06]"
        width={2400}
        height={1350}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_18%_62%,rgba(255,78,145,0.14)_0%,transparent_52%)]"
        animate={{ opacity: [0.55, 0.8, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_82%_38%,rgba(138,79,255,0.16)_0%,transparent_58%)]"
        animate={{ opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_100%,rgba(5,6,18,0.92)_0%,transparent_55%)]"
        animate={{ opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[#070815]/52" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_48%,rgba(10,11,30,0.28)_0%,rgba(7,8,21,0.88)_100%)]"
        animate={{ opacity: [0.78, 0.92, 0.78] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,21,0.55)_0%,rgba(7,8,21,0.2)_42%,rgba(7,8,21,0.72)_100%)]"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_32%,rgba(0,0,0,0.62)_100%)]"
        animate={{ opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {[
        { left: "8%", top: "72%", delay: 0 },
        { left: "14%", top: "78%", delay: 0.9 },
        { left: "22%", top: "74%", delay: 1.7 },
        { left: "6%", top: "64%", delay: 1.2 },
        { left: "18%", top: "68%", delay: 2.1 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb4d9]/75 shadow-[0_0_10px_rgba(255,120,180,0.55)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.2, 0.75, 0.2], y: [0, -8, 0] }}
          transition={{
            duration: 5 + (index % 2),
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </motion.div>
  );
}

interface ProfileSetupTopBarProps {
  progressPercent: number;
}

function ProfileSetupTopBar({ progressPercent }: ProfileSetupTopBarProps) {
  return (
    <header
      className={cn(
        "relative z-50 shrink-0 border-b border-white/[0.08] bg-[#070815]/72 backdrop-blur-2xl",
        "shadow-[inset_0_-1px_0_rgba(255,78,145,0.12)] supports-[backdrop-filter]:bg-[#070815]/50",
      )}
      style={{ height: ONBOARDING_NAV_H }}
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#FF4E91]/25 to-transparent"
        animate={{ opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <motion.div
        className="mx-auto flex h-full max-w-[1200px] flex-col justify-center gap-3 px-4 py-3 sm:px-6 lg:px-8 md:hidden"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between gap-3">
          <motion.div
            className="flex min-w-0 items-center gap-2.5"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <img
              src={SOLACE_LOGO_SRC}
              alt="Solace"
              className="h-8 w-auto object-contain"
            />
            <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden />
            <span className="text-sm font-medium tracking-wide text-white/90">Solace</span>
          </motion.div>
          <p className="shrink-0 text-xs text-violet-200/65">
            Step {CURRENT_STEP} of {TOTAL_STEPS}
          </p>
        </div>
        <motion.div
          className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      </motion.div>

      <div className="mx-auto hidden h-full max-w-[1200px] items-center gap-6 px-6 lg:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center gap-3">
          <img
            src={SOLACE_LOGO_SRC}
            alt="Solace"
            className="h-9 w-auto object-contain"
          />
          <span className="h-6 w-px bg-white/15" aria-hidden />
          <span className="text-[15px] font-medium tracking-wide text-white/92">Solace</span>
        </div>

        <div className="px-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
        </div>

        <p className="shrink-0 text-sm text-violet-200/65">
          Step {CURRENT_STEP} of {TOTAL_STEPS}
        </p>
      </div>
    </header>
  );
}

export function OnboardingProfileSetup() {
  const navigate = useNavigate();
  const { data, updateData, completeOnboarding } = useOnboarding();
  const { user, profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTimezones] = useState<string[]>((Intl as any).supportedValuesOf("timeZone"));

  const form = useForm<ProfileSetupValues>({
    resolver: zodResolver(profileSetupSchema as any),
    mode: "onChange",
    defaultValues: {
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      pronouns: data.pronouns || "",
      phone: normalizeStoredPhoneForInput(
        data.phone || (profile as { phone?: string } | null)?.phone || "",
      ),
      age: data.age || "",
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  useEffect(() => {
    if (data.firstName) form.setValue("firstName", data.firstName);
    if (data.lastName) form.setValue("lastName", data.lastName);
    if (data.pronouns) form.setValue("pronouns", data.pronouns);
    if (data.phone !== undefined) {
      form.setValue("phone", normalizeStoredPhoneForInput(data.phone));
    }
    if (data.age) form.setValue("age", data.age);
    if (data.timezone) form.setValue("timezone", data.timezone);
    else {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      form.setValue("timezone", detected);
    }
  }, [data, form]);

  useEffect(() => {
    if (user?.user_metadata) {
      const { full_name, name, avatar_url, picture, first_name, last_name } = user.user_metadata;
      const updates: Record<string, string> = {};
      let hasUpdates = false;

      const currentValues = form.getValues();

      if (!data.firstName && !currentValues.firstName && first_name) {
        form.setValue("firstName", first_name);
        updates.firstName = first_name;
        hasUpdates = true;
      }

      if (!data.lastName && !currentValues.lastName && last_name) {
        form.setValue("lastName", last_name);
        updates.lastName = last_name;
        hasUpdates = true;
      }

      if (!data.firstName && !currentValues.firstName && !first_name && (full_name || name)) {
        const fullName = full_name || name;
        const parts = fullName.split(" ");
        const first = parts[0];
        const last = parts.slice(1).join(" ");
        form.setValue("firstName", first);
        form.setValue("lastName", last);
        updates.firstName = first;
        updates.lastName = last;
        hasUpdates = true;
      }

      if (!data.avatar_url && (avatar_url || picture)) {
        const url = avatar_url || picture;
        updates.avatar_url = url;
        hasUpdates = true;
      }

      if (hasUpdates) {
        updateData(updates);
      }
    }
  }, [user, data, form, updateData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!user) {
        toast.error("User not found");
        return;
      }

      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      updateData({ avatar_url: publicUrl });
      toast.success("Profile photo uploaded!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error uploading image");
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (values: ProfileSetupValues) => {
    setIsLoading(true);
    try {
      await api.updateProfile({
        first_name: values.firstName,
        last_name: values.lastName,
        full_name: `${values.firstName} ${values.lastName}`,
        pronouns: values.pronouns || "",
        ...(values.phone?.trim() ? { phone: values.phone.trim() } : {}),
        age: values.age,
        timezone: values.timezone,
      });

      updateData({
        firstName: values.firstName,
        lastName: values.lastName,
        pronouns: values.pronouns,
        phone: values.phone?.trim() || "",
        age: values.age,
        timezone: values.timezone,
      });

      const selectedPlan =
        typeof window !== "undefined" ? window.localStorage.getItem("selectedPlan") : null;

      if (selectedPlan === "trial") {
        await completeOnboarding("/app/dashboard", {
          firstName: values.firstName,
          lastName: values.lastName,
          pronouns: values.pronouns,
          phone: values.phone?.trim() || "",
          age: values.age,
          timezone: values.timezone,
          selectedPlan: "trial",
          signupType: "trial",
        });
        setIsLoading(false);
        return;
      }

      const planPurchased =
        typeof window !== "undefined"
          ? window.localStorage.getItem("planPurchased") === "1"
          : false;

      if (planPurchased) {
        navigate("/onboarding/wellness-baseline");
      } else {
        navigate("/onboarding/subscription");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("Failed to update profile");
      setIsLoading(false);
    }
  };

  const pronounOptions = [
    { value: "he/him", label: "He/Him" },
    { value: "she/her", label: "She/Her" },
    { value: "they/them", label: "They/Them" },
    { value: "prefer-not-to-say", label: "Prefer not to say" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070815] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <ProfileSetupSceneBackdrop />
      <ProfileSetupTopBar progressPercent={PROGRESS_PERCENT} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[900px] flex-col items-center px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 md:px-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <header className="mb-6 text-center sm:mb-8">
            <h1 className="solace-login-serif inline-flex flex-wrap items-center justify-center gap-2 text-[clamp(1.85rem,4.2vw,2.75rem)] font-medium leading-[1.12] text-[#FDFDFD] drop-shadow-[0_2px_28px_rgba(0,0,0,0.45)]">
              Tell Us About Yourself
              <Sparkles
                className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_12px_rgba(255,78,145,0.55)] sm:h-6 sm:w-6"
                aria-hidden
              />
            </h1>
            <p className="mt-2 text-[clamp(0.95rem,1.8vw,1.1rem)] leading-relaxed text-violet-200/72">
              Help us personalize your{" "}
              <span className="font-medium text-[#FF4E91]">Solace</span> experience
            </p>
          </header>

          <motion.div
            className={cn(
              "w-full rounded-[28px] border border-[#8A4FFF]/28 bg-[#0A0B1E]/52 p-6 backdrop-blur-2xl sm:p-10 md:p-12",
              "shadow-[0_0_0_1px_rgba(255,78,145,0.1),0_28px_72px_-32px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]",
            )}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.55, ease: "easeOut" }}
          >
            <Form {...form}>
              <form className="space-y-6 sm:space-y-7" onSubmit={form.handleSubmit(onSubmit)}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="flex flex-col items-center"
                >
                  <input
                    type="file"
                    id="profile-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                  <button
                    type="button"
                    className="group relative cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4E91]/45"
                    onClick={() => document.getElementById("profile-upload")?.click()}
                    aria-label="Upload profile photo"
                  >
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative"
                    >
                      <motion.div
                        className="absolute -inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,78,145,0.28)_0%,transparent_70%)] blur-md"
                        animate={{ opacity: [0.5, 0.85, 0.5] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        aria-hidden
                      />
                      <motion.div
                        className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[#8A4FFF]/35 bg-gradient-to-br from-[#8A4FFF]/25 to-[#FF4E91]/20 shadow-[0_0_32px_-8px_rgba(138,79,255,0.45)] sm:h-[104px] sm:w-[104px]"
                        animate={{ boxShadow: ["0 0 28px -8px rgba(138,79,255,0.4)", "0 0 36px -6px rgba(255,78,145,0.35)", "0 0 28px -8px rgba(138,79,255,0.4)"] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {data.avatar_url ? (
                          <img
                            src={data.avatar_url}
                            alt="Profile"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="h-11 w-11 text-[#d8b4fe]" strokeWidth={1.5} />
                        )}
                      </motion.div>
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-[#FF4E91]/40 bg-gradient-to-br from-[#FF4E91] to-[#8A4FFF] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)] transition-transform group-hover:scale-105">
                        {isUploading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                          <Camera className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </motion.div>
                  </button>
                  <p className="mt-3 text-sm text-violet-200/58">
                    Add a profile photo (optional)
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16 }}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2"
                >
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={onboardingLabelClass}>First Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John"
                            className={onboardingInputClass}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={onboardingLabelClass}>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" className={onboardingInputClass} {...field} />
                        </FormControl>
                        <FormMessage className="text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <FormField
                    control={form.control}
                    name="pronouns"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={onboardingLabelClass}>
                          Pronouns (optional)
                        </FormLabel>
                        <FormControl>
                          <motion.div
                            className="flex flex-wrap gap-2"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: {},
                              visible: { transition: { staggerChildren: 0.04 } },
                            }}
                          >
                            {pronounOptions.map((option) => {
                              const isActive = field.value === option.value;
                              return (
                                <motion.button
                                  key={option.value}
                                  type="button"
                                  variants={{
                                    hidden: { opacity: 0, y: 6 },
                                    visible: { opacity: 1, y: 0 },
                                  }}
                                  onClick={() => field.onChange(option.value)}
                                  className={cn(
                                    "rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all duration-200 sm:px-4",
                                    isActive
                                      ? "border-[#FF4E91]/50 bg-gradient-to-r from-[#FF4E91]/25 via-[#d946ef]/20 to-[#8A4FFF]/25 text-white shadow-[0_0_20px_-6px_rgba(255,78,145,0.45)]"
                                      : "border-violet-400/22 bg-[#0b0c20]/45 text-violet-100/75 hover:border-[#8A4FFF]/35 hover:bg-[#12132e]/55 hover:text-white/90",
                                  )}
                                >
                                  {option.label}
                                </motion.button>
                              );
                            })}
                          </motion.div>
                        </FormControl>
                        <FormMessage className="text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.24 }}
                >
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={onboardingLabelClass}>Phone (optional)</FormLabel>
                        <p className="-mt-0.5 mb-2 text-xs text-violet-200/48">
                          Select your country from the dropdown, then enter your local number.
                        </p>
                        <FormControl>
                          <PhoneInput
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            placeholder="Your phone number"
                            buttonClassName={onboardingPhoneButtonClass}
                            inputClassName={onboardingInputClass}
                          />
                        </FormControl>
                        <FormMessage className="text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.28 }}
                >
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={onboardingLabelClass}>Age *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="18"
                            className={onboardingInputClass}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-violet-200/48">Enter your age</p>
                        <FormMessage className="text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32 }}
                >
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={onboardingLabelClass}>Timezone</FormLabel>
                        <FormControl>
                          <SolaceSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            ariaLabel="Timezone"
                            variant="form"
                            triggerClassName={onboardingInputClass}
                            options={availableTimezones.map((tz) => ({
                              value: tz,
                              label: tz.replace(/_/g, " "),
                            }))}
                          />
                        </FormControl>
                        <FormMessage className="text-[13px] text-[#ff8ab8]" />
                      </FormItem>
                    )}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.36 }}
                  className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <Link to="/onboarding/welcome" className="w-full sm:w-auto sm:min-w-[140px]">
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "flex h-14 w-full items-center justify-center gap-2 rounded-[18px] border border-white/10",
                        "bg-[#0b0c20]/55 px-6 text-[15px] font-medium text-white/88 backdrop-blur-md",
                        "transition-[border-color,box-shadow] duration-200",
                        "hover:border-violet-400/30 hover:bg-[#12132e]/65",
                      )}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </motion.button>
                  </Link>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "flex h-14 w-full items-center justify-center gap-2 rounded-[18px] px-6 sm:min-w-[200px] sm:flex-1",
                      "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] text-[15px] font-semibold text-white",
                      "shadow-[0_0_40px_-8px_rgba(255,78,145,0.65)]",
                      "transition-[box-shadow,opacity] duration-300 hover:shadow-[0_0_52px_-6px_rgba(138,79,255,0.55)]",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </form>
            </Form>
          </motion.div>

          <motion.footer
            className="mt-6 flex max-w-[min(520px,92vw)] flex-col items-center gap-1.5 text-center sm:mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42, duration: 0.5 }}
          >
            <motion.div className="flex items-center gap-2 text-violet-200/50">
              <Shield className="h-4 w-4 text-[#FF4E91]/70" aria-hidden />
              <p className="text-[13px] font-medium text-violet-100/55">
                Your privacy is important to us.
              </p>
            </motion.div>
            <p className="text-[12px] leading-relaxed text-violet-200/42">
              Everything you share is encrypted and secure.
            </p>
          </motion.footer>
        </motion.div>
      </main>
    </motion.div>
  );
}

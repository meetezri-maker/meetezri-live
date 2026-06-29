import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Heart,
  LifeBuoy,
  Loader2,
  Lock,
  MessageCircle,
  Phone,
  Plus,
  ShieldAlert,
  Sparkles,
  Siren,
  User,
  Users,
} from "lucide-react";
import { type ReactNode, useState, useEffect, useMemo } from "react";
import { useOnboarding } from "@/app/contexts/OnboardingContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { useOnboardingResume } from "@/app/hooks/useOnboardingResume";
import { api } from "@/lib/api";
import { toast } from "sonner";
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
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { normalizeStoredPhoneForInput } from "@/lib/normalizeStoredPhone";
import {
  isValidRequiredAppPhone,
  PHONE_INPUT_HELPER_TEXT,
  REQUIRED_PHONE_VALIDATION_MESSAGE,
} from "@meetezri/shared";
import { ONBOARDING_EMERGENCY_CONTACT_BG } from "@/lib/solace/referenceImagery";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_ON_DARK_BG } from "@/app/components/BrandLogo";
import { SolaceSelect } from "@/app/solace";
import {
  fetchUserGeo,
  getSafetyResources,
  resolveActiveCountryCode,
  setUserCountryCode,
  setUserCountryFromPhone,
} from "@/app/utils/safetyResources";
import { getCountryHotlineEntry } from "@/app/data/crisisHotlinesByCountry";
import type { SafetyResource } from "@/app/types/safety";
import "./onboarding-sanctuary-ui.css";

const SOLACE_LOGO_SRC = BRAND_LOGO_ON_DARK_BG;
const ONBOARDING_NAV_H = "4.5rem";
const CURRENT_STEP = 7;
const TOTAL_STEPS = 8;
const PROGRESS_PERCENT = (CURRENT_STEP / TOTAL_STEPS) * 100;

const RELATIONSHIP_PRESETS = [
  { value: "parent", label: "Parent" },
  { value: "partner", label: "Partner/Spouse" },
  { value: "sibling", label: "Sibling" },
  { value: "friend", label: "Friend" },
  { value: "other-family", label: "Other Family" },
  { value: "other", label: "Other" },
] as const;

const PRESET_RELATIONSHIP_VALUES = RELATIONSHIP_PRESETS.map((option) => option.value).filter(
  (value) => value !== "other",
);

function parseSavedRelationship(saved: string | undefined) {
  const trimmed = (saved ?? "").trim();
  if (!trimmed) {
    return { emergencyRelationship: "", emergencyRelationshipCustom: "" };
  }
  if ((PRESET_RELATIONSHIP_VALUES as readonly string[]).includes(trimmed)) {
    return { emergencyRelationship: trimmed, emergencyRelationshipCustom: "" };
  }
  return { emergencyRelationship: "other", emergencyRelationshipCustom: trimmed };
}

const emergencyContactSchema = z
  .object({
    emergencyName: z.string().trim().min(2, "Emergency contact name is required"),
    emergencyPhone: z
      .string()
      .trim()
      .min(1, "Phone is required when adding an emergency contact")
      .refine((v) => v.startsWith("+"), {
        message: "Select a country from the dropdown first",
      })
      .refine((v) => isValidRequiredAppPhone(v), {
        message: REQUIRED_PHONE_VALIDATION_MESSAGE,
      }),
    emergencyRelationship: z.string().trim().min(1, "Please select a relationship"),
    emergencyRelationshipCustom: z.string().trim().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.emergencyRelationship === "other") {
      const custom = values.emergencyRelationshipCustom?.trim() ?? "";
      if (custom.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["emergencyRelationshipCustom"],
          message: "Please describe the relationship",
        });
      }
    }
  });

type EmergencyContactValues = z.infer<typeof emergencyContactSchema>;

function resolveRelationshipForSave(values: EmergencyContactValues): string {
  if (values.emergencyRelationship === "other") {
    return values.emergencyRelationshipCustom?.trim() ?? "";
  }
  return values.emergencyRelationship.trim();
}

const glassCardClass = cn(
  "relative w-full rounded-[28px] border border-[#FF4E91]/20 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(138,79,255,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-[#FF4E91]/32 hover:shadow-[0_0_40px_-16px_rgba(255,78,145,0.35)]",
);

const crisisCardClass = cn(
  "relative w-full rounded-[26px] border border-[#FF4E91]/28 bg-[#0A0B1E]/52 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(255,78,145,0.12),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-[#FF4E91]/38 hover:shadow-[0_0_44px_-14px_rgba(255,78,145,0.4)]",
);

const resourcesCardClass = cn(
  "relative w-full rounded-[28px] border border-cyan-400/22 bg-[#0A0B1E]/48 backdrop-blur-2xl",
  "shadow-[0_0_0_1px_rgba(56,189,248,0.1),0_28px_72px_-32px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow] duration-300 hover:border-cyan-400/35 hover:shadow-[0_0_40px_-16px_rgba(56,189,248,0.28)]",
);

const onboardingInputClass = cn(
  "h-11 w-full rounded-[16px] border border-violet-400/22 bg-[#0b0c20]/60 pl-11 text-[15px] text-white/92",
  "placeholder:text-violet-300/38 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow,background-color] duration-200",
  "focus:border-[#FF4E91]/50 focus:bg-[#10122a]/75 focus:outline-none focus:ring-2 focus:ring-[#FF4E91]/18",
);

const onboardingSelectClass = cn(
  "!h-11 !w-full cursor-pointer appearance-none rounded-[16px] !border-violet-400/22 !bg-[#0b0c20]/60 pl-11 pr-10 text-[15px] !text-white/92",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
  "transition-[border-color,box-shadow,background-color] duration-200",
  "hover:!border-[#FF4E91]/35 hover:!bg-[#12132e]/75",
  "focus:!border-[#FF4E91]/50 focus:!bg-[#10122a]/75 focus:outline-none focus:ring-2 focus:ring-[#FF4E91]/18",
  "data-[placeholder]:!text-violet-300/38",
  "[&>svg:last-child]:!text-violet-300/80",
);

const onboardingLabelClass = "text-[13px] font-medium tracking-wide text-white/88";

const onboardingPhoneButtonClass = cn(
  "!h-11 shrink-0 justify-between rounded-[16px] !border-violet-400/22 !bg-[#0b0c20]/60 px-3 !text-white/90",
  "hover:!bg-[#12132e]/75 hover:!text-white focus-visible:!border-[#FF4E91]/50 focus-visible:ring-[#FF4E91]/18",
);

const onboardingDropdownPopover = cn(
  "onboarding-sanctuary-popover z-[200] overflow-visible rounded-xl border border-white/[0.1] p-1 pb-0 backdrop-blur-xl",
  "shadow-[0_28px_60px_-12px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.12)]",
);

const onboardingDropdownCommand = "overflow-visible rounded-lg !bg-transparent !text-zinc-200";

const onboardingDropdownCommandInput = cn(
  "h-10 border-0 border-b border-white/10 !bg-transparent text-sm !text-zinc-100",
  "placeholder:!text-zinc-500",
  "[&_[cmdk-input-wrapper]]:rounded-t-lg [&_[cmdk-input-wrapper]]:border-white/10",
  "[&_[cmdk-input-wrapper]_svg]:text-zinc-500",
);

const onboardingDropdownCommandList = "max-h-[min(280px,50vh)]";

const onboardingDropdownCommandItem = cn(
  "rounded-lg !text-zinc-200",
  "data-[selected=true]:!bg-violet-500/20 data-[selected=true]:!text-violet-50",
  "aria-selected:!bg-violet-500/20 aria-selected:!text-violet-50",
);

const onboardingDropdownCommandEmpty = "py-6 text-center text-sm !text-zinc-500";

const onboardingSelectContentClass = cn(
  "onboarding-sanctuary-select-content",
  "z-[200] max-h-[min(280px,var(--radix-select-content-available-height))] overflow-hidden rounded-xl border border-white/[0.1] p-1.5 backdrop-blur-xl",
  "shadow-[0_28px_60px_-12px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.12)]",
);

const phoneFieldHint =
  PHONE_INPUT_HELPER_TEXT;

type CrisisDisplayItem = {
  icon: typeof Phone;
  label: string;
  detail: string;
  iconClass: string;
  ring: string;
};

function resourceToCrisisItem(resource: SafetyResource, index: number): CrisisDisplayItem {
  const icon =
    resource.type === "text_line"
      ? MessageCircle
      : resource.type === "emergency"
        ? Siren
        : Phone;
  const styles = [
    {
      iconClass: "text-[#fda4cf]",
      ring: "from-[#FF4E91]/45 to-pink-900/20",
    },
    {
      iconClass: "text-violet-300",
      ring: "from-violet-400/50 to-purple-900/25",
    },
    {
      iconClass: "text-rose-300",
      ring: "from-rose-400/50 to-rose-900/20",
    },
  ];
  const style = styles[index % styles.length];
  return {
    icon,
    label: `${resource.name}:`,
    detail: resource.phone
      ? resource.type === "text_line"
        ? `Text or call ${resource.phone}`
        : `Call ${resource.phone}`
      : resource.description,
    ...style,
  };
}

function buildOnboardingCrisisLists(resources: SafetyResource[]) {
  const urgentResources = resources
    .filter((r) => r.type === "emergency" || r.type === "crisis_line" || r.type === "text_line")
    .slice(0, 3);
  const urgentIds = new Set(urgentResources.map((r) => r.id));
  const urgent = urgentResources.map(resourceToCrisisItem);
  const more = resources
    .filter((r) => !urgentIds.has(r.id))
    .slice(0, 4)
    .map((r) => ({
      label: `${r.name}:`,
      detail: r.phone ? r.phone : r.description,
    }));
  return { urgent, more };
}

function EmergencyContactSceneBackdrop() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.1, ease: "easeOut" }}
    >
      <img
        src={ONBOARDING_EMERGENCY_CONTACT_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_38%]"
        width={2400}
        height={1350}
        fetchPriority="high"
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_40%,rgba(177,77,255,0.22)_0%,transparent_58%)]"
        animate={{ opacity: [0.5, 0.78, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_48%_at_50%_68%,rgba(255,78,145,0.16)_0%,transparent_62%)]"
        animate={{ opacity: [0.42, 0.7, 0.42] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_100%,rgba(5,6,18,0.94)_0%,transparent_52%)]"
        animate={{ opacity: [0.88, 1, 0.88] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_50%_0%,rgba(7,8,21,0.8)_0%,transparent_48%)]"
        animate={{ opacity: [0.72, 0.92, 0.72] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_42%,rgba(138,79,255,0.12)_0%,transparent_55%)]"
        animate={{ opacity: [0.55, 0.82, 0.55] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_42%,rgba(10,11,30,0.15)_0%,rgba(7,8,21,0.78)_100%)]"
        animate={{ opacity: [0.75, 0.9, 0.75] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div className="absolute inset-0 bg-[#070815]/52" />
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_24%,rgba(0,0,0,0.68)_100%)]"
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {[
        { left: "6%", top: "56%", delay: 0 },
        { left: "18%", top: "64%", delay: 0.8 },
        { left: "32%", top: "60%", delay: 1.5 },
        { left: "48%", top: "66%", delay: 0.4 },
        { left: "62%", top: "62%", delay: 1.1 },
        { left: "76%", top: "68%", delay: 1.9 },
        { left: "90%", top: "58%", delay: 2.2 },
        { left: "12%", top: "42%", delay: 1.3 },
        { left: "84%", top: "46%", delay: 0.6 },
        { left: "44%", top: "38%", delay: 1.7 },
        { left: "58%", top: "34%", delay: 0.9 },
      ].map((particle, index) => (
        <motion.span
          key={index}
          className="absolute h-1 w-1 rounded-full bg-[#ffb4d9]/80 shadow-[0_0_10px_rgba(255,120,180,0.6)]"
          style={{ left: particle.left, top: particle.top }}
          animate={{ opacity: [0.15, 0.75, 0.15], y: [0, -7, 0] }}
          transition={{
            duration: 4.8 + (index % 3),
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay,
          }}
        />
      ))}
    </motion.div>
  );
}

interface EmergencyContactTopBarProps {
  progressPercent: number;
  onBack: () => void;
}

function EmergencyContactTopBar({ progressPercent, onBack }: EmergencyContactTopBarProps) {
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
        <motion.div className="flex items-center justify-between gap-3">
          <motion.div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <img src={SOLACE_LOGO_SRC} alt="Solace" className="h-8 w-auto object-contain" />
            <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden />
            <span className="text-sm font-medium tracking-wide text-white/90">Solace</span>
          </motion.div>
          <p className="shrink-0 text-xs text-violet-200/65">
            Step {CURRENT_STEP} of {TOTAL_STEPS}
          </p>
        </motion.div>
        <motion.div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#34d399] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
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

      <motion.div
        className="mx-auto hidden h-full max-w-[1200px] items-center gap-4 px-6 lg:px-8 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto]"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={SOLACE_LOGO_SRC} alt="Solace" className="h-9 w-auto object-contain" />
          <span className="h-6 w-px bg-white/15" aria-hidden />
          <span className="text-[15px] font-medium tracking-wide text-white/92">Solace</span>
        </motion.div>

        <motion.div className="px-2">
          <motion.div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04] backdrop-blur-sm">
            <motion.div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#34d399] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
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

        <p className="shrink-0 text-sm text-violet-200/65">
          Step {CURRENT_STEP} of {TOTAL_STEPS}
        </p>
      </motion.div>
    </header>
  );
}

interface GlowingOrbProps {
  children: ReactNode;
  glowClass?: string;
  size?: "sm" | "md" | "lg";
}

function GlowingOrb({ children, glowClass, size = "md" }: GlowingOrbProps) {
  const sizeClass =
    size === "sm" ? "h-11 w-11" : size === "lg" ? "h-[88px] w-[88px]" : "h-14 w-14";
  return (
    <motion.div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0A0B1E]/70 backdrop-blur-md",
        sizeClass,
        glowClass,
      )}
      animate={{
        boxShadow: [
          "0 0 32px -8px rgba(255,78,145,0.35)",
          "0 0 48px -4px rgba(138,79,255,0.45)",
          "0 0 32px -8px rgba(255,78,145,0.35)",
        ],
      }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="pointer-events-none absolute inset-1 rounded-full bg-gradient-to-br from-[#FF4E91]/25 via-[#8A4FFF]/20 to-transparent opacity-80"
        animate={{ opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div className="relative z-[1]">{children}</motion.div>
    </motion.div>
  );
}

export function OnboardingEmergencyContact() {
  const { data, updateData } = useOnboarding();
  const { profile } = useAuth();
  const { resume, finishStep, goBack } = useOnboardingResume();
  const [isLoading, setIsLoading] = useState(false);

  const [isSafetyPlanOpen, setIsSafetyPlanOpen] = useState(false);
  const [warningSigns, setWarningSigns] = useState(data.safetyPlan?.warningSigns || "");
  const [copingStrategies, setCopingStrategies] = useState(
    data.safetyPlan?.copingStrategies || "",
  );
  const [supportContacts, setSupportContacts] = useState(
    data.safetyPlan?.supportContacts || "",
  );

  const savedRelationship = parseSavedRelationship(data.emergencyContactRelationship);

  const form = useForm<EmergencyContactValues>({
    resolver: zodResolver(emergencyContactSchema),
    mode: "onChange",
    defaultValues: {
      emergencyName: data.emergencyContactName || "",
      emergencyPhone: normalizeStoredPhoneForInput(data.emergencyContactPhone || ""),
      emergencyRelationship: savedRelationship.emergencyRelationship,
      emergencyRelationshipCustom: savedRelationship.emergencyRelationshipCustom,
    },
  });

  const { isValid: isFormValid } = form.formState;
  const relationshipChoice = form.watch("emergencyRelationship");
  const watchedPhone = form.watch("emergencyPhone");
  form.watch(["emergencyName", "emergencyPhone", "emergencyRelationship", "emergencyRelationshipCustom"]);

  const [countryHint, setCountryHint] = useState<string | null>(() => {
    const code = resolveActiveCountryCode();
    return code ? getCountryHotlineEntry(code)?.countryName ?? null : null;
  });

  useEffect(() => {
    void fetchUserGeo().then(() => {
      const code = resolveActiveCountryCode();
      setCountryHint(code ? getCountryHotlineEntry(code)?.countryName ?? null : null);
    });
  }, []);

  useEffect(() => {
    if (watchedPhone) {
      setUserCountryFromPhone(watchedPhone);
      const code = resolveActiveCountryCode();
      setCountryHint(code ? getCountryHotlineEntry(code)?.countryName ?? null : null);
    }
  }, [watchedPhone]);

  const { urgent: crisisResources, more: moreCrisisResources } = useMemo(
    () => buildOnboardingCrisisLists(getSafetyResources()),
    [countryHint, watchedPhone],
  );

  useEffect(() => {
    if (!resume || !profile) return;
    const saved = parseSavedRelationship(profile.emergency_contact_relationship || "");
    form.reset({
      emergencyName: profile.emergency_contact_name || "",
      emergencyPhone: normalizeStoredPhoneForInput(profile.emergency_contact_phone || ""),
      emergencyRelationship: saved.emergencyRelationship,
      emergencyRelationshipCustom: saved.emergencyRelationshipCustom,
    });
  }, [resume, profile, form]);

  const onSubmit = async (values: EmergencyContactValues) => {
    setIsLoading(true);
    try {
      const relationship = resolveRelationshipForSave(values);
      if (resume) {
        await api.updateProfile({
          emergency_contact_name: values.emergencyName,
          emergency_contact_phone: values.emergencyPhone,
          emergency_contact_relationship: relationship,
        });
      }
      updateData({
        emergencyContactName: values.emergencyName,
        emergencyContactPhone: values.emergencyPhone,
        emergencyContactRelationship: relationship,
      });
      finishStep("/onboarding/permissions");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't save — try again");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSafetyPlan = () => {
    updateData({
      safetyPlan: {
        warningSigns,
        copingStrategies,
        supportContacts,
        createdAt: new Date().toISOString(),
      },
    });
    setIsSafetyPlanOpen(false);
    toast.success("Safety plan saved successfully");
  };

  const handleTopBack = () => goBack("/onboarding/avatar-preferences");

  return (
    <motion.div
      className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#070815] text-[#FDFDFD]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <EmergencyContactSceneBackdrop />
      <EmergencyContactTopBar progressPercent={PROGRESS_PERCENT} onBack={handleTopBack} />

      <main className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.div
          className="mx-auto flex w-full max-w-[960px] flex-col items-center px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 md:px-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* 1. Title section */}
          <header className="mb-6 text-center sm:mb-8">
            <h1 className="solace-login-serif inline-flex flex-wrap items-center justify-center gap-2 text-[clamp(2.625rem,5vw,3.625rem)] font-medium leading-[1.08] text-[#FDFDFD] drop-shadow-[0_0_32px_rgba(255,78,145,0.2),0_2px_28px_rgba(0,0,0,0.45)]">
              Emergency Contact
              <Sparkles
                className="h-5 w-5 text-[#FF4E91] drop-shadow-[0_0_12px_rgba(255,78,145,0.55)] sm:h-6 sm:w-6"
                aria-hidden
              />
            </h1>
            <p className="mt-2 text-[clamp(1rem,1.9vw,1.2rem)] leading-relaxed text-violet-200/72">
              Help us keep you safe (required)
            </p>
          </header>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex w-full flex-col gap-5 sm:gap-6"
            >
              {/* 2. Urgent crisis resources card */}
              <motion.section
                className={cn(crisisCardClass, "p-6 sm:p-8 md:p-9")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-[26px] bg-[radial-gradient(ellipse_70%_50%_at_12%_50%,rgba(255,78,145,0.1)_0%,transparent_55%)]"
                  aria-hidden
                />
                <div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(120px,160px)_1fr] md:gap-8">
                  <motion.div className="mx-auto flex justify-center md:mx-0">
                    <GlowingOrb
                      size="lg"
                      glowClass="shadow-[0_0_48px_-8px_rgba(255,78,145,0.55)] ring-1 ring-[#FF4E91]/30"
                    >
                      <ShieldAlert
                        className="h-9 w-9 text-[#fda4cf] drop-shadow-[0_0_14px_rgba(255,78,145,0.55)]"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    </GlowingOrb>
                  </motion.div>
                  <motion.div className="min-w-0">
                    <p className="mb-4 text-center text-[16px] font-semibold text-white/94 md:text-left sm:text-[17px]">
                      If you&apos;re in an Emergency right now
                      {countryHint ? ` (${countryHint})` : ""}:
                    </p>
                    <ul className="space-y-3.5">
                      {crisisResources.map((item) => {
                        const Icon = item.icon;
                        return (
                          <li key={item.label} className="flex items-start gap-3">
                            <motion.div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/35 ring-1 ring-white/[0.06]">
                              <motion.div
                                className={cn(
                                  "pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-45 blur-[1px]",
                                  item.ring,
                                )}
                              />
                              <Icon
                                className={cn("relative z-[1] h-4 w-4", item.iconClass)}
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            </motion.div>
                            <p className="pt-0.5 text-[14px] leading-relaxed text-violet-100/78 sm:text-[15px]">
                              <strong className="font-semibold text-white/92">{item.label}</strong>{" "}
                              <span className="text-violet-100/65">{item.detail}</span>
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>
                </div>
              </motion.section>

              {/* 3. Trusted Contact Person form card */}
              <motion.section
                className={cn(glassCardClass, "p-6 sm:p-8 md:p-10")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_70%_50%_at_18%_50%,rgba(255,78,145,0.08)_0%,transparent_55%)]"
                  aria-hidden
                />
                <div className="relative">
                  <div className="mb-6 flex items-start gap-4">
                    <GlowingOrb
                      size="sm"
                      glowClass="shadow-[0_0_28px_-6px_rgba(138,79,255,0.5)] ring-1 ring-violet-400/25"
                    >
                      <Users
                        className="h-5 w-5 text-violet-300"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </GlowingOrb>
                    <motion.div className="min-w-0 flex-1 pt-0.5">
                      <h2 className="text-[17px] font-semibold text-white/94 sm:text-lg">
                        Trusted Contact Person
                      </h2>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-violet-100/68 sm:text-[14px]">
                        Add someone we can notify if you&apos;re in an Emergency (we&apos;ll only
                        contact them with your permission or in emergencies)
                      </p>
                    </motion.div>
                  </div>

                  <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-5">
                    <FormField
                      control={form.control}
                      name="emergencyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={onboardingLabelClass}>Contact Name</FormLabel>
                          <p className="-mt-0.5 mb-1.5 text-xs text-transparent select-none" aria-hidden>
                            {phoneFieldHint}
                          </p>
                          <FormControl>
                            <div className="relative">
                              <User
                                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300/55"
                                aria-hidden
                              />
                              <Input
                                placeholder="e.g., Mom, Best Friend, Partner"
                                className={onboardingInputClass}
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-[13px] text-[#ff8ab8]" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={onboardingLabelClass}>Phone Number</FormLabel>
                          <p className="-mt-0.5 mb-1.5 text-xs text-violet-200/48">{phoneFieldHint}</p>
                          <FormControl>
                            <PhoneInput
                              value={field.value}
                              onChange={field.onChange}
                              onCountryCodeChange={(code) => {
                                setUserCountryCode(code);
                                setCountryHint(getCountryHotlineEntry(code)?.countryName ?? null);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              placeholder="Phone number"
                              buttonClassName={onboardingPhoneButtonClass}
                              inputClassName={cn(onboardingInputClass, "pl-4")}
                              popoverClassName={onboardingDropdownPopover}
                              commandClassName={onboardingDropdownCommand}
                              commandInputClassName={onboardingDropdownCommandInput}
                              commandListClassName={onboardingDropdownCommandList}
                              commandItemClassName={onboardingDropdownCommandItem}
                              commandEmptyClassName={onboardingDropdownCommandEmpty}
                            />
                          </FormControl>
                          <FormMessage className="text-[13px] text-[#ff8ab8]" />
                        </FormItem>
                      )}
                    />
                  </motion.div>

                  <div className="mt-4 space-y-4 md:mt-5">
                    <FormField
                      control={form.control}
                      name="emergencyRelationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="emergencyRelationship" className={onboardingLabelClass}>
                            Relationship
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Heart
                                className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-violet-300/55"
                                aria-hidden
                              />
                              <SolaceSelect
                                id="emergencyRelationship"
                                value={field.value}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  if (value !== "other") {
                                    form.setValue("emergencyRelationshipCustom", "", {
                                      shouldValidate: true,
                                    });
                                  }
                                }}
                                ariaLabel="Relationship"
                                placeholder="Select relationship"
                                variant="form"
                                triggerClassName={cn(
                                  onboardingSelectClass,
                                  "onboarding-sanctuary-select-trigger pl-10",
                                )}
                                contentClassName={onboardingSelectContentClass}
                                itemClassName="!text-zinc-200 data-[highlighted]:!bg-violet-500/20 data-[highlighted]:!text-violet-50 data-[state=checked]:!bg-violet-500/22 data-[state=checked]:!text-violet-50"
                                options={RELATIONSHIP_PRESETS.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                }))}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-[13px] text-[#ff8ab8]" />
                        </FormItem>
                      )}
                    />

                    {relationshipChoice === "other" ? (
                      <FormField
                        control={form.control}
                        name="emergencyRelationshipCustom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="emergencyRelationshipCustom" className={onboardingLabelClass}>
                              Describe relationship
                            </FormLabel>
                            <FormControl>
                              <Input
                                id="emergencyRelationshipCustom"
                                placeholder="e.g., Cousin, Neighbor, Caregiver"
                                className={cn(onboardingInputClass, "pl-4")}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-[13px] text-[#ff8ab8]" />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </div>
                </div>
              </motion.section>

              {/* 4. Personal Safety Plan card */}
              <motion.section
                className={cn(glassCardClass, "p-6 sm:p-8 md:p-9")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.5 }}
              >
                <div className="relative flex items-start gap-4">
                  <GlowingOrb
                    size="sm"
                    glowClass="shadow-[0_0_28px_-6px_rgba(255,78,145,0.5)] ring-1 ring-[#FF4E91]/25"
                  >
                    <Heart
                      className="h-5 w-5 text-[#fda4cf]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </GlowingOrb>
                  <motion.div className="min-w-0 flex-1 pt-0.5">
                    <h2 className="text-[17px] font-semibold text-white/94 sm:text-lg">
                      Personal Safety Plan
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-violet-100/68 sm:text-[14px]">
                      Create a plan with coping strategies and resources for when you&apos;re
                      struggling
                    </p>
                  </motion.div>
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setIsSafetyPlanOpen(true)}
                  className={cn(
                    "relative mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-[#FF4E91]/45",
                    "bg-[#0b0c20]/35 px-6 py-5 text-[15px] font-medium text-[#fda4cf]",
                    "shadow-[0_0_32px_-12px_rgba(255,78,145,0.35)] backdrop-blur-sm",
                    "transition-[border-color,box-shadow,background-color] duration-200",
                    "hover:border-[#FF4E91]/60 hover:bg-[#FF4E91]/8 hover:shadow-[0_0_44px_-10px_rgba(255,78,145,0.45)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/40",
                  )}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {data.safetyPlan ? "Edit Safety Plan" : "Create Safety Plan (recommended)"}
                </motion.button>
                <p className="mt-3 text-center text-[12px] text-violet-200/48 sm:text-left sm:text-[13px]">
                  You can set this up later in your profile
                </p>
              </motion.section>

              {/* 5. More Crisis Resources card */}
              <motion.section
                className={cn(resourcesCardClass, "p-6 sm:p-8 md:p-9")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-[28px] bg-[radial-gradient(ellipse_65%_50%_at_12%_50%,rgba(56,189,248,0.08)_0%,transparent_55%)]"
                  aria-hidden
                />
                <div className="relative">
                  <motion.div className="mb-5 flex items-start gap-4">
                    <GlowingOrb
                      size="sm"
                      glowClass="shadow-[0_0_28px_-6px_rgba(56,189,248,0.45)] ring-1 ring-cyan-400/25"
                    >
                      <LifeBuoy
                        className="h-5 w-5 text-cyan-300"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </GlowingOrb>
                    <h2 className="pt-1.5 text-[17px] font-semibold text-white/94 sm:text-lg">
                      More Emergency Resources
                    </h2>
                  </motion.div>
                  <ul className="divide-y divide-white/[0.06]">
                    {moreCrisisResources.length === 0 ? (
                      <li className="py-3 text-[14px] text-violet-100/65">
                        See Emergency Resources in the app for additional support lines.
                      </li>
                    ) : (
                      moreCrisisResources.map((item) => (
                      <li key={item.label}>
                        <div
                          className={cn(
                            "flex items-center justify-between gap-3 py-3.5",
                            "transition-[background-color] duration-200",
                            "first:pt-0 last:pb-0",
                          )}
                        >
                          <p className="text-[14px] leading-relaxed text-violet-100/78 sm:text-[15px]">
                            <strong className="font-semibold text-white/92">{item.label}</strong>{" "}
                            <span className="text-violet-100/65">{item.detail}</span>
                          </p>
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-cyan-300/55"
                            aria-hidden
                          />
                        </div>
                      </li>
                      ))
                    )}
                  </ul>
                </div>
              </motion.section>

              {/* 6. Back / Continue button row */}
              <motion.div
                className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.45 }}
              >
                <Link to="/onboarding/avatar-preferences" className="w-full">
                  <motion.span
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] border border-white/10",
                      "bg-[#0b0c20]/55 px-6 text-[15px] font-medium text-white/88 backdrop-blur-md",
                      "transition-[border-color,box-shadow] duration-200",
                      "hover:border-violet-400/30 hover:bg-[#12132e]/65",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/40",
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </motion.span>
                </Link>

                <motion.button
                  type="submit"
                  disabled={!isFormValid || isLoading}
                  whileHover={isFormValid && !isLoading ? { y: -1 } : undefined}
                  whileTap={isFormValid && !isLoading ? { scale: 0.99 } : undefined}
                  className={cn(
                    "flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] px-6",
                    "bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] text-[15px] font-semibold text-white",
                    "shadow-[0_0_40px_-8px_rgba(255,78,145,0.65)]",
                    "transition-[box-shadow,opacity] duration-300",
                    "hover:shadow-[0_0_52px_-6px_rgba(138,79,255,0.55)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4E91]/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
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

          {/* 7. Required-fields footer note */}
          <motion.footer
            className="mt-4 flex flex-col items-center gap-2 text-center sm:mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.5 }}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#FF4E91]/30 bg-[#FF4E91]/10 shadow-[0_0_16px_-4px_rgba(255,78,145,0.45)]">
                <Lock
                  className="h-3.5 w-3.5 text-[#FF4E91]/85"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              <p className="text-[13px] text-violet-200/58">
                All fields are required to continue
              </p>
            </div>
          </motion.footer>
        </motion.div>
      </main>

      <Dialog open={isSafetyPlanOpen} onOpenChange={setIsSafetyPlanOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Your Safety Plan</DialogTitle>
            <DialogDescription>
              A safety plan helps you cope when you&apos;re feeling overwhelmed or unsafe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <motion.div className="space-y-2">
              <Label htmlFor="warningSigns">Warning Signs</Label>
              <p className="text-xs text-muted-foreground">
                What thoughts, feelings, or behaviors indicate you&apos;re struggling?
              </p>
              <Textarea
                id="warningSigns"
                placeholder="e.g., Feeling isolated, sleeping too much, racing thoughts..."
                value={warningSigns}
                onChange={(e) => setWarningSigns(e.target.value)}
                className="min-h-[80px]"
              />
            </motion.div>

            <motion.div className="space-y-2">
              <Label htmlFor="copingStrategies">Coping Strategies</Label>
              <p className="text-xs text-muted-foreground">
                What can you do on your own to feel better?
              </p>
              <Textarea
                id="copingStrategies"
                placeholder="e.g., Deep breathing, listening to music, going for a walk..."
                value={copingStrategies}
                onChange={(e) => setCopingStrategies(e.target.value)}
                className="min-h-[80px]"
              />
            </motion.div>

            <motion.div className="space-y-2">
              <Label htmlFor="supportContacts">Support Contacts</Label>
              <p className="text-xs text-muted-foreground">Who can you reach out to for help?</p>
              <Textarea
                id="supportContacts"
                placeholder="e.g., Partner, Therapist, Best friend..."
                value={supportContacts}
                onChange={(e) => setSupportContacts(e.target.value)}
                className="min-h-[80px]"
              />
            </motion.div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSafetyPlanOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSafetyPlan}>Save Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

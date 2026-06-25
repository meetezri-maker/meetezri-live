import { isValidRequiredAppPhone } from "@meetezri/shared";
import { paidOnboardingStepPath } from "./onboardingResume";

export type PaidOnboardingStepAction =
  | { type: "scroll"; fieldKey: string }
  | { type: "navigate"; path: string };

export interface PaidOnboardingStepStatus {
  id: string;
  title: string;
  description: string;
  missingItems: string[];
  isComplete: boolean;
  action: PaidOnboardingStepAction;
}

export interface PaidOnboardingChecklistResult {
  steps: PaidOnboardingStepStatus[];
  incompleteSteps: PaidOnboardingStepStatus[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  hasIncomplete: boolean;
}

export type PaidPlanProfile = {
  signup_type?: string | null;
  subscription_plan?: string | null;
  full_name?: string | null;
  timezone?: string | null;
  age?: string | null;
  pronouns?: string | null;
  phone?: string | null;
  current_mood?: string | null;
  selected_goals?: unknown;
  in_therapy?: string | null;
  on_medication?: string | null;
  selected_triggers?: unknown;
  selected_avatar?: string | null;
  selected_environment?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  permissions?: Record<string, unknown> | null;
  notification_preferences?: Record<string, unknown> | null;
};

const DEFAULT_AVATAR_LABELS = new Set(["", "default avatar", "default"]);
const DEFAULT_ENVIRONMENT_LABELS = new Set([
  "",
  "default environment",
  "default",
  "minimal",
]);

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isNotSpecified(value: unknown): boolean {
  if (!hasText(value)) return true;
  return String(value).trim().toLowerCase() === "not specified";
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function hasRecordKeys(value: unknown): boolean {
  return !!value && typeof value === "object" && Object.keys(value as object).length > 0;
}

function hasCompanionSelected(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized.length > 0 && !DEFAULT_AVATAR_LABELS.has(normalized);
}

function hasEnvironmentSelected(value: unknown): boolean {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized.length > 0 && !DEFAULT_ENVIRONMENT_LABELS.has(normalized);
}

function hasValidAge(value: unknown): boolean {
  if (!hasText(value)) return false;
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  const asNumber = Number.parseInt(trimmed, 10);
  return Number.isFinite(asNumber) && asNumber >= 18;
}

function hasValidEmergencyPhone(value: unknown): boolean {
  if (!hasText(value)) return false;
  return isValidRequiredAppPhone(String(value));
}

export function isTrialPlanUser(profile: PaidPlanProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.signup_type === "trial") return true;
  const plan = String(profile.subscription_plan ?? "").toLowerCase();
  return plan === "trial";
}

export function isPaidPlanUser(profile: PaidPlanProfile | null | undefined): boolean {
  if (!profile || isTrialPlanUser(profile)) return false;
  if (profile.signup_type === "plan") return true;
  const plan = String(profile.subscription_plan ?? "").toLowerCase();
  return plan === "core" || plan === "pro";
}

export function readSafetyConsentAgreed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem("ezri_safety_consent");
    if (!stored) return false;
    const parsed = JSON.parse(stored) as { agreedToSafetyNotice?: boolean };
    return parsed.agreedToSafetyNotice === true;
  } catch {
    return false;
  }
}

export function getPaidOnboardingChecklistStatus(
  profile: PaidPlanProfile,
  options?: { safetyConsentAgreed?: boolean },
): PaidOnboardingChecklistResult {
  const safetyConsentAgreed = options?.safetyConsentAgreed ?? readSafetyConsentAgreed();
  const goals = toStringArray(profile.selected_goals);
  const triggers = toStringArray(profile.selected_triggers);

  const profileMissing: string[] = [];
  if (!hasText(profile.full_name) || String(profile.full_name).trim().length < 2) {
    profileMissing.push("Full name");
  }
  if (!hasValidAge(profile.age)) {
    profileMissing.push("Age / date of birth");
  }
  if (!hasText(profile.timezone)) {
    profileMissing.push("Timezone");
  }

  const wellnessMissing: string[] = [];
  if (goals.length === 0) wellnessMissing.push("Wellness goals");
  if (!hasText(profile.current_mood)) wellnessMissing.push("Current mood");
  const wellnessBlockingMissing = goals.length === 0 ? ["Wellness goals"] : [];

  const healthMissing: string[] = [];
  if (isNotSpecified(profile.in_therapy)) healthMissing.push("Therapy status");
  if (triggers.length === 0) healthMissing.push("Triggers & sensitivities (optional)");

  const healthCoreAnswered = !isNotSpecified(profile.in_therapy);

  const avatarMissing: string[] = [];
  if (!hasCompanionSelected(profile.selected_avatar)) avatarMissing.push("AI companion");
  if (!hasEnvironmentSelected(profile.selected_environment)) {
    avatarMissing.push("Session environment");
  }

  const emergencyMissing: string[] = [];
  if (!hasText(profile.emergency_contact_name) || String(profile.emergency_contact_name).trim().length < 2) {
    emergencyMissing.push("Contact name");
  }
  if (!hasValidEmergencyPhone(profile.emergency_contact_phone)) {
    emergencyMissing.push("Contact phone");
  }
  if (!hasText(profile.emergency_contact_relationship)) {
    emergencyMissing.push("Relationship");
  }

  const permissionsMissing: string[] = [];
  if (!hasRecordKeys(profile.permissions)) {
    permissionsMissing.push("Device permissions");
  }
  if (!hasRecordKeys(profile.notification_preferences)) {
    permissionsMissing.push("Notification preferences");
  }

  const steps: PaidOnboardingStepStatus[] = [
    {
      id: "profile-setup",
      title: "Profile setup",
      description: "Basic details from your first onboarding step.",
      missingItems: profileMissing,
      isComplete: profileMissing.length === 0,
      action: { type: "navigate", path: paidOnboardingStepPath("profile-setup") },
    },
    {
      id: "wellness-baseline",
      title: "Wellness baseline",
      description: "Goals and mood from your wellness check-in.",
      missingItems: wellnessBlockingMissing.length > 0 ? wellnessBlockingMissing : wellnessMissing,
      isComplete: goals.length > 0,
      action: { type: "navigate", path: paidOnboardingStepPath("wellness-baseline") },
    },
    {
      id: "health-background",
      title: "Health background",
      description: "Optional context that personalizes your sessions.",
      missingItems: healthMissing.filter((item) => !item.includes("(optional)")),
      isComplete: healthCoreAnswered,
      action: { type: "navigate", path: paidOnboardingStepPath("health-background") },
    },
    {
      id: "avatar-preferences",
      title: "Companion & environment",
      description: "Your Solace companion and session setting.",
      missingItems: avatarMissing,
      isComplete: hasCompanionSelected(profile.selected_avatar),
      action: { type: "navigate", path: paidOnboardingStepPath("avatar-preferences") },
    },
    {
      id: "safety-consent",
      title: "Safety & support",
      description: "Safety notice acknowledgement from onboarding.",
      missingItems: safetyConsentAgreed ? [] : ["Safety guidelines agreement"],
      isComplete: safetyConsentAgreed,
      action: { type: "navigate", path: paidOnboardingStepPath("safety-consent") },
    },
    {
      id: "emergency-contact",
      title: "Emergency contact",
      description: "Someone we can reach during urgent wellbeing events.",
      missingItems: emergencyMissing,
      isComplete: emergencyMissing.length === 0,
      action: { type: "navigate", path: paidOnboardingStepPath("emergency-contact") },
    },
    {
      id: "permissions",
      title: "Permissions & notifications",
      description: "Device access and notification preferences.",
      missingItems: permissionsMissing,
      isComplete: permissionsMissing.length === 0,
      action: { type: "navigate", path: paidOnboardingStepPath("permissions") },
    },
  ];

  const incompleteSteps = steps.filter((step) => !step.isComplete);
  const completedCount = steps.length - incompleteSteps.length;

  return {
    steps,
    incompleteSteps,
    completedCount,
    totalCount: steps.length,
    percentComplete: Math.round((completedCount / steps.length) * 100),
    hasIncomplete: incompleteSteps.length > 0,
  };
}

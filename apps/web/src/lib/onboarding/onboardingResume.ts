export const ONBOARDING_RESUME_PARAM = "resume";
export const ONBOARDING_PROFILE_RETURN = "/app/user-profile";

export const PAID_ONBOARDING_STEP_ROUTES: Record<string, string> = {
  "profile-setup": "/onboarding/profile-setup",
  "wellness-baseline": "/onboarding/wellness-baseline",
  "health-background": "/onboarding/health-background",
  "avatar-preferences": "/onboarding/avatar-preferences",
  "safety-consent": "/onboarding/safety-consent",
  "emergency-contact": "/onboarding/emergency-contact",
  permissions: "/onboarding/permissions",
};

export function isOnboardingResumeMode(search: string): boolean {
  return new URLSearchParams(search).get(ONBOARDING_RESUME_PARAM) === "1";
}

export function paidOnboardingStepPath(stepId: string): string {
  const base = PAID_ONBOARDING_STEP_ROUTES[stepId] ?? "/onboarding/welcome";
  return `${base}?${ONBOARDING_RESUME_PARAM}=1`;
}

export function resolveOnboardingStepDestination(
  resume: boolean,
  defaultNextPath: string,
): string {
  return resume ? ONBOARDING_PROFILE_RETURN : defaultNextPath;
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

/** Seed onboarding context from an existing profile when resuming a single step. */
export function profileToOnboardingData(profile: Record<string, any>, userId: string) {
  const fullName = String(profile.full_name ?? "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  return {
    userId,
    signupType: profile.signup_type === "trial" ? ("trial" as const) : ("plan" as const),
    firstName,
    lastName,
    pronouns: profile.pronouns ?? "",
    phone: profile.phone ?? "",
    age: profile.age ?? "",
    timezone: profile.timezone ?? "",
    currentMood: profile.current_mood ?? "",
    selectedGoals: toStringArray(profile.selected_goals),
    inTherapy: profile.in_therapy ?? "",
    onMedication: profile.on_medication ?? "",
    selectedTriggers: toStringArray(profile.selected_triggers),
    selectedAvatar: profile.selected_avatar ?? "",
    selectedEnvironment: profile.selected_environment ?? "",
    emergencyContactName: profile.emergency_contact_name ?? "",
    emergencyContactPhone: profile.emergency_contact_phone ?? "",
    emergencyContactRelationship: profile.emergency_contact_relationship ?? "",
    permissions:
      profile.permissions && typeof profile.permissions === "object" ? profile.permissions : {},
    notificationPreferences:
      profile.notification_preferences && typeof profile.notification_preferences === "object"
        ? profile.notification_preferences
        : {},
    role: profile.role === "therapist" ? ("therapist" as const) : ("user" as const),
  };
}

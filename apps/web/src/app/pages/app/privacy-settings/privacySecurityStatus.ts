export type PrivacySecurityTone = "emerald" | "amber" | "rose";

export type PrivacySecurityLabel = "Excellent" | "Good" | "Fair" | "Needs attention";

export interface PrivacySecurityInput {
  profileVisibility: string;
  shareProgress: boolean;
  thirdPartySharing: boolean;
  marketingEmails: boolean;
  trustedContactEnabled: boolean;
  showAvatarInCommunity: boolean;
  twoFactorEnabled: boolean;
  loginAlertsEnabled: boolean;
  emailVerified: boolean;
}

export interface PrivacySecurityStatus {
  score: number;
  label: PrivacySecurityLabel;
  headline: string;
  summary: string;
  tone: PrivacySecurityTone;
  recommendations: string[];
  heroTitle: string;
  heroSubtitle: string;
}

export function computePrivacySecurityStatus(input: PrivacySecurityInput): PrivacySecurityStatus {
  const recommendations: string[] = [];
  let score = 0;

  if (input.emailVerified) {
    score += 15;
  } else {
    recommendations.push("Verify your email address");
  }

  if (input.twoFactorEnabled) {
    score += 25;
  } else {
    recommendations.push("Enable two-factor authentication");
  }

  if (input.loginAlertsEnabled) {
    score += 10;
  } else {
    recommendations.push("Turn on login alerts");
  }

  if (input.profileVisibility === "private") {
    score += 12;
  } else {
    recommendations.push("Set profile visibility to Private");
  }

  if (!input.thirdPartySharing) {
    score += 10;
  } else {
    recommendations.push("Disable third-party data sharing");
  }

  if (!input.shareProgress) {
    score += 8;
  }

  if (input.trustedContactEnabled) {
    score += 10;
  } else {
    recommendations.push("Set up a trusted emergency contact");
  }

  if (!input.marketingEmails) {
    score += 5;
  }

  if (!input.showAvatarInCommunity || input.profileVisibility === "private") {
    score += 5;
  }

  if (!input.emailVerified) {
    score = Math.min(score, 64);
  }
  if (!input.twoFactorEnabled) {
    score = Math.min(score, 82);
  }

  const label: PrivacySecurityLabel =
    score >= 90 ? "Excellent" : score >= 78 ? "Good" : score >= 62 ? "Fair" : "Needs attention";

  const tone: PrivacySecurityTone =
    score >= 78 ? "emerald" : score >= 62 ? "amber" : "rose";

  const headline =
    label === "Excellent"
      ? "All systems secure"
      : label === "Good"
        ? "Strong protection"
        : label === "Fair"
          ? "Room to improve"
          : "Action recommended";

  const summary =
    recommendations.length === 0
      ? "Your account is protected and up to date."
      : recommendations.length === 1
        ? `Next step: ${recommendations[0].toLowerCase()}.`
        : `${recommendations.length} steps can strengthen your privacy and security.`;

  const heroTitle =
    label === "Excellent"
      ? "Protected"
      : label === "Good"
        ? "Secured"
        : label === "Fair"
          ? "Fair"
          : "Review";

  const heroSubtitle =
    label === "Excellent"
      ? "Your data is encrypted and secure"
      : label === "Good"
        ? "Solid safeguards are in place"
        : label === "Fair"
          ? "A few settings could be stronger"
          : "Update security settings below";

  return {
    score,
    label,
    headline,
    summary,
    tone,
    recommendations,
    heroTitle,
    heroSubtitle,
  };
}

export const privacySecurityToneStyles: Record<
  PrivacySecurityTone,
  {
    dot: string;
    headline: string;
    ring: string;
    shield: string;
    heroGlow: string;
  }
> = {
  emerald: {
    dot: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]",
    headline: "text-emerald-200/90",
    ring: "border-emerald-400/25 bg-emerald-500/[0.06] shadow-[0_0_36px_-10px_rgba(52,211,153,0.35)]",
    shield: "text-emerald-200/90",
    heroGlow:
      "bg-[radial-gradient(circle,rgba(52,211,153,0.28)_0%,rgba(52,211,153,0.06)_45%,transparent_70%)]",
  },
  amber: {
    dot: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.65)]",
    headline: "text-amber-200/90",
    ring: "border-amber-400/25 bg-amber-500/[0.06] shadow-[0_0_36px_-10px_rgba(251,191,36,0.35)]",
    shield: "text-amber-200/90",
    heroGlow:
      "bg-[radial-gradient(circle,rgba(251,191,36,0.28)_0%,rgba(251,191,36,0.06)_45%,transparent_70%)]",
  },
  rose: {
    dot: "bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.65)]",
    headline: "text-rose-200/90",
    ring: "border-rose-400/25 bg-rose-500/[0.06] shadow-[0_0_36px_-10px_rgba(244,63,94,0.35)]",
    shield: "text-rose-200/90",
    heroGlow:
      "bg-[radial-gradient(circle,rgba(244,63,94,0.22)_0%,rgba(244,63,94,0.06)_45%,transparent_70%)]",
  },
};

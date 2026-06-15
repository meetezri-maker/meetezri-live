const PENDING_VERIFICATION_EMAIL_KEY = "ezri_pending_verification_email";
const PENDING_VERIFICATION_SIGNUP_TYPE_KEY = "ezri_pending_verification_signup_type";

export type PendingVerificationSignupType = "trial" | "plan";

export function storePendingVerification(
  email: string,
  signupType: PendingVerificationSignupType,
): void {
  try {
    sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email.trim());
    sessionStorage.setItem(PENDING_VERIFICATION_SIGNUP_TYPE_KEY, signupType);
  } catch {
    // ignore storage errors (private browsing, etc.)
  }
}

export function getPendingVerificationEmail(): string | null {
  try {
    return sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function getPendingVerificationSignupType(): PendingVerificationSignupType | null {
  try {
    const value = sessionStorage.getItem(PENDING_VERIFICATION_SIGNUP_TYPE_KEY);
    return value === "trial" || value === "plan" ? value : null;
  } catch {
    return null;
  }
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

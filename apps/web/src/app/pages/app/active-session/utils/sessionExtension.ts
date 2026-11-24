/**
 * "Add more time" at the selected session limit.
 *
 * DEFAULT: OFF. The hard cutoff stays the shipped behaviour until a controlled Ezri test confirms
 * conversation memory and safe playback after a hold. Follows the `VITE_*` env-var convention.
 */
export function isSessionExtensionEnabled(): boolean {
  const raw = (import.meta.env.VITE_SESSION_EXTENSIONS_ENABLED as string | undefined)
    ?.trim()
    .toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * "open": normal conversation.
 * "held": waiting on the popup; no input leaves and no reply is shown or played.
 * "fenced": resumed, but replies stay dropped until the member's next turn begins, so nothing
 * generated before or during the hold can surface.
 */
export type ConversationGate = "open" | "held" | "fenced";

/** How long the member has to decide before the session is ended and saved. */
export const EXTENSION_DECISION_WINDOW_MS = 10 * 60 * 1000;

/**
 * How long an approved extension may wait for proof it is safe to resume. Running out is a
 * failure that ends and saves the session; it is never treated as proof.
 */
export const EXTENSION_RESUME_TIMEOUT_MS = 20 * 1000;

const EXTENSION_MINUTE_OPTIONS: readonly number[] = [5, 10, 20, 30];

/** Int16 RMS at which the mic is clearly carrying speech (same level the page treats as talking). */
const SPEECH_RMS_THRESHOLD = 200;

/** Minute choices the balance covers; empty when it cannot cover the smallest option. */
export function extensionMinuteChoices(availableSeconds: number): number[] {
  const availableMinutes = Math.floor(Math.max(0, availableSeconds) / 60);
  return EXTENSION_MINUTE_OPTIONS.filter((minutes) => minutes <= availableMinutes);
}

export function isVoicedPcm(pcm: Int16Array): boolean {
  if (pcm.length === 0) return false;
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
  return Math.sqrt(sum / pcm.length) >= SPEECH_RMS_THRESHOLD;
}

export type SessionExtensionRequest = {
  request_id: string;
  expected_limit_minutes: number;
  add_minutes: number;
  elapsed_seconds: number;
};

export type SessionExtensionResponse =
  | {
      approved: true;
      replayed: boolean;
      limit_minutes: number;
      limit_seconds: number;
      billed_seconds: number;
      balance_seconds: number;
      available_seconds: number;
    }
  | {
      approved: false;
      code: string;
      message: string;
      limit_minutes: number | null;
      limit_seconds: number | null;
      balance_seconds: number | null;
      available_seconds: number | null;
    };

export type ExtensionHoldPhase = "choosing" | "approving" | "securing";

export type ExtensionHoldState = {
  phase: ExtensionHoldPhase;
  deadlineMs: number;
  availableSeconds: number;
  error: string | null;
  /** The server no longer allows this account to add time (e.g. removed from the allowlist). */
  unavailable?: boolean;
};

/** The balance covers the request, but another live session is approved to use those minutes. */
export const MINUTES_HELD_CODE = "MINUTES_HELD_BY_ANOTHER_SESSION";

export function extensionRejectionMessage(code: string): string {
  switch (code) {
    case MINUTES_HELD_CODE:
      return "Your minutes are being held by another active session. End that session and try again, or choose less time.";
    case "INSUFFICIENT_BALANCE":
      return "You don't have enough minutes for that. Choose less time or end the session.";
    case "TRIAL_EXPIRED":
      return "Your trial has ended, so more time can't be added.";
    case "EXTENSION_STALE":
      return "This session's time was changed somewhere else. End this session or try again.";
    case "LIMIT_EXCEEDED":
      return "This session can't be made any longer.";
    default:
      return "More time can't be added to this session.";
  }
}

export const EXTENSION_REQUEST_FAILED_MESSAGE =
  "We couldn't add more time. Your session is still paused. Try again or end the session.";
export const EXTENSION_TIMED_OUT_MESSAGE =
  "No more time was added, so your session has ended and been saved.";
export const EXTENSION_CONNECTION_LOST_MESSAGE =
  "The connection was lost while your session was paused, so it has ended and been saved.";
export const EXTENSION_RESUME_FAILED_MESSAGE =
  "We couldn't safely continue this conversation, so your session has ended and been saved. You were not charged for the added time.";
export const EXTENSION_ALREADY_ENDED_MESSAGE = "This session has already ended.";
export const EXTENSION_UNAVAILABLE_MESSAGE =
  "Adding more time isn't available for this account. You can end the session and it will be saved.";

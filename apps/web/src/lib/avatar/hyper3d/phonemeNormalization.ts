import {
  SUPPORTED_PHONEMES,
  type SupportedPhoneme,
} from "./liveAvatarPayload";

/**
 * Phoneme label normalization for the live Solace → Hyper3D seam.
 *
 * This is a VERBATIM port of the accepted avatar-test behaviour
 * (`avatar-test/src/engine/lipsync/PhonemeNormalizer.ts` +
 * `src/mappings/phonemeAliases.ts`). The rules are reproduced, not reinvented:
 *
 *   1. trim
 *   2. strip ONE trailing ARPABET stress digit (`[0-2]$`) — `AH0` → `AH`
 *   3. alias lookup (exact, stress-stripped, lowercased stress-stripped)
 *   4. uppercase membership test against the supported set
 *   5. otherwise UNKNOWN — reported, never guessed
 *
 * Step 5 is the important one for this phase. The brief forbids silently mapping
 * an unknown label onto a visually similar phoneme, and avatar-test agrees: its
 * own alias table carries a long comment explaining why MFA's `spn` is
 * deliberately NOT aliased to `SIL`, because folding it into silence freezes the
 * mouth for a whole word. Unknown stays unknown here too.
 */

const supportedPhonemeSet = new Set<SupportedPhoneme>(SUPPORTED_PHONEMES);

/**
 * `avatar-test/src/mappings/phonemeAliases.ts`, copied exactly.
 *
 * `spn` is absent on purpose — see the module note above.
 */
const phonemeAliases: Record<string, SupportedPhoneme> = {
  "": "SIL", _: "SIL", SILENCE: "SIL", silence: "SIL", REST: "SIL", rest: "SIL",
  SP: "SP", sp: "SP", PAUSE: "PAUSE", pause: "PAUSE",
  H: "HH", h: "HH", eh: "EH", l: "L", ow: "OW", m: "M", p: "P", b: "B", f: "F",
  v: "V", th: "TH", dh: "DH", sh: "SH", zh: "ZH", ch: "CH", jh: "JH", aa: "AA",
  ae: "AE", ah: "AH", ao: "AO", aw: "AW", ay: "AY", er: "ER", ey: "EY",
  ih: "IH", iy: "IY", uh: "UH", uw: "UW", r: "R", s: "S", z: "Z", t: "T",
  d: "D", n: "N", ng: "NG", k: "K", g: "G", y: "Y", w: "W",
};

/**
 * Solace's own `normalizePhonemeLabel` (lib/avatar/phonemeToViseme.ts) strips a
 * `viseme_` prefix before mapping, so a backend that labels its output that way
 * is already handled upstream. Applying the same strip here means this function
 * works on either the raw backend label or Solace's normalized one.
 */
const VISEME_PREFIX = /^VISEME[_\s-]*/i;

export type PhonemeNormalizationResult =
  | { supported: true; phoneme: SupportedPhoneme; exact: boolean }
  | { supported: false; raw: string };

/**
 * The single normalization entry point for live phonemes.
 *
 * `exact` is true when the incoming label was already an accepted phoneme with
 * no transformation beyond trimming — it exists so the phoneme audit can report
 * exact matches separately from normalized ones.
 */
export function normalizeLivePhoneme(value: unknown): PhonemeNormalizationResult {
  const raw = typeof value === "string" ? value : String(value ?? "");
  const trimmed = raw.trim();
  const deprefixed = trimmed.replace(VISEME_PREFIX, "");

  if (supportedPhonemeSet.has(deprefixed as SupportedPhoneme)) {
    return { supported: true, phoneme: deprefixed as SupportedPhoneme, exact: true };
  }

  const strippedStress = deprefixed.replace(/[0-2]$/, "");
  const direct =
    phonemeAliases[deprefixed] ??
    phonemeAliases[strippedStress] ??
    phonemeAliases[strippedStress.toLowerCase()];
  if (direct) return { supported: true, phoneme: direct, exact: false };

  const upper = strippedStress.toUpperCase();
  if (supportedPhonemeSet.has(upper as SupportedPhoneme)) {
    return { supported: true, phoneme: upper as SupportedPhoneme, exact: false };
  }

  return { supported: false, raw: trimmed };
}

/** True for the labels the runtime treats as non-speech (silence / pause). */
export function isSilencePhoneme(phoneme: SupportedPhoneme): boolean {
  return phoneme === "SIL" || phoneme === "SP" || phoneme === "PAUSE";
}

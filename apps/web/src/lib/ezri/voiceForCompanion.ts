import { normalizeCompanionId } from "@/lib/avatar/companionModelUrl";

/** Alex, Jordan, Damian — the male voice category (Damian approved 2026-10-23). */
const MALE_COMPANION_IDS = new Set(["alex", "jordan", "damian"]);
/** Maya, Sarah, Bianca, Sasha — the female voice category (Bianca, Sasha approved 2026-10-23). */
const FEMALE_COMPANION_IDS = new Set(["maya", "sarah", "bianca", "sasha"]);

export type CompanionVoiceGender = "male" | "female";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR VOICE OPTIONS, AND THE PROVIDER ID EACH ONE SENDS.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One table, consulted by the UI, the label correction and the request
 * resolution alike, so a voice cannot mean one thing on screen and another on
 * the wire.
 */
export type VoiceOptionId = "voice1" | "voice2" | "voice3" | "voice4";

/** Provider ids are sent lowercase, exactly as written here. */
const VOICE_OPTION_PROVIDER_IDS: Readonly<Record<VoiceOptionId, string>> = {
  voice1: "marin",
  voice2: "echo",
  voice3: "nova",
  voice4: "cedar",
};

/** Which category each option belongs to. Two per category, by design. */
const VOICE_OPTION_GENDER: Readonly<Record<VoiceOptionId, CompanionVoiceGender>> = {
  voice1: "female",
  voice3: "female",
  voice2: "male",
  voice4: "male",
};

/**
 * The CANONICAL label: what the lobby catalogue sets as each option's `name`,
 * what `profiles.selected_voice` stores, and what selections compare against.
 * It is no longer what the member reads - see `VOICE_OPTION_DISPLAY_LABELS`.
 */
const VOICE_OPTION_LABELS: Readonly<Record<VoiceOptionId, string>> = {
  voice1: "Voice 1",
  voice2: "Voice 2",
  voice3: "Voice 3",
  voice4: "Voice 4",
};

/**
 * THE MEMBER-FACING LABEL FOR EACH OPTION. DISPLAY ONLY.
 *
 * Separate from `VOICE_OPTION_LABELS` on purpose. That map is the CANONICAL
 * label: it is what `profiles.selected_voice` stores, what the lobby
 * catalogue sets as each option's `name`, and what selection comparisons and
 * `VOICE_OPTION_ALIASES` resolve against. Renaming it would leave every
 * already-saved preference unresolvable, and a new save would round-trip to a
 * label the aliases do not know, silently dropping the member back to their
 * category default.
 *
 * So the wire, the store and the catalogue keep saying "Voice 1", and only the
 * screen says "Friendly". Render with `voiceDisplayLabel`; never feed a value
 * from this map back into `normalizeVoiceOptionId`, a profile save or a
 * session payload.
 */
const VOICE_OPTION_DISPLAY_LABELS: Readonly<Record<VoiceOptionId, string>> = {
  voice1: "Friendly",
  voice2: "Calm",
  voice3: "Professional",
  voice4: "Chill Surfer",
};

/** The category default when a choice is missing or belongs to the other one. */
const CATEGORY_DEFAULT_OPTION: Readonly<Record<CompanionVoiceGender, VoiceOptionId>> = {
  female: "voice1",
  male: "voice2",
};

/**
 * EVERY SPELLING THE PRODUCT HAS EVER STORED, listed rather than pattern-matched.
 *
 * This replaces substring tests like `label.includes("male")`, which were
 * quietly broken: **"female" contains "male"**, so every female label also
 * satisfied the male test. The old code only survived that by checking female
 * first, which made correctness depend on statement order in two separate
 * functions.
 *
 * Saved labels (`"Voice 1"`) and catalogue ids (`"voice1"`) both resolve here,
 * so nothing a member has already saved needs migrating.
 *
 * `"Default Voice"` is deliberately ABSENT. It is a legacy placeholder, not a
 * choice, so it must fall through to the companion's category default rather
 * than pin a specific provider voice.
 */
const VOICE_OPTION_ALIASES: Readonly<Record<string, VoiceOptionId>> = {
  "voice 1": "voice1",
  voice1: "voice1",
  "voice 2": "voice2",
  voice2: "voice2",
  "voice 3": "voice3",
  voice3: "voice3",
  "voice 4": "voice4",
  voice4: "voice4",
};

/** A stored label or catalogue id → the option it names, or `null`. */
export function normalizeVoiceOptionId(
  value: string | null | undefined,
): VoiceOptionId | null {
  const key = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return VOICE_OPTION_ALIASES[key] ?? null;
}

/** The provider id an option sends. Exported for tests and diagnostics. */
export function providerVoiceIdForOption(option: VoiceOptionId): string {
  return VOICE_OPTION_PROVIDER_IDS[option];
}

/** The category an option belongs to. */
export function voiceOptionGender(option: VoiceOptionId): CompanionVoiceGender {
  return VOICE_OPTION_GENDER[option];
}

/**
 * The option this companion should use, given what is currently selected.
 *
 * A valid in-category choice is kept — that is what stops Voice 3 and Voice 4
 * collapsing back onto the two category defaults. Anything incompatible,
 * unrecognised or missing falls to the category default, which is the
 * behaviour the lobby and the session payload already had.
 *
 * `null` means neither the companion nor the selection could be resolved, and
 * the caller has nothing better than the configured fallback.
 */
export function resolveVoiceOptionForCompanion(
  avatarLabel: string | null | undefined,
  selectedVoiceLabel?: string | null,
): VoiceOptionId | null {
  const gender = resolveCompanionVoiceGender(avatarLabel);
  const requested = normalizeVoiceOptionId(selectedVoiceLabel);

  if (requested && (!gender || VOICE_OPTION_GENDER[requested] === gender)) return requested;
  if (gender) return CATEGORY_DEFAULT_OPTION[gender];
  return null;
}

/** Lobby / profile avatar name → voice gender (matches Session Lobby voice filters). */
export function resolveCompanionVoiceGender(
  avatarLabel: string | null | undefined,
): CompanionVoiceGender | null {
  const id = normalizeCompanionId(avatarLabel);
  if (id && MALE_COMPANION_IDS.has(id)) return "male";
  if (id && FEMALE_COMPANION_IDS.has(id)) return "female";

  const n = (avatarLabel ?? "").trim().toLowerCase();
  if (
    n === "maya chen" ||
    n === "maya" ||
    n === "sara mitchell" ||
    n === "sarah mitchell" ||
    n === "sarah" ||
    n === "sara"
  ) {
    return "female";
  }
  if (
    n === "alex" ||
    n === "alex rivera" ||
    n === "jordan" ||
    n === "jordan taylor"
  ) {
    return "male";
  }
  return null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WHICH VOICES A COMPANION MAY BE OFFERED.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * One shared helper over the CALLER'S catalogue. It does not own a voice list,
 * does not duplicate one, and does not read anything out of a voice's label:
 * the category comes from `resolveCompanionVoiceGender` — the same
 * classification the session payload already uses — and the match comes from
 * each option's own `gender` metadata.
 *
 * AN UNRESOLVED COMPANION RETURNS NOTHING, deliberately. The alternative is to
 * guess a category and show one, and a guess here means offering a member the
 * wrong half of the catalogue while their profile is still loading. The caller
 * shows its loading/disabled state instead.
 */
export function voiceOptionsForCompanion<T extends { gender: string }>(
  avatarLabel: string | null | undefined,
  catalogue: readonly T[],
): T[] {
  const gender = resolveCompanionVoiceGender(avatarLabel);
  if (!gender) return [];
  return catalogue.filter((option) => option.gender.trim().toLowerCase() === gender);
}

/**
 * The voice a companion should end up on, given what is currently selected.
 *
 * The rule, in order:
 *   1. an unresolved companion offers nothing and selects nothing;
 *   2. a selection that is still in the filtered catalogue is KEPT, so moving
 *      between two companions of the same category does not disturb a member's
 *      choice;
 *   3. otherwise the existing configured default for that category —
 *      `resolveVoiceLabelForCompanion`, the same function the lobby already
 *      used — and it is only returned if it really is one of the options, so a
 *      catalogue change can never leave the UI pointing at a voice it is not
 *      showing.
 */
export function resolveVoiceSelectionForCompanion<T extends { name: string; gender: string }>(
  avatarLabel: string | null | undefined,
  catalogue: readonly T[],
  currentSelection: string | null | undefined,
): { options: T[]; selected: string | null } {
  const options = voiceOptionsForCompanion(avatarLabel, catalogue);
  if (!options.length) return { options, selected: null };

  const current = (currentSelection ?? "").trim();
  if (current && options.some((option) => option.name === current)) {
    return { options, selected: current };
  }

  const configuredDefault = resolveVoiceLabelForCompanion(avatarLabel, null);
  const match = options.find((option) => option.name === configuredDefault) ?? options[0];
  return { options, selected: match.name };
}

/**
 * Correct lobby voice label when the saved voice disagrees with the companion.
 *
 * Now decided by the option table rather than by substring tests, so a
 * recognised option also comes back in its CANONICAL spelling — a stored
 * `"voice3"` resolves to `"Voice 3"`, which is the name the catalogue renders
 * and the selection compares against.
 *
 * An unrecognised, non-empty label is still returned untouched, exactly as
 * before, so a value this module does not know about is never silently
 * rewritten.
 */
export function resolveVoiceLabelForCompanion(
  avatarLabel: string | null | undefined,
  selectedVoiceLabel?: string | null,
): string {
  const gender = resolveCompanionVoiceGender(avatarLabel);
  const selected = (selectedVoiceLabel ?? "").trim();
  const requested = normalizeVoiceOptionId(selected);

  if (requested) {
    if (!gender || VOICE_OPTION_GENDER[requested] === gender) {
      return VOICE_OPTION_LABELS[requested];
    }
    return VOICE_OPTION_LABELS[CATEGORY_DEFAULT_OPTION[gender]];
  }

  if (selected) return selected;
  if (gender) return VOICE_OPTION_LABELS[CATEGORY_DEFAULT_OPTION[gender]];
  return VOICE_OPTION_LABELS.voice1;
}

/**
 * Ezri TTS `voice` for the WebSocket `voice=` parameter and the REST
 * speak/chat fields. One resolution, used by all three.
 *
 *   Voice 1 -> marin      Voice 3 -> nova
 *   Voice 2 -> echo       Voice 4 -> cedar
 *
 * PER OPTION, NOT PER CATEGORY. This previously resolved to one of two env
 * presets — `VITE_EZRI_VOICE_FEMALE` / `VITE_EZRI_VOICE_MALE` — so Voice 3 sent
 * the same id as Voice 1 and Voice 4 the same as Voice 2. Four choices on
 * screen became two on the wire. Those two presets are therefore NO LONGER
 * CONSULTED here: a valid option maps to its own id, which is the whole point
 * of the mapping and what requirement 5 asks for. Anything that reads them
 * elsewhere is untouched.
 *
 * `VITE_DEFAULT_EZRI_VOICE` survives as the last resort, for the one case where
 * nothing resolves: an unrecognised companion AND an unrecognised selection.
 */
export function resolveEzriWsVoiceForCompanion(
  avatarLabel: string | null | undefined,
  selectedVoiceLabel?: string | null,
): string {
  const option = resolveVoiceOptionForCompanion(avatarLabel, selectedVoiceLabel);
  if (option) return VOICE_OPTION_PROVIDER_IDS[option];

  return (
    (import.meta.env.VITE_DEFAULT_EZRI_VOICE as string | undefined)?.trim() ||
    VOICE_OPTION_PROVIDER_IDS.voice1
  );
}

/**
 * The label to SHOW for a stored voice value, catalogue id or canonical label.
 *
 * Accepts every spelling `normalizeVoiceOptionId` accepts ("Voice 1",
 * "voice1", "voice 1"), so a preference saved by any past client renders
 * correctly. An unrecognised, non-empty value — the legacy "Default Voice"
 * placeholder, or a label this module does not own — is returned trimmed and
 * unchanged, matching `resolveVoiceLabelForCompanion`'s own behaviour.
 */
export function voiceDisplayLabel(value: string | null | undefined): string {
  const option = normalizeVoiceOptionId(value);
  if (option) return VOICE_OPTION_DISPLAY_LABELS[option];
  return (value ?? "").trim();
}

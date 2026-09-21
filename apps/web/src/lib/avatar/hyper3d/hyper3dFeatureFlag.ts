/**
 * The ONE place the Hyper3D avatar migration is switched on or off.
 *
 * Deliberately a single exported predicate rather than a flag consulted at call
 * sites: the avatar implementation is resolved at exactly one seam
 * (`AvatarRuntimeSwitch`), so this is read exactly once per session stage.
 *
 * DEFAULT: OFF. During integration the existing Solace avatar remains the
 * shipped path, and flipping the default is a deliberate, separate decision.
 *
 * Solace has no generic feature-flag system — flags here are either `VITE_*`
 * env vars or hard-coded module constants (`useSaraV3ForSara`,
 * `SARA_RFV2_FLAGS`). This follows the env-var convention rather than inventing
 * a mechanism.
 */

/** The raw bundled value, for diagnostics. `null` when the var never reached the build. */
export function hyper3dAvatarFlagRawValue(): string | null {
  const raw = import.meta.env.VITE_HYPER3D_AVATAR_ENABLED as string | undefined;
  return raw === undefined ? null : raw;
}

/** `true` / `1` enable it. Anything else — including unset — leaves it off. */
export function isHyper3dAvatarEnabled(): boolean {
  const raw = (import.meta.env.VITE_HYPER3D_AVATAR_ENABLED as string | undefined)
    ?.trim()
    .toLowerCase();
  return raw === "true" || raw === "1";
}

/** The literal flag name, for diagnostics and operator-facing messages. */
export const HYPER3D_AVATAR_FLAG = "VITE_HYPER3D_AVATAR_ENABLED";

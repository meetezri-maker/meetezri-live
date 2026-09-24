import type { BlendshapePose } from "./engine/types/facialAnimation";
import { RESTING_LID_CLOSURE } from "./engine/engine/avatar/upstream/threejs-talking-avatar/performance";

/**
 * DEV-ONLY EYELASH REVIEW HARNESS. Default off, absent from production builds.
 *
 * WHAT THIS IS NOT. It is not an animation system, not a blink, not a gaze
 * planner, and it owns no timing of any kind. It pins the FINAL semantic eye
 * channels to a held value so a reviewer can stand a state still and look at it.
 * Every curve in the accepted system — the 52/18/105 blink trajectory, the
 * irregular scheduler, the +-2.8 degree speaking yaw, the holds and gaps — is
 * reachable only through `runtime`, which overrides nothing at all.
 *
 * WHY IT WRITES CANONICAL CHANNELS AND NEVER THE LASH MESH. The brief requires
 * the controls to exercise the production path, and there is exactly one:
 *
 *   test state -> canonical eye channels -> morph.write -> +- face target
 *                                                          +- lash target
 *
 * Writing `Object_2002.morphTargetInfluences` directly would prove nothing — it
 * would bypass `morphMapping`, and `MorphTargetController.write` would zero it
 * again on the next frame anyway (it assigns every discovered target every
 * frame). Because the buttons below feed the same channels production feeds, a
 * lash that follows here is a lash that follows in production, and one that
 * does not is a real defect rather than a harness artefact.
 *
 * WHY BLINK IS A SLIDER AND NOT A TRAJECTORY. Reproducing 52/18/105 here would
 * be a SECOND blink implementation, which the brief forbids and which would make
 * this harness lie about the thing it is meant to test. So the two questions are
 * split: the slider answers "does the lash stay welded to the lid at closure
 * 0.0 / 0.5 / 1.0", statically and at leisure; `runtime` answers "does it stay
 * welded through the real accepted trajectory", by simply not interfering.
 */

export type Hyper3dEyelashTestState =
  | "runtime"
  | "neutral"
  | "blink"
  | "lookLeft"
  | "lookRight"
  | "lookUp"
  | "lookDown"
  | "squint"
  | "wide";

/** Enabled with `?hyper3dEyelashTest=1`, cleared with `=0`. Sticky in between. */
export const HYPER3D_EYELASH_TEST_FLAG = "hyper3dEyelashTest";

/**
 * The fourteen canonical channels this harness owns while a state is pinned.
 *
 * ALL of them are cleared before a state writes its own, so no residue from the
 * previous state or from the idle layers underneath can bleed into what the
 * reviewer is looking at. This list is canonical ARKit names only — the lash
 * targets are reached through `morphMapping` and never named here.
 */
export const HYPER3D_EYELASH_TEST_CHANNELS: readonly string[] = Object.freeze([
  "eyeBlinkLeft", "eyeBlinkRight",
  "eyeLookUpLeft", "eyeLookUpRight",
  "eyeLookDownLeft", "eyeLookDownRight",
  "eyeLookInLeft", "eyeLookInRight",
  "eyeLookOutLeft", "eyeLookOutRight",
  "eyeSquintLeft", "eyeSquintRight",
  "eyeWideLeft", "eyeWideRight",
]);

export interface Hyper3dEyelashTestDefinition {
  id: Hyper3dEyelashTestState;
  label: string;
  /** What the reviewer is being asked to judge. Shown on the panel. */
  question: string;
  usesIntensity: boolean;
}

export const HYPER3D_EYELASH_TEST_DEFINITIONS: readonly Hyper3dEyelashTestDefinition[] = Object.freeze([
  { id: "runtime", label: "RUNTIME", usesIntensity: false, question: "Production path, nothing overridden: real blink trajectory, real gaze, real head motion. Watch the lashes through a live 52/18/105 blink and confirm Object_2002 tracks Head_M." },
  { id: "neutral", label: "NEUTRAL", usesIntensity: false, question: `Lid pinned to the accepted resting closure (${RESTING_LID_CLOSURE}). Do the lashes sit ON the resting lid, not floating above it and not driven a second time into it?` },
  { id: "blink", label: "BLINK", usesIntensity: true, question: "Scrub closure 0 -> 1. Do the lashes stay welded to the lid the whole way, with no detachment, no lag and no pop back to neutral?" },
  { id: "lookLeft", label: "LOOK LEFT", usesIntensity: true, question: "Character's LEFT (eyeLookOutLeft + eyeLookInRight). Do both lashes travel with their own eye? NOTE: the asset authors LookIn almost flat, so expect little horizontal lash travel — report it, do not correct it." },
  { id: "lookRight", label: "LOOK RIGHT", usesIntensity: true, question: "Character's RIGHT (eyeLookInLeft + eyeLookOutRight). Same question, and the same asset caveat — LookOutRight is measured horizontally inert." },
  { id: "lookUp", label: "LOOK UP", usesIntensity: true, question: "Do the lashes rise with the lids without separating from them?" },
  { id: "lookDown", label: "LOOK DOWN", usesIntensity: true, question: "Do the lashes drop with the lids without separating or inverting?" },
  { id: "squint", label: "SQUINT", usesIntensity: true, question: "Is lash and lid coordination correct under squint?" },
  { id: "wide", label: "WIDE", usesIntensity: true, question: "Is lash and lid coordination correct under widening?" },
]);

/** Mutable review state. DEV only; production never reads a non-runtime value. */
let currentState: Hyper3dEyelashTestState = "runtime";
let currentIntensity = 1;
const listeners = new Set<() => void>();

const notify = () => { for (const listener of listeners) listener(); };

export const subscribeHyper3dEyelashTest = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getHyper3dEyelashTestState = () => currentState;
export const getHyper3dEyelashTestIntensity = () => currentIntensity;

export const setHyper3dEyelashTestState = (state: Hyper3dEyelashTestState) => {
  if (state === currentState) return;
  currentState = state;
  notify();
};

export const setHyper3dEyelashTestIntensity = (intensity: number) => {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
  if (clamped === currentIntensity) return;
  currentIntensity = clamped;
  notify();
};

/**
 * Whether the harness is available at all.
 *
 * Guarded exactly like `hyper3dLegacyGlb`: DEV build, then query parameter,
 * then stored preference. A blocked storage API or an exotic location must
 * never decide this, and must never throw on a module-load path.
 */
export const isHyper3dEyelashTestEnabled = (): boolean => {
  if (!import.meta.env?.DEV) return false;
  try {
    if (typeof window === "undefined") return false;
    const query = new URLSearchParams(window.location.search).get(HYPER3D_EYELASH_TEST_FLAG);
    if (query !== null) {
      const wanted = query !== "0" && query !== "false";
      try {
        if (wanted) window.localStorage?.setItem(HYPER3D_EYELASH_TEST_FLAG, "1");
        else window.localStorage?.removeItem(HYPER3D_EYELASH_TEST_FLAG);
      } catch { /* the query parameter still decides THIS session */ }
      return wanted;
    }
    return window.localStorage?.getItem(HYPER3D_EYELASH_TEST_FLAG) === "1";
  } catch {
    return false;
  }
};

/** Resolved once, so the frame path costs one boolean read and nothing else. */
export const hyper3dEyelashTestAvailable: boolean = isHyper3dEyelashTestEnabled();

/**
 * The channel values a pinned state holds. Canonical names only.
 *
 * Every state but `blink` holds the lid at the accepted resting closure, so the
 * lashes are judged against the lid position production actually rests at
 * rather than against a fully open eye that never occurs. `blink` gives the lid
 * to the slider, because scrubbing closure IS the test there.
 */
export const hyper3dEyelashTestChannels = (
  state: Hyper3dEyelashTestState,
  intensity: number,
): Record<string, number> => {
  const i = Math.min(1, Math.max(0, intensity));
  switch (state) {
    case "neutral":
      return { eyeBlinkLeft: RESTING_LID_CLOSURE, eyeBlinkRight: RESTING_LID_CLOSURE };
    case "blink":
      return { eyeBlinkLeft: i, eyeBlinkRight: i };
    // Character's LEFT. The pairing is the accepted convention's, not this
    // file's: `hyper3dGazePose` writes out-left + in-right for a left gaze, and
    // `Hyper3dEyeBoneGaze` inverts exactly that pair.
    case "lookLeft":
      return { eyeBlinkLeft: RESTING_LID_CLOSURE, eyeBlinkRight: RESTING_LID_CLOSURE, eyeLookOutLeft: i, eyeLookInRight: i };
    case "lookRight":
      return { eyeBlinkLeft: RESTING_LID_CLOSURE, eyeBlinkRight: RESTING_LID_CLOSURE, eyeLookInLeft: i, eyeLookOutRight: i };
    case "lookUp":
      return { eyeBlinkLeft: RESTING_LID_CLOSURE, eyeBlinkRight: RESTING_LID_CLOSURE, eyeLookUpLeft: i, eyeLookUpRight: i };
    case "lookDown":
      return { eyeBlinkLeft: RESTING_LID_CLOSURE, eyeBlinkRight: RESTING_LID_CLOSURE, eyeLookDownLeft: i, eyeLookDownRight: i };
    case "squint":
      return { eyeBlinkLeft: RESTING_LID_CLOSURE, eyeBlinkRight: RESTING_LID_CLOSURE, eyeSquintLeft: i, eyeSquintRight: i };
    case "wide":
      return { eyeBlinkLeft: RESTING_LID_CLOSURE, eyeBlinkRight: RESTING_LID_CLOSURE, eyeWideLeft: i, eyeWideRight: i };
    case "runtime":
    default:
      return {};
  }
};

/**
 * Overlays the pinned state onto the resolved pose, or returns it untouched.
 *
 * `runtime` and a disabled harness both return the SAME OBJECT, not a copy, so
 * the production frame path allocates nothing and behaves identically to a
 * build where this module does not exist.
 *
 * Only the fourteen eye channels are touched. Head, neck, jaw, visemes, brows,
 * warmth and Active Presence pass through untouched, which is what makes the
 * head-follow check (does `Object_2002` stay with `Head_M`?) meaningful: the
 * head keeps moving on its own while the eye state stands still.
 */
export const applyHyper3dEyelashTestPose = (
  pose: BlendshapePose,
  state: Hyper3dEyelashTestState,
  intensity: number,
): BlendshapePose => {
  if (state === "runtime") return pose;
  const next: BlendshapePose = { ...pose };
  for (const channel of HYPER3D_EYELASH_TEST_CHANNELS) next[channel] = 0;
  for (const [channel, value] of Object.entries(hyper3dEyelashTestChannels(state, intensity))) {
    next[channel] = value;
  }
  return next;
};

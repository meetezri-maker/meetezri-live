import type { BlendshapePose } from "./engine/types/facialAnimation";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import {
  calibrateHyper3dPose,
  hyper3dMorphCalibration
} from "./engine/mappings/avatars/hyper3dCalibration";
import { BILABIAL_SEAL_LEVEL, CoarticulationEngine } from "./engine/engine/lipsync/CoarticulationEngine";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";

/**
 * DEV-ONLY ARTICULATION REVIEW HARNESS. Default off, absent from production builds.
 *
 * WHAT THIS IS NOT. It is not a lip-sync engine, not a second morph owner and it
 * owns no clock, no envelope and no timing of any kind. It PINS the lower-face
 * channels to one phoneme's target so a reviewer can stand a mouth shape still
 * and look at it — which is the one thing live speech makes impossible, because
 * every shape on screen is an exponential follower chasing a triangular envelope
 * through its neighbours.
 *
 * WHY IT WRITES CANONICAL CHANNELS AND NEVER A MORPH TARGET. Exactly the reason
 * `hyper3dEyelashTest` does: there is one production path,
 *
 *   phoneme table -> canonical channels -> calibrateHyper3dPose -> morph.write
 *
 * and a harness that bypassed it would prove nothing. The pose below is built
 * from `hyper3dPhonemeToBlendshape` — the SAME object the CoarticulationEngine
 * reads — and put through `calibrateHyper3dPose`, the SAME function
 * `transformPoseForAvatarModel` applies. Nothing is re-authored, re-derived or
 * copied.
 *
 * WHAT IT DELIBERATELY REMOVES, and this is the point of it:
 *
 *   coarticulation   no previous/next contribution, so a shape is its own
 *   the envelope     held at 1.0 instead of `compressedEnvelope`'s triangle
 *   the smoother     no `FacialPoseMixer.smooth` follower to lag behind it
 *
 * So `CALIBRATED` shows what a phoneme would render if its label were long
 * enough for the pipeline to deliver it in full. Live speech renders LESS than
 * this, never more — which is exactly the gap a reviewer needs to see.
 *
 * `AUTHORED` drops the calibration too, showing `pose x defaultIntensity`. The
 * difference between the two columns IS the asset gain/cap, isolated, so
 * "mapping problem" and "gain problem" can be told apart by looking rather than
 * by arguing.
 */

/** Enabled with `?hyper3dArticulationTest=1`, cleared with `=0`. Sticky in between. */
export const HYPER3D_ARTICULATION_TEST_FLAG = "hyper3dArticulationTest";

/**
 * The lower-face channels this harness owns while a state is pinned.
 *
 * ALL of them are cleared before a state writes its own, so no residue from
 * speech, Active Presence, warmth or the idle showcase can bleed into the shape
 * under inspection. Cheeks, nose, brows and every eye channel are deliberately
 * ABSENT: they are not speech shape, and leaving them live keeps the rest of the
 * face doing what it normally does underneath — the same property that makes the
 * eyelash harness's head-follow check meaningful.
 */
export const HYPER3D_ARTICULATION_TEST_CHANNELS: readonly string[] = Object.freeze([
  "jawOpen", "jawForward", "jawLeft", "jawRight",
  "mouthClose", "mouthFunnel", "mouthPucker",
  "mouthSmileLeft", "mouthSmileRight",
  "mouthFrownLeft", "mouthFrownRight",
  "mouthStretchLeft", "mouthStretchRight",
  "mouthUpperUpLeft", "mouthUpperUpRight",
  "mouthLowerDownLeft", "mouthLowerDownRight",
  "mouthPressLeft", "mouthPressRight",
  "mouthRollUpper", "mouthRollLower",
  "mouthShrugUpper", "mouthShrugLower",
  "mouthDimpleLeft", "mouthDimpleRight",
  "mouthLeft", "mouthRight"
]);

/** How the pinned pose is scaled before it is written. */
export type Hyper3dArticulationMode = "calibrated" | "authored";

/**
 * HELD, or DELIVERED at a label length.
 *
 * `held` is the original harness: the target, with the envelope, the smoother
 * and coarticulation taken out of the way — the value production would reach if
 * the label were long enough.
 *
 * The three delivery modes answer the other half of the question, and the half
 * the apex-hold work changed: what the same phoneme actually RENDERS when it is
 * a 70 / 90 / 150 ms label. They run the real `CoarticulationEngine` and the
 * real `FacialPoseMixer` on a looping one-label timeline, so the reviewer sees
 * the shipped envelope and the shipped follower rather than a description of
 * them. 150 ms is included because it is the length at which the apex hold is
 * measured to be inert: if 70 and 150 look the same on the face, the fix worked.
 */
export type Hyper3dArticulationDelivery = "held" | "d70" | "d90" | "d150";

export const HYPER3D_DELIVERY_MS: Readonly<Record<Exclude<Hyper3dArticulationDelivery, "held">, number>> = {
  d70: 70,
  d90: 90,
  d150: 150
};

/** Which end of a diphthong's within-label trajectory to hold. */
export type Hyper3dArticulationGlide = "onset" | "mid" | "offglide";

export interface Hyper3dArticulationTarget {
  id: string;
  label: string;
  family: string;
  /** A phoneme in `hyper3dPhonemeToBlendshape`, or null for a synthetic target. */
  phoneme: string | null;
  note?: string;
}

/**
 * Every speech phoneme, grouped by the articulation families the review asks
 * for, plus NEUTRAL and the four combination targets.
 *
 * The full inventory is listed rather than a shortlist because the families that
 * turned out to need looking at hardest — the alveolar and velar stops — are the
 * ones a shortlist would have left out.
 */
export const HYPER3D_ARTICULATION_TARGETS: readonly Hyper3dArticulationTarget[] = Object.freeze([
  { id: "runtime", label: "RUNTIME", family: "—", phoneme: null, note: "Production path, nothing overridden. Live speech, live coarticulation, live smoothing." },
  { id: "neutral", label: "NEUTRAL", family: "—", phoneme: null, note: "Every lower-face channel at zero. The rest pose every shape below is measured against." },

  { id: "AA", label: "AA", family: "A. open vowel", phoneme: "AA" },
  { id: "AH", label: "AH", family: "A. open vowel", phoneme: "AH", note: "The most frequent vowel in English. Watch how little lip shape it carries." },
  { id: "AE", label: "AE", family: "A. open vowel", phoneme: "AE" },
  { id: "AW", label: "AW", family: "A. open vowel", phoneme: "AW" },
  { id: "AY", label: "AY", family: "A. open vowel", phoneme: "AY" },

  { id: "IY", label: "IY", family: "B. front/spread", phoneme: "IY" },
  { id: "IH", label: "IH", family: "B. front/spread", phoneme: "IH" },
  { id: "EH", label: "EH", family: "B. front/spread", phoneme: "EH" },
  { id: "EY", label: "EY", family: "B. front/spread", phoneme: "EY" },
  { id: "Y", label: "Y", family: "B. front/spread", phoneme: "Y" },

  { id: "AO", label: "AO", family: "C. rounded", phoneme: "AO" },
  { id: "OW", label: "OW", family: "C. rounded", phoneme: "OW" },
  { id: "UW", label: "UW", family: "C. rounded", phoneme: "UW" },
  { id: "UH", label: "UH", family: "C. rounded", phoneme: "UH" },
  { id: "OY", label: "OY", family: "C. rounded", phoneme: "OY" },
  { id: "ER", label: "ER", family: "C. rounded", phoneme: "ER" },

  { id: "P", label: "P", family: "D. bilabial", phoneme: "P" },
  { id: "B", label: "B", family: "D. bilabial", phoneme: "B" },
  { id: "M", label: "M", family: "D. bilabial", phoneme: "M" },

  { id: "F", label: "F", family: "E. labiodental", phoneme: "F" },
  { id: "V", label: "V", family: "E. labiodental", phoneme: "V" },

  { id: "TH", label: "TH", family: "F. dental/alveolar", phoneme: "TH" },
  { id: "DH", label: "DH", family: "F. dental/alveolar", phoneme: "DH" },
  { id: "T", label: "T", family: "F. dental/alveolar", phoneme: "T" },
  { id: "D", label: "D", family: "F. dental/alveolar", phoneme: "D" },
  { id: "N", label: "N", family: "F. dental/alveolar", phoneme: "N" },
  { id: "L", label: "L", family: "F. dental/alveolar", phoneme: "L" },

  { id: "S", label: "S", family: "G. sibilant/affricate", phoneme: "S" },
  { id: "Z", label: "Z", family: "G. sibilant/affricate", phoneme: "Z" },
  { id: "SH", label: "SH", family: "G. sibilant/affricate", phoneme: "SH" },
  { id: "ZH", label: "ZH", family: "G. sibilant/affricate", phoneme: "ZH" },
  { id: "CH", label: "CH", family: "G. sibilant/affricate", phoneme: "CH" },
  { id: "JH", label: "JH", family: "G. sibilant/affricate", phoneme: "JH" },

  { id: "K", label: "K", family: "H. velar/other", phoneme: "K" },
  { id: "G", label: "G", family: "H. velar/other", phoneme: "G" },
  { id: "NG", label: "NG", family: "H. velar/other", phoneme: "NG" },
  { id: "R", label: "R", family: "H. velar/other", phoneme: "R" },
  { id: "W", label: "W", family: "H. velar/other", phoneme: "W" },
  { id: "HH", label: "HH", family: "H. velar/other", phoneme: "HH" },

  { id: "openVowel", label: "OPEN VOWEL", family: "I. combination", phoneme: "AA", note: "Family exemplar: the top of the aperture ladder. Both teeth rows should be visible." },
  { id: "spreadVowel", label: "SPREAD VOWEL", family: "I. combination", phoneme: "IY", note: "Family exemplar: the top of the spread ladder. Width without corner lift." },
  { id: "roundVowel", label: "ROUND VOWEL", family: "I. combination", phoneme: "UW", note: "Family exemplar: the top of the rounding ladder. A small protruded oval." },
  { id: "bilabialSeal", label: "FULL BILABIAL SEAL", family: "I. combination", phoneme: "M", note: `M with mouthClose forced to the production seal level (${BILABIAL_SEAL_LEVEL}) that CoarticulationEngine asserts on every P/B/M. Do the lips actually meet?` }
]);

export type Hyper3dArticulationTestState = string;

/** Mutable review state. DEV only; production never reads a non-runtime value. */
let currentState: Hyper3dArticulationTestState = "runtime";
let currentMode: Hyper3dArticulationMode = "calibrated";
let currentGlide: Hyper3dArticulationGlide = "mid";
let currentDelivery: Hyper3dArticulationDelivery = "held";
let currentIntensity = 1;
const listeners = new Set<() => void>();

const notify = () => { for (const listener of listeners) listener(); };

export const subscribeHyper3dArticulationTest = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const getHyper3dArticulationTestState = () => currentState;
export const getHyper3dArticulationTestMode = () => currentMode;
export const getHyper3dArticulationTestGlide = () => currentGlide;
export const getHyper3dArticulationTestIntensity = () => currentIntensity;

export const setHyper3dArticulationTestState = (state: Hyper3dArticulationTestState) => {
  if (state === currentState) return;
  currentState = state;
  resetDeliveryRun();
  notify();
};

export const setHyper3dArticulationTestMode = (mode: Hyper3dArticulationMode) => {
  if (mode === currentMode) return;
  currentMode = mode;
  notify();
};

export const setHyper3dArticulationTestGlide = (glide: Hyper3dArticulationGlide) => {
  if (glide === currentGlide) return;
  currentGlide = glide;
  notify();
};

export const getHyper3dArticulationTestDelivery = () => currentDelivery;

export const setHyper3dArticulationTestDelivery = (delivery: Hyper3dArticulationDelivery) => {
  if (delivery === currentDelivery) return;
  currentDelivery = delivery;
  resetDeliveryRun();
  notify();
};

export const setHyper3dArticulationTestIntensity = (intensity: number) => {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(intensity) ? intensity : 0));
  if (clamped === currentIntensity) return;
  currentIntensity = clamped;
  notify();
};

/**
 * Whether the harness is available at all.
 *
 * Guarded exactly like `hyper3dEyelashTest`: DEV build, then query parameter,
 * then stored preference. A blocked storage API or an exotic location must never
 * decide this, and must never throw on a module-load path.
 */
export const isHyper3dArticulationTestEnabled = (): boolean => {
  if (!import.meta.env?.DEV) return false;
  try {
    if (typeof window === "undefined") return false;
    const query = new URLSearchParams(window.location.search).get(HYPER3D_ARTICULATION_TEST_FLAG);
    if (query !== null) {
      const wanted = query !== "0" && query !== "false";
      try {
        if (wanted) window.localStorage?.setItem(HYPER3D_ARTICULATION_TEST_FLAG, "1");
        else window.localStorage?.removeItem(HYPER3D_ARTICULATION_TEST_FLAG);
      } catch { /* the query parameter still decides THIS session */ }
      return wanted;
    }
    return window.localStorage?.getItem(HYPER3D_ARTICULATION_TEST_FLAG) === "1";
  } catch {
    return false;
  }
};

/** Resolved once, so the frame path costs one boolean read and nothing else. */
export const hyper3dArticulationTestAvailable: boolean = isHyper3dArticulationTestEnabled();

export const hyper3dArticulationTarget = (id: string) =>
  HYPER3D_ARTICULATION_TARGETS.find((entry) => entry.id === id);

type PhonemeDefinition = {
  pose: BlendshapePose;
  defaultIntensity: number;
  viseme: string;
  category: string;
  onsetPose?: BlendshapePose;
  offglidePose?: BlendshapePose;
};

const definitionFor = (phoneme: string): PhonemeDefinition | undefined =>
  (hyper3dPhonemeToBlendshape as unknown as Record<string, PhonemeDefinition>)[phoneme];

/** True when this phoneme carries a within-label trajectory (the five diphthongs). */
export const hyper3dArticulationHasGlide = (id: string) => {
  const target = hyper3dArticulationTarget(id);
  if (!target?.phoneme) return false;
  const definition = definitionFor(target.phoneme);
  return Boolean(definition?.onsetPose && definition?.offglidePose);
};

export interface Hyper3dArticulationReadout {
  /** The pose that is written, i.e. exactly what reaches `morph.write`. */
  pose: BlendshapePose;
  /** `pose x defaultIntensity x intensity`, before any asset gain or cap. */
  authored: BlendshapePose;
  phoneme: string | null;
  viseme: string | null;
  defaultIntensity: number;
  sealForced: boolean;
}

/**
 * The channel values a pinned state holds, and the readout the panel prints.
 *
 * ONE function produces both, so the numbers on the panel cannot drift from the
 * numbers on the face: the `pose` field below IS the object the frame path
 * writes, not a recomputation of it.
 */
export const hyper3dArticulationReadout = (
  state: Hyper3dArticulationTestState,
  mode: Hyper3dArticulationMode,
  glide: Hyper3dArticulationGlide,
  intensity: number
): Hyper3dArticulationReadout => {
  const empty: Hyper3dArticulationReadout = {
    pose: {}, authored: {}, phoneme: null, viseme: null, defaultIntensity: 0, sealForced: false
  };
  if (state === "runtime" || state === "neutral") return empty;
  const target = hyper3dArticulationTarget(state);
  if (!target?.phoneme) return empty;
  const definition = definitionFor(target.phoneme);
  if (!definition) return empty;

  const source =
    glide === "onset" && definition.onsetPose
      ? definition.onsetPose
      : glide === "offglide" && definition.offglidePose
        ? definition.offglidePose
        : definition.pose;

  const scale = definition.defaultIntensity * Math.min(1, Math.max(0, intensity));
  const authored: BlendshapePose = {};
  for (const [name, value] of Object.entries(source)) {
    const scaled = value * scale;
    if (scaled > 0) authored[name] = Math.min(1, scaled);
  }
  /**
   * The seal is the one value a stop does NOT get from its own pose: the engine
   * asserts `mouthClose = max(pose, BILABIAL_SEAL_LEVEL x seal)` on every P/B/M.
   * The combination target reproduces that assertion by reading the same
   * constant, so what is held here is the real closure demand rather than a
   * number chosen for the panel.
   */
  const sealForced = state === "bilabialSeal";
  if (sealForced) {
    authored.mouthClose = Math.max(authored.mouthClose ?? 0, BILABIAL_SEAL_LEVEL * Math.min(1, Math.max(0, intensity)));
  }

  return {
    pose: mode === "authored" ? authored : calibrateHyper3dPose(authored),
    authored,
    phoneme: target.phoneme,
    viseme: definition.viseme ?? null,
    defaultIntensity: definition.defaultIntensity,
    sealForced
  };
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RUNTIME DELIVERY — the same phoneme, through the shipped envelope and follower.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOT A SECOND SPEECH ENGINE. It instantiates the production
 * `CoarticulationEngine` and the production `FacialPoseMixer` — the same classes
 * `AvatarController` builds — and drives them with a looping one-label timeline.
 * There is no clock of its own: it advances on the frame delta the orchestrator
 * already passes, so it cannot drift from the renderer. It exists only while the
 * DEV flag is on and a delivery mode is selected, and it writes through the one
 * `MorphTargetController` like everything else.
 *
 * The timeline is SIL -> phoneme -> SIL, repeating, which is exactly the isolated
 * measurement the delivery tables are quoted from. Neighbour coarticulation is
 * therefore absent by construction: the reviewer is looking at what this phoneme
 * can deliver on its own at this label length.
 */
const DELIVERY_LEAD_SECONDS = 0.25;
const DELIVERY_TAIL_SECONDS = 0.25;

type DeliveryRun = {
  engine: CoarticulationEngine;
  mixer: FacialPoseMixer;
  clock: number;
  key: string;
  /** Peak per channel over the last completed cycle, for a readable panel. */
  peak: BlendshapePose;
  live: BlendshapePose;
  settled: BlendshapePose;
};

let deliveryRun: DeliveryRun | null = null;

function resetDeliveryRun() {
  deliveryRun = null;
}

/** The peak each channel reached over the last completed label, for the panel. */
export const getHyper3dArticulationDelivered = (): BlendshapePose => ({ ...(deliveryRun?.settled ?? {}) });

function stepDelivery(
  phoneme: string,
  durationMs: number,
  intensity: number,
  deltaSeconds: number
): BlendshapePose {
  const duration = durationMs / 1000;
  const key = `${phoneme}|${durationMs}|${intensity.toFixed(3)}`;
  if (!deliveryRun || deliveryRun.key !== key) {
    deliveryRun = {
      engine: new CoarticulationEngine(),
      mixer: new FacialPoseMixer(),
      clock: 0,
      key,
      peak: {},
      live: {},
      settled: {}
    };
  }
  const run = deliveryRun;
  const cycle = DELIVERY_LEAD_SECONDS + duration + DELIVERY_TAIL_SECONDS;
  const previousClock = run.clock;
  // A hidden tab or a long frame must not fast-forward the label past itself.
  run.clock = (run.clock + Math.min(Math.max(deltaSeconds, 0), 1 / 20)) % cycle;
  if (run.clock < previousClock) {
    // The label just wrapped: publish the cycle's peak and start a fresh one.
    run.settled = run.peak;
    run.peak = {};
  }

  const start = DELIVERY_LEAD_SECONDS;
  const end = start + duration;
  const current = { id: "dev-current", phoneme, start_time: start, end_time: end, intensity };
  const previous = { id: "dev-previous", phoneme: "SIL", start_time: 0, end_time: start, intensity: 1 };
  const next = { id: "dev-next", phoneme: "SIL", start_time: end, end_time: cycle, intensity: 1 };

  const lip = run.engine.blend({
    time: run.clock,
    current: run.clock >= start && run.clock <= end ? current : undefined,
    previous: run.clock > start ? previous : undefined,
    next: run.clock < end ? (run.clock < start ? current : next) : undefined,
    windowSeconds: 0.08,
    profile: hyper3dPhonemeToBlendshape
  });
  const mixed = run.mixer.combine([{ channel: "lipsync", pose: lip.pose }] as never);
  const smoothed = run.mixer.smooth(mixed.pose, Math.max(deltaSeconds, 1e-4), undefined);
  const rendered = calibrateHyper3dPose(smoothed as BlendshapePose);
  run.live = rendered;
  for (const [name, value] of Object.entries(rendered)) {
    if (value > (run.peak[name] ?? 0)) run.peak[name] = value;
  }
  return rendered;
}

/**
 * Overlays the pinned state onto the resolved pose, or returns it untouched.
 *
 * `runtime` and a disabled harness both return the SAME OBJECT, not a copy, so
 * the production frame path allocates nothing and behaves identically to a build
 * where this module does not exist.
 *
 * Only the lower-face channels above are touched. Head, neck, gaze, blink,
 * brows, cheeks, warmth and Active Presence pass through, so the rest of the
 * face keeps behaving normally while one mouth shape stands still.
 */
export const applyHyper3dArticulationTestPose = (
  pose: BlendshapePose,
  state: Hyper3dArticulationTestState,
  mode: Hyper3dArticulationMode,
  glide: Hyper3dArticulationGlide,
  intensity: number,
  delivery: Hyper3dArticulationDelivery = "held",
  deltaSeconds = 0
): BlendshapePose => {
  if (state === "runtime") return pose;
  const next: BlendshapePose = { ...pose };
  for (const channel of HYPER3D_ARTICULATION_TEST_CHANNELS) next[channel] = 0;
  const target = hyper3dArticulationTarget(state);
  if (delivery !== "held" && target?.phoneme) {
    const rendered = stepDelivery(target.phoneme, HYPER3D_DELIVERY_MS[delivery], intensity, deltaSeconds);
    for (const [channel, value] of Object.entries(rendered)) next[channel] = value;
    return next;
  }
  const readout = hyper3dArticulationReadout(state, mode, glide, intensity);
  for (const [channel, value] of Object.entries(readout.pose)) next[channel] = value;
  return next;
};

/**
 * Per-channel geometry for the panel: what this influence is worth in
 * millimetres on `female_2291.glb`, and whether it clears the influence at which
 * this asset was measured to move visibly at all.
 *
 * Both numbers come from `hyper3dMorphCalibration`, which is the asset's own
 * measured table — the panel states the asset's facts, it does not hold any.
 */
export const hyper3dArticulationChannelFacts = (name: string, value: number) => {
  const entry = hyper3dMorphCalibration[name];
  if (!entry) return { travelMM: null, millimetres: null, usefulMin: null, visible: null, cap: null, gain: null };
  return {
    travelMM: entry.travelMM,
    millimetres: entry.travelMM * value,
    usefulMin: entry.usefulMin,
    visible: value >= entry.usefulMin,
    cap: entry.cap,
    gain: entry.gain
  };
};

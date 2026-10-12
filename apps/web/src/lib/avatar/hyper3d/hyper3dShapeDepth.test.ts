import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  lipLandmarks,
  loadLipModel,
  shapeDistanceMM,
  type LipLandmarks,
  type LipModel
} from "./hyper3dLipGeometry";
import { hyper3dPhonemeToBlendshape } from "./engine/mappings/phonemeToBlendshape";
import { calibrateHyper3dPose } from "./engine/mappings/avatars/hyper3dCalibration";
import { CORPUS_PAYLOADS, loadPayload, runCorpus } from "./hyper3dDeadlineCorpus";
import type { BlendshapePose } from "./engine/types/facialAnimation";

/**
 * §9 — THE DEPTH SWEEP. Static separation against connected-speech motion.
 *
 * The first implemented depth (IY 0.30 / EY 0.18 / IH 0.09) measured +28 % on
 * the front family's worst pair and then cost +4.0 % path rate and +5.2 % peak
 * velocity on `15-fast-mixed` — which is the band the lower-face strength pass
 * was REJECTED at. §9 is explicit that a candidate which improves static shapes
 * but makes connected speech busier is not automatically acceptable, so the
 * depth is chosen against BOTH columns here rather than against the geometry
 * alone.
 *
 * `15-fast-mixed` is the deciding payload on purpose: a shape change costs the
 * most where labels are shortest, so the fast corpus is where a motion
 * regression shows up first.
 */

const GLB = "public/avatars/female_2291.glb";
const glbOk = existsSync(GLB);
const corpus = CORPUS_PAYLOADS.filter((e) => existsSync(e.path));
const runnable = glbOk && corpus.length > 0;
const describeSweep = runnable ? describe : describe.skip;

type Definition = {
  pose: BlendshapePose;
  defaultIntensity: number;
  viseme: string;
  onsetPose?: BlendshapePose;
  offglidePose?: BlendshapePose;
};

const shipped = hyper3dPhonemeToBlendshape as unknown as Record<string, Definition>;

/** The front family with no pocket at all — the pre-refinement baseline. */
const NO_POCKET: Record<string, number> = { IY: 0, EY: 0, IH: 0 };

/** Build a whole profile with the given pocket depths on the front family. */
function profileWithPocket(depths: Record<string, number>) {
  const out: Record<string, Definition> = {};
  for (const [phoneme, definition] of Object.entries(shipped)) {
    const depth = depths[phoneme];
    if (depth === undefined) {
      out[phoneme] = definition;
      continue;
    }
    const withDepth = (pose: BlendshapePose): BlendshapePose => {
      const next = { ...pose };
      if (depth > 0) {
        next.mouthDimpleLeft = depth;
        next.mouthDimpleRight = depth;
      } else {
        delete next.mouthDimpleLeft;
        delete next.mouthDimpleRight;
      }
      return next;
    };
    out[phoneme] = {
      ...definition,
      pose: withDepth(definition.pose),
      ...(definition.onsetPose ? { onsetPose: withDepth(definition.onsetPose) } : null),
      ...(definition.offglidePose ? { offglidePose: withDepth(definition.offglidePose) } : null)
    };
  }
  return out as unknown as typeof hyper3dPhonemeToBlendshape;
}

let model: LipModel;
let lm: LipLandmarks;
if (glbOk) {
  model = loadLipModel(GLB);
  lm = lipLandmarks(model);
}

const effectiveFrom = (profile: Record<string, Definition>, phoneme: string): BlendshapePose => {
  const definition = profile[phoneme];
  const scaled: BlendshapePose = {};
  for (const [name, value] of Object.entries(definition.pose)) {
    if (value > 0) scaled[name] = value * definition.defaultIntensity;
  }
  return calibrateHyper3dPose(scaled);
};

/** The front family's worst pair, and IY's separation from its two neighbours. */
function frontSeparation(profile: Record<string, Definition>) {
  const front = ["IY", "IH", "EY", "EH"];
  const pairs: Array<[string, number]> = [];
  for (let i = 0; i < front.length; i += 1) {
    for (let j = i + 1; j < front.length; j += 1) {
      pairs.push([
        `${front[i]}-${front[j]}`,
        shapeDistanceMM(model, lm, effectiveFrom(profile, front[i]), effectiveFrom(profile, front[j]))
      ]);
    }
  }
  pairs.sort((a, b) => a[1] - b[1]);
  return { worst: pairs[0], pairs };
}

const CANDIDATES: Array<[string, Record<string, number>]> = [
  ["none (baseline)", NO_POCKET],
  ["IY.20 EY.12 IH.06", { IY: 0.2, EY: 0.12, IH: 0.06 }],
  ["IY.24 EY.14 IH.00", { IY: 0.24, EY: 0.14, IH: 0 }],
  ["IY.24 EY.14 IH.07", { IY: 0.24, EY: 0.14, IH: 0.07 }],
  ["IY.30 EY.18 IH.09", { IY: 0.3, EY: 0.18, IH: 0.09 }]
];

describeSweep("pocket depth: separation against connected-speech motion", () => {
  /**
   * 60 s, not the 5 s default: this loads a 44 MB GLB and then drives the whole
   * production chain over two aligned payloads five times. It passes in ~2.6 s
   * alone and exceeded the default budget only when the suite ran it in
   * parallel with the other GLB tests, which is a scheduling fact rather than
   * anything about the measurement.
   */
  it("prints both columns for every depth", { timeout: 60_000 }, () => {
    const base = profileWithPocket(NO_POCKET) as unknown as Record<string, Definition>;
    const baseSep = frontSeparation(base);
    const fast = corpus.find((e) => e.id === "15-fast-mixed") ?? corpus[0];
    const fastPayload = loadPayload(fast.path);
    const paragraph = corpus.find((e) => e.id === "david-natural-speech-paragraph") ?? corpus[0];
    const paragraphPayload = loadPayload(paragraph.path);

    const baseFast = runCorpus(fastPayload, fast.id, "d34soft", profileWithPocket(NO_POCKET));
    const baseParagraph = runCorpus(paragraphPayload, paragraph.id, "d34soft", profileWithPocket(NO_POCKET));

    const lines: string[] = [""];
    lines.push("=== POCKET DEPTH SWEEP ===");
    lines.push(`static: front-family worst pair.  motion: ${fast.id} and ${paragraph.id}, 34 SOFT.`);
    lines.push(
      "depth".padEnd(22) + "worstPair".padStart(11) + "vs base".padStart(9) +
      "fastPath".padStart(11) + "fastVelP90".padStart(12) +
      "paraPath".padStart(11) + "paraReach".padStart(11)
    );
    for (const [label, depths] of CANDIDATES) {
      const profile = profileWithPocket(depths);
      const sep = frontSeparation(profile as unknown as Record<string, Definition>);
      const f = runCorpus(fastPayload, fast.id, "d34soft", profile);
      const p = runCorpus(paragraphPayload, paragraph.id, "d34soft", profile);
      const dPct = (a: number, b: number) => `${a > b ? "+" : ""}${(((a - b) / b) * 100).toFixed(1)}%`;
      lines.push(
        label.padEnd(22) +
        `${sep.worst[1].toFixed(2)}`.padStart(11) +
        `${(((sep.worst[1] - baseSep.worst[1]) / baseSep.worst[1]) * 100).toFixed(0)}%`.padStart(9) +
        dPct(f.motion.pathRateMMPerSecond, baseFast.motion.pathRateMMPerSecond).padStart(11) +
        dPct(f.motion.velocityP90MMPerSecond, baseFast.motion.velocityP90MMPerSecond).padStart(12) +
        dPct(p.motion.pathRateMMPerSecond, baseParagraph.motion.pathRateMMPerSecond).padStart(11) +
        `${(p.reach.overall * 100).toFixed(1)}%`.padStart(11)
      );
      lines.push(`   ${"".padEnd(19)} pairs: ${sep.pairs.map(([k, v]) => `${k} ${v.toFixed(2)}`).join("  ")}`);
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(CANDIDATES.length).toBeGreaterThan(3);
  });
});

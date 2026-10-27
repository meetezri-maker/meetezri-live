import type * as THREE from "three";
import type { AvatarFrameState } from "./engine/engine/avatar/AvatarController";
import type { AvatarPayload } from "./engine/types/avatarPayload";
import type { Hyper3dMouthTrace } from "./hyper3dFrameOrchestrator";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPORARY DEV-ONLY LIVE MOUTH PROBE. Delete once the live failure is found.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Read-only. It records, per rendered frame of a REAL session, what the audio
 * was doing, what the controller asked for, what reached the GLB, and the lip
 * aperture that those exact influences produce on the loaded face geometry.
 *
 *   __solaceHyper3dMouthProbe.start()        arm (clears the buffer)
 *   ...let one full multi-sentence reply play...
 *   __solaceHyper3dMouthProbe.stop()
 *   copy(__solaceHyper3dMouthProbe.report()) markdown summary + timeline
 *   copy(__solaceHyper3dMouthProbe.json())   every frame, raw
 *
 * APERTURE is measured the way `scripts/hyper3d/measureCorrectiveMorph.mjs`
 * measures it: the mouth's boundary loop on the face mesh, split into inner
 * upper and inner lower halves, positioned as base + Σ influence × delta over
 * EVERY morph currently on the mesh — so jaw and lip channels that cancel each
 * other cancel here too. Asset units are cm, so ×10 is mm.
 */

const MM = 10;
const MAX_FRAMES = 60 * 120;
const TRACKED = [
  "jawOpen",
  "mouthClose",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthFunnel",
  "mouthPucker",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthLowerDownDeep",
] as const;

type ProbeFrame = {
  wallMs: number;
  /** Response clock the engine evaluated at (clamped to audio_duration). */
  clock: number;
  audioDuration: number;
  /** True when the clock is pinned at the end of the scheduled timeline. */
  clockAtTimelineEnd: boolean;
  /** Analyser drive from the scheduler's real output (22 = silent, >30 audible). */
  audioLevel: number;
  isSpeaking: boolean;
  turnId: number;
  phonemeCount: number;
  phoneme: string | null;
  phonemeRange: [number, number] | null;
  speechActivity: number;
  corrective: { requested: number; suppression: number } | null;
  /** Controller output before smoothing / after smoothing. */
  target: Record<string, number>;
  smoothed: Record<string, number>;
  /** After calibration, before ownership; and the pose handed to morph.write. */
  calibrated: Record<string, number>;
  final: Record<string, number>;
  showcaseActive: boolean;
  presenceOwned: boolean;
  /** Physical influences on the face mesh after the write. */
  glb: Record<string, number>;
  innerApertureMM: number;
  marginApertureMM: number;
  innerLowerDropMM: number;
};

export type Hyper3dMouthProbe = {
  sample(input: {
    context: { timeSeconds: number; audioLevel: number; conversation: { isSpeaking: boolean } };
    frame: AvatarFrameState | null;
    trace: Hyper3dMouthTrace | undefined;
    payload: AvatarPayload;
    turnId: number;
  }): void;
};

const pick = (pose: Record<string, number | undefined> | undefined) => {
  const out: Record<string, number> = {};
  for (const name of TRACKED) {
    const value = pose?.[name];
    if (value !== undefined && Math.abs(value) > 1e-4) out[name] = +value.toFixed(4);
  }
  return out;
};

/** Landmarks, exactly as the Stage 1B measurement script derives them. */
function landmarks(mesh: THREE.Mesh) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const base = geometry.attributes.position.array as ArrayLike<number>;
  const count = geometry.attributes.position.count;
  const dictionary = mesh.morphTargetDictionary ?? {};
  const deltas = geometry.morphAttributes.position ?? [];
  const deltaOf = (name: string) => {
    const index = dictionary[name];
    return index === undefined ? null : (deltas[index]?.array as ArrayLike<number> | undefined) ?? null;
  };
  const topVerts = (name: string, k: number) => {
    const d = deltaOf(name);
    if (!d) return [] as number[];
    const mags: Array<[number, number]> = [];
    for (let v = 0; v < count; v += 1) mags.push([d[v * 3] ** 2 + d[v * 3 + 1] ** 2 + d[v * 3 + 2] ** 2, v]);
    mags.sort((a, b) => b[0] - a[0]);
    return mags.slice(0, k).map((e) => e[1]);
  };
  const upper = topVerts("mouthRollUpper", 120);
  const lower = topVerts("mouthRollLower", 120);
  const mean = (list: number[], axis: number) => list.reduce((s, v) => s + base[v * 3 + axis], 0) / Math.max(1, list.length);
  // Mouth centre from the lip morphs themselves, so this works on any asset.
  const centre = [0, 1, 2].map((axis) => mean([...upper, ...lower], axis));
  const nearMid = (v: number) => Math.abs(base[v * 3] - centre[0]) < 1.2;

  const index = geometry.index?.array as ArrayLike<number> | undefined;
  const edgeUse = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  if (index) {
    for (let t = 0; t < index.length; t += 3) {
      const tri = [index[t], index[t + 1], index[t + 2]];
      for (const [p, q] of [[tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]]]) {
        edgeUse.set(key(p, q), (edgeUse.get(key(p, q)) ?? 0) + 1);
      }
    }
  }
  const boundary = [
    ...new Set([...edgeUse.entries()].filter(([, uses]) => uses === 1).flatMap(([k]) => k.split("_").map(Number))),
  ];
  const near = boundary.filter(
    (v) => Math.hypot(base[v * 3] - centre[0], base[v * 3 + 1] - centre[1], base[v * 3 + 2] - centre[2]) * MM < 30,
  );
  const zs = near.map((v) => base[v * 3 + 2]);
  const midZ = (Math.min(...zs) + Math.max(...zs)) / 2;
  return {
    base,
    dictionary,
    deltas,
    innerLower: near.filter((v) => base[v * 3 + 2] >= midZ),
    innerUpper: near.filter((v) => base[v * 3 + 2] < midZ),
    marginUpper: upper.filter(nearMid),
    marginLower: lower.filter(nearMid),
  };
}

export function createHyper3dMouthProbe(face: THREE.Mesh | null, meta: { assetUrl: string; correctiveProfile: boolean; showcaseEnabled: boolean }): Hyper3dMouthProbe {
  const lm = face?.morphTargetInfluences ? landmarks(face) : null;
  const frames: ProbeFrame[] = [];
  let armed = false;

  /** Vertical (z) mean of a vertex list under the mesh's CURRENT influences. */
  const meanZ = (list: number[], influences: ArrayLike<number> | null) => {
    if (!lm || !list.length) return 0;
    let sum = 0;
    for (const v of list) {
      let z = lm.base[v * 3 + 2];
      if (influences) {
        for (let i = 0; i < influences.length; i += 1) {
          const w = influences[i];
          if (w) {
            const d = lm.deltas[i]?.array as ArrayLike<number> | undefined;
            if (d) z += w * d[v * 3 + 2];
          }
        }
      }
      sum += z;
    }
    return sum / list.length;
  };
  const neutral = lm
    ? {
        inner: (meanZ(lm.innerLower, null) - meanZ(lm.innerUpper, null)) * MM,
        margin: (meanZ(lm.marginLower, null) - meanZ(lm.marginUpper, null)) * MM,
        innerLower: meanZ(lm.innerLower, null),
      }
    : { inner: 0, margin: 0, innerLower: 0 };

  const config = () => ({
    assetUrl: meta.assetUrl,
    faceMesh: face?.name ?? null,
    faceMorphCount: face?.morphTargetInfluences?.length ?? 0,
    mouthLowerDownDeepPresent: Boolean(lm && lm.dictionary.mouthLowerDownDeep !== undefined),
    correctiveProfileActive: meta.correctiveProfile,
    devShowcaseEnabled: meta.showcaseEnabled,
    landmarkCounts: lm
      ? { innerUpper: lm.innerUpper.length, innerLower: lm.innerLower.length, marginUpper: lm.marginUpper.length, marginLower: lm.marginLower.length }
      : null,
    neutralApertureMM: { inner: +neutral.inner.toFixed(2), margin: +neutral.margin.toFixed(2) },
  });

  // ActiveSession's analyser drive is `22 + rms × 980`: 22 is digital silence.
  const audible = (f: ProbeFrame) => f.audioLevel > 30;
  const open = (f: ProbeFrame) => f.innerApertureMM - neutral.inner;

  const report = () => {
    const lines: string[] = ["# Hyper3D live mouth probe", "", "## Live configuration", "```json", JSON.stringify(config(), null, 2), "```", ""];
    const speech = frames.filter(audible);
    lines.push(`frames recorded ${frames.length}, audible ${speech.length}`);
    if (!speech.length) {
      lines.push("", "NO AUDIBLE FRAMES — arm with start() before the reply, and keep this tab visible.");
      return lines.join("\n");
    }
    const glbMax = (f: ProbeFrame) => Math.max(0, ...Object.entries(f.glb).filter(([k]) => k !== "mouthClose").map(([, v]) => v));
    const ctrlMax = (f: ProbeFrame) => Math.max(0, ...Object.entries(f.smoothed).filter(([k]) => k !== "mouthClose").map(([, v]) => v));
    const count = (pred: (f: ProbeFrame) => boolean) => speech.filter(pred).length;
    lines.push(
      "",
      "## Audible frames, classified",
      `- no active phoneme: ${count((f) => !f.phoneme)}`,
      `- clock pinned at timeline end: ${count((f) => f.clockAtTimelineEnd)}`,
      `- React isSpeaking false: ${count((f) => !f.isSpeaking)}`,
      `- showcase active: ${count((f) => f.showcaseActive)}`,
      `- controller mouth < 0.05: ${count((f) => ctrlMax(f) < 0.05)}`,
      `- final GLB mouth < 0.05: ${count((f) => glbMax(f) < 0.05)}`,
      `- GLB mouth >= 0.10 but inner aperture < +1 mm: ${count((f) => glbMax(f) >= 0.1 && open(f) < 1)}`,
      `- inner aperture >= +2 mm (visibly open): ${count((f) => open(f) >= 2)}`,
      `- turn ids seen: ${[...new Set(speech.map((f) => f.turnId))].join(", ")}`,
    );
    const firstStall = speech.find((f, i) => i > 30 && open(f) < 1 && speech.slice(i, i + 30).every((g) => open(g) < 1));
    lines.push("", `first audible 0.5 s stretch with aperture < +1 mm: ${firstStall ? `wall +${((firstStall.wallMs - speech[0].wallMs) / 1000).toFixed(2)} s, clock ${firstStall.clock.toFixed(3)}` : "none"}`);
    lines.push(
      "",
      "## Timeline (every 100 ms of audible speech)",
      "| wall s | clock | dur | lvl | spk | ph | jaw ctrl | jaw GLB | lowerDn GLB | deep GLB | supp | showcase | inner mm | open mm |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    );
    let next = speech[0].wallMs;
    for (const f of speech) {
      if (f.wallMs < next) continue;
      next = f.wallMs + 100;
      const lowerDn = Math.max(f.glb.mouthLowerDownLeft ?? 0, f.glb.mouthLowerDownRight ?? 0);
      lines.push(
        `| ${((f.wallMs - speech[0].wallMs) / 1000).toFixed(2)} | ${f.clock.toFixed(3)} | ${f.audioDuration.toFixed(2)} | ${f.audioLevel.toFixed(0)} | ${f.isSpeaking ? "y" : "N"} | ${f.phoneme ?? "-"} | ` +
          `${(f.smoothed.jawOpen ?? 0).toFixed(3)} | ${(f.glb.jawOpen ?? 0).toFixed(3)} | ${lowerDn.toFixed(3)} | ${(f.glb.mouthLowerDownDeep ?? 0).toFixed(3)} | ` +
          `${f.corrective ? f.corrective.suppression.toFixed(2) : "-"} | ${f.showcaseActive ? "ON" : "-"} | ${f.innerApertureMM.toFixed(2)} | ${open(f).toFixed(2)} |`,
      );
    }
    return lines.join("\n");
  };

  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__solaceHyper3dMouthProbe = {
      start() {
        frames.length = 0;
        armed = true;
        return config();
      },
      stop() {
        armed = false;
        return `${frames.length} frames`;
      },
      status: () => ({ armed, frames: frames.length, ...config() }),
      report,
      json: () => JSON.stringify({ config: config(), frames }),
    };
  }

  return {
    sample({ context, frame, trace, payload, turnId }) {
      if (!armed || frames.length >= MAX_FRAMES) return;
      const t = context.timeSeconds;
      const active = frame?.debug.currentPhoneme
        ? payload.phonemes.find((p) => t >= p.start_time && t < p.end_time)
        : undefined;
      const influences = face?.morphTargetInfluences ?? null;
      const glb: Record<string, number> = {};
      if (face?.morphTargetDictionary && influences) {
        for (const name of TRACKED) {
          const index = face.morphTargetDictionary[name];
          if (index !== undefined && Math.abs(influences[index]) > 1e-4) glb[name] = +influences[index].toFixed(4);
        }
      }
      const correctiveDebug = frame?.debug.correctiveLowerLip;
      frames.push({
        wallMs: Math.round(globalThis.performance.now()),
        clock: +t.toFixed(4),
        audioDuration: +payload.audio_duration.toFixed(3),
        clockAtTimelineEnd: payload.audio_duration > 0 && t >= payload.audio_duration - 1e-4,
        audioLevel: +context.audioLevel.toFixed(2),
        isSpeaking: context.conversation.isSpeaking,
        turnId,
        phonemeCount: payload.phonemes.length,
        phoneme: frame?.debug.currentPhoneme ?? null,
        phonemeRange: active ? [+active.start_time.toFixed(3), +active.end_time.toFixed(3)] : null,
        speechActivity: +(frame?.debug.speechEnvelope?.speechActivity ?? 0).toFixed(3),
        corrective: correctiveDebug
          ? { requested: +correctiveDebug.requested.toFixed(4), suppression: +correctiveDebug.suppression.toFixed(3) }
          : null,
        target: pick(frame?.targetPose),
        smoothed: pick(frame?.outputPose),
        calibrated: trace?.preOwnership.channels ? pick(trace.preOwnership.channels) : {},
        final: trace?.final.channels ? pick(trace.final.channels) : {},
        showcaseActive: trace?.showcaseActive ?? false,
        presenceOwned: trace?.presenceOwned ?? false,
        glb,
        innerApertureMM: lm ? +((meanZ(lm.innerLower, influences) - meanZ(lm.innerUpper, influences)) * MM).toFixed(3) : 0,
        marginApertureMM: lm ? +((meanZ(lm.marginLower, influences) - meanZ(lm.marginUpper, influences)) * MM).toFixed(3) : 0,
        innerLowerDropMM: lm ? +((meanZ(lm.innerLower, influences) - neutral.innerLower) * MM).toFixed(3) : 0,
      });
    },
  };
}

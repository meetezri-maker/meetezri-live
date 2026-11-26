/**
 * TEMPORARY LOCAL TRIAL HARNESS — full-body rig test page.
 *
 * Not imported by the app. Loaded on demand by `apps/web/__body-trial.html`,
 * which lives at the Vite root (NOT in `public/`) so the dev server serves it and
 * the production build — whose rollup inputs are listed explicitly — never does.
 *
 * Three layers, so a model can be swapped without leaking anything:
 *
 *   TrialStage   created ONCE per page: one WebGLRenderer (one context), one
 *                render loop, one OrbitControls, one neutral light rig.
 *   LoadedAsset  one parsed GLB: its root, the resources it OWNS, its file info
 *                and (original trial only, on request) the production
 *                material/appearance passes.
 *   RigSession   controls built from THAT asset's own skeleton and morphs: role
 *                mapping, rest snapshot, joint controls, tests, diagnostics.
 *                Rebuilt on a role override without reloading the file.
 *
 * Local files are read with `File.arrayBuffer()` and parsed in the browser by the
 * project's GLTFLoader. Nothing is uploaded or stored. A GLB that references any
 * non-embedded resource is rejected BEFORE parsing, and the loader's URL modifier
 * blocks any non-`data:`/`blob:` request as a second guard.
 *
 * Body joints are driven RELATIVE TO EACH BONE'S AUTHORED REST ROTATION:
 * `q = rest * Rx * Ry * Rz * Rtwist`. Anatomical labels, the finger-curl sign,
 * the semantic head controller and Sasha's gaze/morph calibration are used ONLY
 * when the rig matches the one they were measured on (`analyseRig().compatible`).
 *
 * DELETE THIS FILE, `src/__bodyTrialRig.ts`, `src/__bodyTrialRig.test.ts` AND
 * `apps/web/__body-trial.html` WHEN THE TRIAL IS OVER.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

import { applyHyper3dGlbMaterials } from "@/lib/avatar/hyper3d/engine/components/avatar/hyper3dMaterials";
import { applyAcceptedHyper3dAppearance, type Hyper3dAppearanceHandle } from "@/lib/avatar/hyper3d/hyper3dAppearance";
import {
  avatarModelConfigs,
  hyper3dConfigForAsset,
  hyper3dPreservesAuthoredHair,
  hyper3dUsesSharedFaceMaps,
  type AvatarModelConfig,
} from "@/lib/avatar/hyper3d/engine/mappings/avatarModelConfig";
import { calibrateHyper3dPose } from "@/lib/avatar/hyper3d/engine/mappings/avatars/hyper3dCalibration";
import { BoneController } from "@/lib/avatar/hyper3d/engine/engine/avatar/BoneController";
import { Hyper3dEyeBoneGaze } from "@/lib/avatar/hyper3d/engine/engine/avatar/Hyper3dEyeBoneGaze";
import { MorphTargetController } from "@/lib/avatar/hyper3d/engine/engine/avatar/MorphTargetController";
import { attachHeadMeshes } from "@/lib/avatar/hyper3d/engine/engine/avatar/attachHeadMeshes";
import { IDENTITY_BONE_AXIS_SIGN } from "@/lib/avatar/hyper3d/engine/engine/avatar/hyper3dRigAdapter";
import type { HeadMotionPose } from "@/lib/avatar/hyper3d/engine/types/facialAnimation";

import {
  ALL_ROLES,
  ARM_JOINTS,
  FINGERS,
  PHALANGES,
  SIDES,
  TORSO_ROLES,
  analyseRig,
  collectOwned,
  disposeOwned,
  formatBytes,
  overrideRole,
  validateGlbBytes,
  type OwnedResources,
  type RigAnalysis,
} from "./__bodyTrialRig";

export { SIDES, ARM_JOINTS, FINGERS, PHALANGES, TORSO_ROLES, formatBytes };

export const TRIAL_URL = "/avatars/hyper3d/trial/straight_16_11.glb";
export const TRIAL_FILE_NAME = "straight_16_11.glb";

/**
 * Sasha's production config — used ONLY for the bundled trial file (and rigs
 * compatible with it), whose head/eyes/teeth/lashes/hair were measured identical
 * to `sasha.glb`. Read-only: nothing here writes to the shared config.
 */
const SASHA: AvatarModelConfig = hyper3dConfigForAsset(avatarModelConfigs["hyper3d-usc"], "hyper3d_sasha");
const BODY_HEAD_CONFIG: AvatarModelConfig = {
  ...SASHA,
  boneNames: { ...SASHA.boneNames, head: ["Head"], neck: ["Neck"] },
  boneAxisSign: IDENTITY_BONE_AXIS_SIGN,
};

const DEG = Math.PI / 180;
const AXES = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) } as const;
export type AxisName = keyof typeof AXES;
const AXIS_NAMES: AxisName[] = ["X", "Y", "Z"];

type Offsets = { X: number; Y: number; Z: number; twist: number };
const zeroOffsets = (): Offsets => ({ X: 0, Y: 0, Z: 0, twist: 0 });
type Rot = { pitch: number; yaw: number; roll: number };
const zeroRot = (): Rot => ({ pitch: 0, yaw: 0, roll: 0 });

export type AppearanceMode = "neutral" | "production";
export type CameraPreset = "full" | "waist" | "face" | "leftHand" | "rightHand" | "production";

export interface AxisMeasurement {
  /** Child-joint displacement for +10 deg about this local axis, in the model's own space, mm. */
  deltaMm: [number, number, number];
  reading: string;
}

export interface JointRecord {
  role: string;
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  twistAxis: THREE.Vector3;
  target: Offsets;
  current: Offsets;
  layer: Offsets;
  measured: Record<AxisName, AxisMeasurement>;
}

export interface FingerRecord {
  key: string;
  joints: JointRecord[];
  /** "anatomical": compatible rig, measured curl axis and visually-confirmed sign. "local": raw local axes. */
  mode: "anatomical" | "local";
  curlAxis: AxisName;
  curlShare: number;
  curlSign: 1 | -1;
  spreadAxis: AxisName;
  curl: { target: number; current: number; layer: number };
  spread: { target: number; current: number; layer: number };
  local: { target: Offsets; current: Offsets };
}

export interface Availability { available: boolean; reason: string }
export interface TestInfo extends Availability { id: string; label: string }

export interface LoadStatus {
  state: "idle" | "loading" | "ready" | "error";
  message: string;
  fileName?: string;
  bytes?: number;
  source?: "original" | "local";
}

// ── Loading ──────────────────────────────────────────────────────────────────

/** Parses GLB bytes with the project's GLTFLoader. No network: only data:/blob: URLs pass. */
async function parseGlb(buffer: ArrayBuffer) {
  const blocked: string[] = [];
  const blobs = new Set<string>();
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith("blob:")) {
      blobs.add(url);
      return url;
    }
    if (url.startsWith("data:")) return url;
    blocked.push(url);
    return "data:application/octet-stream;base64,";
  });
  try {
    const gltf = await new GLTFLoader(manager).parseAsync(buffer, "");
    if (blocked.length) throw new Error(`The file asked for external resources, which were blocked: ${blocked.slice(0, 4).join(", ")}`);
    return gltf;
  } finally {
    for (const b of blobs) URL.revokeObjectURL(b);
  }
}

export interface LoadedAsset {
  root: THREE.Group;
  owned: OwnedResources;
  source: "original" | "local";
  fileName: string;
  bytes: number;
  parseMs: number;
  appearance: AppearanceMode;
  appearanceHandle: Hyper3dAppearanceHandle | null;
  report: Record<string, unknown>;
  animationClips: number;
}

// ── Stage ────────────────────────────────────────────────────────────────────

export class TrialStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);
  readonly controls: OrbitControls;
  asset: LoadedAsset | null = null;
  session: RigSession | null = null;
  status: LoadStatus = { state: "idle", message: "No model loaded." };
  readonly stats = { frameMs: [] as number[], cpuMs: [] as number[], renderMs: [] as number[] };
  readonly lastDisposal: Record<string, unknown>[] = [];
  private neutral = new THREE.Group();
  private neutralEnv: THREE.Texture;
  private loadSeq = 0;
  private synthetic = false;
  private last = performance.now();
  private statusListeners = new Set<(s: LoadStatus) => void>();
  private modelListeners = new Set<() => void>();
  private rafCount = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.neutralEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3f48, 0.6);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1.5, 3, 4);
    this.neutral.add(hemi, key);
    this.neutral.name = "__trialNeutralLights";
    this.scene.add(this.neutral);
    this.applyNeutralRenderer();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    requestAnimationFrame(this.frame);
  }

  /** The SAME light/tone settings for every model. Production passes override these and are restored after. */
  private applyNeutralRenderer() {
    this.neutral.visible = true;
    this.scene.environment = this.neutralEnv;
    this.scene.environmentIntensity = 0.6;
    this.scene.background = null;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
  }

  onStatus(cb: (s: LoadStatus) => void) { this.statusListeners.add(cb); cb(this.status); }
  onModel(cb: () => void) { this.modelListeners.add(cb); }
  private setStatus(s: LoadStatus) { this.status = s; for (const cb of this.statusListeners) cb(s); }

  private resize() {
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Bundled trial file. Fetched from the dev server, never modified. */
  async loadOriginal(appearance: AppearanceMode) {
    const seq = ++this.loadSeq;
    this.setStatus({ state: "loading", message: `Loading original trial (${TRIAL_FILE_NAME})…`, fileName: TRIAL_FILE_NAME, source: "original" });
    try {
      const res = await fetch(TRIAL_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${TRIAL_URL}`);
      const buf = await res.arrayBuffer();
      if (seq !== this.loadSeq) return { stale: true };
      return await this.loadBytes(seq, buf, { source: "original", fileName: TRIAL_FILE_NAME, appearance });
    } catch (e) {
      return this.fail(seq, TRIAL_FILE_NAME, undefined, "original", e);
    }
  }

  /** A file the user picked. Read locally; nothing is uploaded or stored. */
  async loadFile(file: File) {
    const seq = ++this.loadSeq;
    this.setStatus({ state: "loading", message: `Reading ${file.name} locally…`, fileName: file.name, bytes: file.size, source: "local" });
    try {
      if (!/\.glb$/i.test(file.name)) throw new Error("Only a single binary glTF file with the .glb extension is accepted.");
      const buf = await file.arrayBuffer();
      if (seq !== this.loadSeq) return { stale: true };
      return await this.loadBytes(seq, buf, { source: "local", fileName: file.name, appearance: "neutral" });
    } catch (e) {
      return this.fail(seq, file.name, file.size, "local", e);
    }
  }

  private fail(seq: number, fileName: string, bytes: number | undefined, source: "original" | "local", e: unknown) {
    if (seq !== this.loadSeq) return { stale: true };
    const kept = this.asset ? ` The previous model (${this.asset.fileName}) is still loaded.` : "";
    this.setStatus({ state: "error", message: `${(e as Error)?.message ?? String(e)}${kept}`, fileName, bytes, source });
    return { error: (e as Error)?.message ?? String(e) };
  }

  private async loadBytes(seq: number, buf: ArrayBuffer, info: { source: "original" | "local"; fileName: string; appearance: AppearanceMode }) {
    const validation = validateGlbBytes(buf);
    if (!validation.ok) throw new Error(validation.error);
    this.setStatus({ state: "loading", message: `Parsing ${info.fileName} (${formatBytes(buf.byteLength)})…`, fileName: info.fileName, bytes: buf.byteLength, source: info.source });
    const t0 = performance.now();
    const gltf = await parseGlb(buf);
    const parseMs = performance.now() - t0;
    const root = gltf.scene;
    const owned = collectOwned(root);
    const discard = () => disposeOwned(root, owned);
    if (seq !== this.loadSeq) { discard(); return { stale: true }; }

    let asset: LoadedAsset;
    let session: RigSession;
    try {
      let meshes = 0;
      root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      if (!meshes) throw new Error("The GLB parsed but contains no meshes.");
      const report: Record<string, unknown> = { file: info.fileName, source: info.source, bytes: buf.byteLength, size: formatBytes(buf.byteLength), parseMs: +parseMs.toFixed(1), gltf: validation.summary, animationClipsInFile: gltf.animations.length };
      // Placement: the original trial uses Sasha's production placement; any other file stays as authored.
      if (info.source === "original") {
        root.scale.set(...SASHA.scale);
        root.position.set(...SASHA.position);
        report.placement = `Sasha production placement (scale ${SASHA.scale[0]}, position ${SASHA.position.join(", ")})`;
      } else {
        report.placement = "As authored in the file (no rescale or offset).";
      }
      root.updateMatrixWorld(true);
      const appearance: AppearanceMode = info.source === "original" ? info.appearance : "neutral";
      if (appearance === "production") {
        report.appearanceOverrides = [
          "TRIAL OVERRIDE: production GLB material pass (applyHyper3dGlbMaterials, f228-profile) with Sasha's config.",
          "TRIAL OVERRIDE: production appearance (applyAcceptedHyper3dAppearance): its own lights, environment and tone mapping replace the neutral rig.",
        ];
        report.materialPass = applyHyper3dGlbMaterials(root, SASHA.hyper3dMaterials!.textureBaseUrl, "f228-profile", undefined, "evened", hyper3dUsesSharedFaceMaps(SASHA));
      } else {
        report.appearanceOverrides = ["None. Materials and textures exactly as authored in the file; neutral studio lights (same for every model)."];
      }
      asset = { root, owned, source: info.source, fileName: info.fileName, bytes: buf.byteLength, parseMs, appearance, appearanceHandle: null, report, animationClips: gltf.animations.length };
      session = new RigSession(this, asset, { overrides: new Map(), ignoreTrialConventions: false });
    } catch (e) {
      discard();
      throw e;
    }
    if (seq !== this.loadSeq) { session.dispose(); discard(); return { stale: true }; }

    // ── Swap: synchronous from here, so no other load can interleave.
    const previous = this.asset;
    this.session?.dispose();
    this.session = null;
    if (previous) this.lastDisposal.unshift({ file: previous.fileName, ...this.disposeAsset(previous) });
    this.lastDisposal.length = Math.min(this.lastDisposal.length, 5);
    this.scene.add(root);
    if (asset.appearance === "production") {
      this.neutral.visible = false;
      asset.appearanceHandle = applyAcceptedHyper3dAppearance(root, this.scene, this.renderer, { preserveAuthoredHair: hyper3dPreservesAuthoredHair(SASHA) });
    }
    this.asset = asset;
    session.attach();
    this.session = session;
    this.resetStats();
    this.setCamera("waist");
    this.setStatus({ state: "ready", message: `Loaded ${info.fileName} (${formatBytes(buf.byteLength)}) in ${parseMs.toFixed(0)} ms.`, fileName: info.fileName, bytes: buf.byteLength, source: info.source });
    for (const cb of this.modelListeners) cb();
    return { ok: true };
  }

  private disposeAsset(asset: LoadedAsset) {
    asset.appearanceHandle?.dispose();
    asset.appearanceHandle = null;
    this.applyNeutralRenderer();
    return disposeOwned(asset.root, asset.owned);
  }

  /** Rebuild controls for the SAME loaded asset (role override / convention toggle). No reload. */
  rebuildSession(opts: { overrides?: Map<string, string | null>; ignoreTrialConventions?: boolean }) {
    if (!this.asset || !this.session) return;
    const prev = this.session;
    const next = new RigSession(this, this.asset, {
      overrides: opts.overrides ?? prev.overrides,
      ignoreTrialConventions: opts.ignoreTrialConventions ?? prev.ignoreTrialConventions,
    });
    prev.dispose();
    next.attach();
    this.session = next;
    this.resetStats();
    for (const cb of this.modelListeners) cb();
  }

  resetStats() { this.stats.frameMs.length = 0; this.stats.cpuMs.length = 0; this.stats.renderMs.length = 0; }

  private frame = () => {
    this.rafCount++;
    if (!this.synthetic) {
      const now = performance.now();
      const dt = Math.min((now - this.last) / 1000, 0.1);
      push(this.stats.frameMs, now - this.last);
      this.last = now;
      const c0 = performance.now();
      this.session?.step(now, dt);
      push(this.stats.cpuMs, performance.now() - c0);
      this.controls.update();
      const r0 = performance.now();
      this.renderer.render(this.scene, this.camera);
      push(this.stats.renderMs, performance.now() - r0);
    }
    requestAnimationFrame(this.frame);
  };

  /** Diagnostics: proves one loop per page. */
  get loopFrames() { return this.rafCount; }

  setCamera(preset: CameraPreset) {
    const a = this.asset;
    const s = this.session;
    if (!a || !s) return;
    a.root.updateMatrixWorld(true);
    const box = s.restBox;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const h = size.y || 1;
    const fit = (lo: THREE.Vector3, hi: THREE.Vector3, width: number, dir = new THREE.Vector3(0, 0, 1)) => {
      const c = lo.clone().add(hi).multiplyScalar(0.5);
      const span = Math.max(hi.y - lo.y, width / Math.max(this.camera.aspect, 0.3)) * 1.15;
      this.camera.fov = 30;
      const dist = span / 2 / Math.tan((this.camera.fov * DEG) / 2);
      this.camera.position.copy(c).add(dir.clone().normalize().multiplyScalar(dist));
      this.camera.near = Math.max(dist / 200, 1e-4);
      this.camera.far = dist * 200;
      this.controls.target.copy(c);
    };
    const wp = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3());
    const head = s.boneForRole("Head");
    const hips = s.hipsBone;
    if (preset === "full") fit(new THREE.Vector3(centre.x, box.min.y, centre.z), new THREE.Vector3(centre.x, box.max.y, centre.z), size.x);
    if (preset === "waist") {
      const lo = hips ? wp(hips).y : box.min.y + 0.45 * h;
      fit(new THREE.Vector3(centre.x, lo, centre.z), new THREE.Vector3(centre.x, box.max.y, centre.z), size.x * 0.9);
    }
    if (preset === "face") {
      if (head) {
        const p = wp(head);
        fit(new THREE.Vector3(p.x, p.y - 0.06 * h, p.z), new THREE.Vector3(p.x, Math.min(box.max.y, p.y + 0.1 * h), p.z), 0.12 * h);
      } else fit(new THREE.Vector3(centre.x, box.max.y - 0.16 * h, centre.z), new THREE.Vector3(centre.x, box.max.y, centre.z), 0.16 * h);
    }
    if (preset === "leftHand" || preset === "rightHand") {
      const hand = s.boneForRole(preset === "leftHand" ? "LeftHand" : "RightHand");
      if (!hand) return;
      const p = wp(hand);
      const side = Math.sign(p.x - centre.x) || 1;
      fit(new THREE.Vector3(p.x, p.y - 0.07 * h, p.z), new THREE.Vector3(p.x, p.y + 0.02 * h, p.z), 0.09 * h, new THREE.Vector3(0.8 * side, 0, 0.6));
    }
    if (preset === "production") {
      if (a.source !== "original") return;
      this.camera.fov = SASHA.camera.fov;
      this.camera.position.set(...SASHA.camera.position);
      this.controls.target.set(...SASHA.camera.target);
      this.camera.near = 0.02;
      this.camera.far = 100;
    }
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /** Vsync-independent timing; `gl.finish()` makes it include GPU work (upper bound). */
  syncBenchmark(frames: number, withBody: boolean) {
    const s = this.session;
    if (!s) return { error: "No model loaded." };
    this.synthetic = true;
    const gl = this.renderer.getContext();
    const cpu: number[] = [], submit: number[] = [], finish: number[] = [];
    const saved = { name: s.test.name, blink: s.face.blink, speech: s.face.speech };
    const testId = s.tests.find((t) => t.id === (s.compatible ? "combined" : "localCombined"))!;
    if (withBody && testId.available) s.startTest(testId.id);
    else { s.test.name = null; s.face.blink = s.features.blink.available; s.face.speech = s.features.speech.available; }
    let now = performance.now();
    try {
      for (let i = 0; i < 20; i++) { now += 1000 / 60; s.step(now, 1 / 60); this.renderer.render(this.scene, this.camera); }
      gl.finish();
      for (let i = 0; i < frames; i++) {
        now += 1000 / 60;
        const c0 = performance.now();
        s.step(now, 1 / 60);
        const c1 = performance.now();
        this.renderer.render(this.scene, this.camera);
        const c2 = performance.now();
        gl.finish();
        const c3 = performance.now();
        cpu.push(c1 - c0); submit.push(c2 - c1); finish.push(c3 - c1);
      }
    } finally {
      s.test.name = saved.name; s.face.blink = saved.blink; s.face.speech = saved.speech;
      this.synthetic = false;
      this.last = performance.now();
    }
    const q = (arr: number[], p: number) => { const x = [...arr].sort((m, n) => m - n); return +x[Math.min(x.length - 1, Math.floor(x.length * p))].toFixed(3); };
    return {
      model: this.asset?.fileName,
      mode: withBody ? `${testId.label} (body + available face)` : "face only (body at rest)",
      frames,
      cpuUpdateMs: { median: q(cpu, 0.5), p95: q(cpu, 0.95) },
      renderSubmitMs: { median: q(submit, 0.5), p95: q(submit, 0.95) },
      renderPlusGpuFinishMs: { median: q(finish, 0.5), p95: q(finish, 0.95) },
    };
  }

  async benchmark(seconds: number) {
    const s = this.session;
    if (!s) return { error: "No model loaded." };
    this.resetStats();
    const all = { frame: [] as number[], cpu: [] as number[], render: [] as number[] };
    const testId = s.compatible ? "combined" : "localCombined";
    if (s.tests.find((t) => t.id === testId)?.available) s.startTest(testId);
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end) {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      all.frame.push(this.stats.frameMs[this.stats.frameMs.length - 1] ?? 0);
      all.cpu.push(this.stats.cpuMs[this.stats.cpuMs.length - 1] ?? 0);
      all.render.push(this.stats.renderMs[this.stats.renderMs.length - 1] ?? 0);
    }
    s.stopTest();
    const q = (a: number[], p: number) => { const x = [...a].sort((m, n) => m - n); return +x[Math.min(x.length - 1, Math.floor(x.length * p))].toFixed(2); };
    const gl = this.renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      model: this.asset?.fileName,
      note: "rAF-paced: frame interval is vsync-bound and throttled when the page is hidden. cpu = controllers + matrix update; render = renderer.render() submit (CPU side).",
      frames: all.frame.length,
      frameIntervalMs: { median: q(all.frame, 0.5), p95: q(all.frame, 0.95) },
      cpuUpdateMs: { median: q(all.cpu, 0.5), p95: q(all.cpu, 0.95) },
      renderSubmitMs: { median: q(all.render, 0.5), p95: q(all.render, 0.95) },
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      gpuMemory: { geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures, programs: this.renderer.info.programs?.length ?? null },
      glRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  }
}

const push = (arr: number[], v: number) => { arr.push(v); if (arr.length > 240) arr.shift(); };
const smoothstep = (x: number) => { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); };

// ── Rig session ──────────────────────────────────────────────────────────────

export class RigSession {
  readonly analysis: RigAnalysis;
  readonly compatible: boolean;
  readonly overrides: Map<string, string | null>;
  readonly ignoreTrialConventions: boolean;
  readonly joints = new Map<string, JointRecord>();
  readonly fingers = new Map<string, FingerRecord>();
  readonly report: Record<string, unknown> = {};
  readonly restBox: THREE.Box3;
  readonly hipsBone: THREE.Bone | null;
  readonly head = { target: zeroRot(), current: zeroRot(), layer: zeroRot() };
  readonly neck = { target: zeroRot(), current: zeroRot(), layer: zeroRot() };
  readonly gaze = { target: { yaw: 0, pitch: 0 }, current: { yaw: 0, pitch: 0 }, layer: { yaw: 0, pitch: 0 } };
  readonly face = { blink: false, speech: false, smile: 0, manual: {} as Record<string, number> };
  readonly test = { name: null as string | null, startedAt: 0, stopAt: null as number | null };
  readonly features: {
    headMode: "semantic" | "local" | "none";
    headReason: string;
    runtimeHeadCompare: Availability;
    gaze: Availability;
    blink: Availability;
    speech: Availability;
    smile: Availability;
    hairMeshes: string[];
    meshes: string[];
    measurements: Record<string, Availability>;
  };
  readonly tests: TestInfo[];
  readonly morphNames: string[];
  headBinding: "body" | "runtime" = "body";
  private readonly root: THREE.Object3D;
  private readonly restBones = new Map<THREE.Bone, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
  private readonly restMorphs = new Map<THREE.Mesh, number[]>();
  private readonly helpers: THREE.SkeletonHelper[] = [];
  private readonly helperGroups: Array<{ label: string; helper: THREE.SkeletonHelper }> = [];
  private bodyBones: BoneController | null = null;
  private runtimeBones: BoneController | null = null;
  private gazeCtl: Hyper3dEyeBoneGaze | null = null;
  private morph: MorphTargetController;
  private calibrate: boolean;
  private motionAxes: Record<"flex" | "abduct", Record<string, { axis: AxisName; sign: 1 | -1 }>> = { flex: {}, abduct: {} };
  private measureCtx: Record<string, unknown> = {};
  private nextBlink = 1.5;
  private blinkStart = -10;
  private disposed = false;

  constructor(private readonly stage: TrialStage, private readonly asset: LoadedAsset, opts: { overrides: Map<string, string | null>; ignoreTrialConventions: boolean }) {
    this.root = asset.root;
    this.overrides = new Map(opts.overrides);
    this.ignoreTrialConventions = opts.ignoreTrialConventions;
    const root = this.root;
    root.updateMatrixWorld(true);

    // Authored rest of EVERY bone and every morph influence, from this model.
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone) this.restBones.set(b, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() });
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetInfluences) this.restMorphs.set(m, [...m.morphTargetInfluences]);
    });
    this.restBox = new THREE.Box3().setFromObject(root, true);

    this.analysis = analyseRig(root, { ignoreTrialConventions: opts.ignoreTrialConventions });
    for (const [role, bone] of this.overrides) overrideRole(this.analysis, role, bone);
    // An override can break compatibility (e.g. Head mapped to "head").
    this.compatible = this.analysis.compatible && [...this.overrides].every(([r, b]) => b === r);
    if (this.analysis.compatible && !this.compatible) this.analysis.compatibilityReasons.push("A role override departs from the trial rig, so trial conventions are switched off.");
    this.hipsBone = (this.analysis.bones.get("Hips") ?? this.analysis.bones.get("mixamorigHips"))?.bone ?? null;

    const meshes: string[] = [];
    root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o.name || "(unnamed)"); });
    const hairMeshes = meshes.filter((n) => /hair/i.test(n));

    // ── Body joints from THIS model's skeleton.
    const bodyRoles = [...TORSO_ROLES, ...SIDES.flatMap((s) => ARM_JOINTS.map((j) => `${s}${j}`)), ...SIDES.flatMap((s) => FINGERS.flatMap((f) => PHALANGES.map((p) => `${s}${f}${p}`)))];
    const headNeckLocal = !this.compatible;
    if (headNeckLocal) bodyRoles.push("Neck", "Head");
    for (const role of bodyRoles) {
      const bone = this.boneForRole(role);
      if (bone) this.joints.set(role, this.makeJoint(role, bone));
    }
    for (const s of SIDES) for (const f of FINGERS) this.makeFinger(s, f);

    if (this.compatible) {
      const axisToward = (joint: string, component: 0 | 1 | 2) => {
        const m = this.joints.get(joint)?.measured;
        if (!m) return null;
        let best: AxisName = "X";
        for (const a of AXIS_NAMES) if (Math.abs(m[a].deltaMm[component]) > Math.abs(m[best].deltaMm[component])) best = a;
        return { axis: best, sign: (Math.sign(m[best].deltaMm[component]) || 1) as 1 | -1 };
      };
      for (const s of SIDES) for (const j of ARM_JOINTS) {
        const f = axisToward(`${s}${j}`, 2);
        const ab = axisToward(`${s}${j}`, 0);
        if (f) this.motionAxes.flex[`${s}${j}`] = f;
        if (ab) this.motionAxes.abduct[`${s}${j}`] = { axis: ab.axis, sign: (s === "Left" ? ab.sign : -ab.sign) as 1 | -1 };
      }
    }

    // ── Head / neck.
    let headMode: "semantic" | "local" | "none";
    let headReason: string;
    let runtimeHeadCompare: Availability = { available: false, reason: "Only for the trial-compatible rig." };
    if (this.compatible) {
      this.bodyBones = new BoneController();
      this.bodyBones.discover(root, BODY_HEAD_CONFIG);
      headMode = "semantic";
      headReason = "Production BoneController on body Head/Neck, identity axis sign (measured on this rig). Pitch/yaw/roll are semantic degrees.";
      if (this.analysis.bones.has("head") && this.analysis.bones.has("neck_02")) {
        this.runtimeBones = new BoneController();
        this.runtimeBones.discover(root, SASHA);
        runtimeHeadCompare = { available: true, reason: "Drives the facial lowercase head/neck_02 the way the current runtime would — for comparison only." };
      } else runtimeHeadCompare = { available: false, reason: "No facial head/neck_02 in this file." };
    } else {
      const h = this.joints.has("Head"), n = this.joints.has("Neck");
      headMode = h || n ? "local" : "none";
      const hr = this.analysis.roles.get("Head")!;
      headReason = h || n
        ? `Local-axis controls on ${[h && `Head → "${this.boneForRole("Head")!.name}"`, n && `Neck → "${this.boneForRole("Neck")!.name}"`].filter(Boolean).join(", ")}. No anatomical direction is claimed for this rig.`
        : `Head ${hr.status}: ${hr.reason}`;
    }

    // ── Gaze: only on the Hyper3D facial eye rig; Sasha's rest correction only where the authored eye rest matches hers.
    const eyeL = this.analysis.bones.get("FACIAL_L_EyeParallel")?.bone;
    const eyeR = this.analysis.bones.get("FACIAL_R_EyeParallel")?.bone;
    let gazeAvail: Availability;
    if (eyeL && eyeR) {
      const auth = SASHA.eyeBoneGaze?.restCorrection?.authored;
      const same = (b: THREE.Bone, q?: readonly number[]) => !!q && Math.abs(Math.abs(b.quaternion.dot(new THREE.Quaternion(q[0], q[1], q[2], q[3]))) - 1) < 1e-6;
      const useSasha = this.compatible && !!auth && same(eyeL, auth.left) && same(eyeR, auth.right);
      this.gazeCtl = new Hyper3dEyeBoneGaze();
      this.gazeCtl.discover(root, SASHA.eyeBoneGaze, useSasha ? SASHA.eyeBoneGaze?.restCorrection : undefined, useSasha ? "centered" : "raw");
      gazeAvail = { available: true, reason: useSasha ? "FACIAL eye bones; Sasha's measured rest correction (eye rig identical)." : "FACIAL eye bones; RAW authored rest (no per-asset correction — Sasha's is not reused for this file)." };
    } else gazeAvail = { available: false, reason: "No FACIAL_L_EyeParallel / FACIAL_R_EyeParallel bones in this file." };

    // ── Morphs: Sasha bindings + calibration only for the compatible rig; raw names otherwise.
    this.morph = new MorphTargetController();
    this.morph.discover(root, this.compatible ? SASHA : undefined);
    this.calibrate = this.compatible;
    this.morphNames = this.morph.names();
    const hasMorph = (...n: string[]) => n.every((x) => this.morphNames.includes(x));
    const need = (n: string[]) => (hasMorph(...n) ? { available: true, reason: `Morphs ${n.join(", ")} present${this.calibrate ? " (Hyper3D calibration applied)" : " (raw influences, no calibration)"}.` } : { available: false, reason: `Missing morph(s): ${n.filter((x) => !this.morphNames.includes(x)).join(", ")}.` });

    this.features = {
      headMode, headReason, runtimeHeadCompare, gaze: gazeAvail,
      blink: need(["eyeBlinkLeft", "eyeBlinkRight"]),
      speech: need(["jawOpen"]),
      smile: need(["mouthSmileLeft", "mouthSmileRight"]),
      hairMeshes, meshes,
      measurements: {},
    };

    // ── Tests.
    const armMapped = SIDES.every((s) => this.joints.has(`${s}UpperArm`) && this.joints.has(`${s}LowerArm`));
    const anat = (id: string, label: string, extra?: Availability): TestInfo => ({ id, label, ...(this.compatible ? extra ?? { available: true, reason: "Trial-measured axes." } : { available: false, reason: "Anatomical test: needs the trial-compatible rig (axis meanings are not known for this rig)." }) });
    this.tests = [
      anat("shoulders", "Shoulders/breath"),
      anat("armSway", "Arm sway", armMapped ? undefined : { available: false, reason: "Upper/lower arms not mapped." }),
      anat("elbow", "Elbow flex"),
      anat("wrist", "Wrist + forearm twist"),
      anat("fingers", "Finger wave", this.fingers.size ? undefined : { available: false, reason: "No finger chains mapped." }),
      anat("headGaze", "Head + gaze"),
      anat("combined", "Combined + face"),
      { id: "localSweep", label: "Local-axis sweep", available: this.joints.size > 0, reason: this.joints.size ? "±4° about local X, then Y, then Z on every mapped joint. No anatomical meaning." : "No joints mapped." },
      { id: "localCombined", label: "Local combined + face", available: this.joints.size > 0, reason: this.joints.size ? "Small simultaneous local-axis motion on all mapped joints plus available face playback." : "No joints mapped." },
    ];

    this.prepareMeasurements();

    this.report = {
      ...asset.report,
      rig: {
        compatibleWithTrialConventions: this.compatible,
        reasons: this.analysis.compatibilityReasons,
        skeletons: this.analysis.skeletons,
        bones: this.analysis.bones.size,
        roles: Object.fromEntries([...this.analysis.roles].map(([r, x]) => [r, x.status === "mapped" ? x.bone : x.status.toUpperCase()])),
        overrides: Object.fromEntries(this.overrides),
      },
      head: { mode: headMode, reason: headReason },
      gaze: gazeAvail,
      morphTargets: this.morphNames.length,
      face: { blink: this.features.blink, speech: this.features.speech, smile: this.features.smile },
      measurements: this.features.measurements,
      measuredAxes: Object.fromEntries([...this.joints].filter(([n]) => !/Intermediate|Distal/.test(n)).map(([n, j]) => [n, j.measured])),
      fingers: Object.fromEntries([...this.fingers].map(([k, f]) => [k, { mode: f.mode, curlAxis: f.curlAxis, curlShare: f.curlShare, curlSign: f.mode === "anatomical" ? f.curlSign : "n/a", spreadAxis: f.spreadAxis }])),
      motionAxes: this.compatible ? this.motionAxes : "n/a (unknown rig)",
      attachHeadMeshesDryRun: this.compatible ? this.attachDryRun() : "n/a: uses Sasha's head-attached mesh list, which only applies to the trial-compatible rig.",
    };
  }

  /** Runs the REAL attachHeadMeshes on a SkeletonUtils clone (never the live model) with the runtime's facial `head`. */
  private attachDryRun() {
    const dry = skeletonClone(this.root);
    let head: THREE.Bone | undefined;
    dry.traverse((o) => { if (!head && (o as THREE.Bone).isBone && o.name === "head") head = o as THREE.Bone; });
    const list = [...new Set([...(SASHA.headAttachedMeshes ?? []), ...SASHA.meshNames.hair])];
    const before = Object.fromEntries(list.map((n) => [n, dry.getObjectByName(n)?.parent?.name ?? null]));
    const result = attachHeadMeshes(dry, head, list);
    const after = Object.fromEntries(list.map((n) => [n, dry.getObjectByName(n)?.parent?.name ?? null]));
    return { list, withRuntimeHead: result, parentsBefore: before, parentsAfter: after, note: "Clone only; clone shares geometry/materials with the live model and is discarded." };
  }

  boneForRole(role: string): THREE.Bone | null {
    const r = this.analysis.roles.get(role);
    return r?.status === "mapped" && r.bone ? this.analysis.bones.get(r.bone)?.bone ?? null : null;
  }

  /** Adds helpers to the stage. Called once the session is the active one. */
  attach() {
    const skeletons = new Set<THREE.Skeleton>();
    this.root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton) skeletons.add(m.skeleton); });
    for (const sk of skeletons) {
      const rootBone = sk.bones.find((b) => !(b.parent as THREE.Bone | null)?.isBone || !sk.bones.includes(b.parent as THREE.Bone)) ?? sk.bones[0];
      if (!rootBone) continue;
      const helper = new THREE.SkeletonHelper(rootBone);
      helper.visible = false;
      this.stage.scene.add(helper);
      this.helpers.push(helper);
      this.helperGroups.push({ label: `${sk.bones.length} joints from "${rootBone.name}"`, helper });
    }
  }

  get skeletonHelpers() { return this.helperGroups.map((h, i) => ({ index: i, label: h.label, visible: h.helper.visible })); }
  setSkeletonVisible(index: number, visible: boolean) { const h = this.helperGroups[index]; if (h) h.helper.visible = visible; }

  setMeshVisible(name: string, visible: boolean) { this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o.name || "(unnamed)") === name) o.visible = visible; }); }
  setHairVisible(visible: boolean) { for (const n of this.features.hairMeshes) this.setMeshVisible(n, visible); }
  setWireframe(on: boolean) {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) (mat as THREE.MeshStandardMaterial).wireframe = on;
    });
  }

  setHeadBinding(b: "body" | "runtime") {
    if (b === "runtime" && !this.runtimeBones) return;
    this.runtimeBones?.reset();
    this.bodyBones?.reset();
    Object.assign(this.head.current, zeroRot());
    Object.assign(this.neck.current, zeroRot());
    this.headBinding = b;
  }

  private modelSpace(o: THREE.Object3D | THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const w = (o as THREE.Object3D).isObject3D ? (o as THREE.Object3D).getWorldPosition(new THREE.Vector3()) : (o as THREE.Vector3).clone();
    return w.applyMatrix4(inv);
  }

  private reading(d: THREE.Vector3): string {
    const ax = [Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)];
    const total = ax[0] + ax[1] + ax[2] || 1;
    const label = this.compatible
      ? (i: number) => (i === 0 ? (d.x > 0 ? "char-left" : "char-right") : i === 1 ? (d.y > 0 ? "up" : "down") : d.z > 0 ? "forward" : "back")
      : (i: number) => `model ${[d.x, d.y, d.z][i] > 0 ? "+" : "−"}${"XYZ"[i]}`;
    return [0, 1, 2].sort((a, b) => ax[b] - ax[a]).filter((i) => ax[i] / total > 0.2).map((i) => `${label(i)} ${Math.round((ax[i] / total) * 100)}%`).join(", ") || "no measurable motion";
  }

  /** World point that represents a joint's "child": the next mapped role, a child bone, or a point along the bone. */
  private tipWorld(role: string, bone: THREE.Bone): () => THREE.Vector3 {
    const nextRole: Record<string, string> = {};
    for (const s of SIDES) {
      nextRole[`${s}Shoulder`] = `${s}UpperArm`; nextRole[`${s}UpperArm`] = `${s}LowerArm`; nextRole[`${s}LowerArm`] = `${s}Hand`; nextRole[`${s}Hand`] = `${s}MiddleProximal`;
      for (const f of FINGERS) { nextRole[`${s}${f}Proximal`] = `${s}${f}Intermediate`; nextRole[`${s}${f}Intermediate`] = `${s}${f}Distal`; }
    }
    nextRole.Spine = "Chest"; nextRole.Chest = "UpperChest"; nextRole.UpperChest = "Neck"; nextRole.Neck = "Head";
    const viaRole = nextRole[role] ? this.boneForRole(nextRole[role]) : null;
    const child = viaRole ?? (bone.children.find((c) => (c as THREE.Bone).isBone) as THREE.Bone | undefined);
    if (child) return () => child.getWorldPosition(new THREE.Vector3());
    // Leaf: a point along the incoming bone direction, ~60% of the parent segment length.
    const dir = bone.position.clone();
    const local = dir.lengthSq() > 0 ? dir.multiplyScalar(0.6) : new THREE.Vector3(0, 0.02, 0);
    return () => bone.localToWorld(local.clone());
  }

  private makeJoint(role: string, bone: THREE.Bone): JointRecord {
    const tip = this.tipWorld(role, bone);
    this.root.updateMatrixWorld(true);
    const twistAxis = bone.worldToLocal(tip()).normalize();
    if (!Number.isFinite(twistAxis.x) || twistAxis.lengthSq() < 0.5) twistAxis.set(0, 1, 0);
    const q0 = bone.quaternion.clone();
    const p0 = this.modelSpace(tip());
    const measured = {} as Record<AxisName, AxisMeasurement>;
    for (const a of AXIS_NAMES) {
      bone.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(AXES[a], 10 * DEG));
      const d = this.modelSpace(tip()).sub(p0);
      measured[a] = { deltaMm: [d.x, d.y, d.z].map((x) => +(x * 1000).toFixed(1)) as [number, number, number], reading: this.reading(d) };
    }
    bone.quaternion.copy(q0);
    this.root.updateMatrixWorld(true);
    return { role, bone, rest: q0.clone(), twistAxis, target: zeroOffsets(), current: zeroOffsets(), layer: zeroOffsets(), measured };
  }

  private makeFinger(s: string, f: string) {
    const js = PHALANGES.map((p) => this.joints.get(`${s}${f}${p}`)).filter((j): j is JointRecord => !!j);
    if (!js.length) return;
    const tipFn = this.tipWorld(js[js.length - 1].role, js[js.length - 1].bone);
    const idx = this.boneForRole(`${s}IndexProximal`), lit = this.boneForRole(`${s}LittleProximal`);
    let curlAxis: AxisName = "Z", spreadAxis: AxisName = "X", curlShare = 0, curlSign: 1 | -1 = 1;
    if (idx && lit) {
      const knuckle = this.modelSpace(lit).sub(this.modelSpace(idx)).normalize();
      const fingerDir = this.modelSpace(tipFn()).sub(this.modelSpace(js[0].bone)).normalize();
      const palmNormal = new THREE.Vector3().crossVectors(fingerDir, knuckle).normalize();
      const t0 = this.modelSpace(tipFn());
      const share = {} as Record<AxisName, { n: number; k: number; dx: number }>;
      for (const a of AXIS_NAMES) {
        for (const j of js) j.bone.quaternion.copy(j.rest).multiply(new THREE.Quaternion().setFromAxisAngle(AXES[a], 15 * DEG));
        const d = this.modelSpace(tipFn()).sub(t0);
        const len = d.length() || 1;
        share[a] = { n: Math.abs(d.dot(palmNormal)) / len, k: Math.abs(d.dot(knuckle)) / len, dx: d.x };
        for (const j of js) j.bone.quaternion.copy(j.rest);
      }
      this.root.updateMatrixWorld(true);
      curlAxis = AXIS_NAMES.reduce<AxisName>((b, a) => (share[a].n > share[b].n ? a : b), "X");
      const rest = AXIS_NAMES.filter((a) => a !== curlAxis);
      spreadAxis = rest.reduce<AxisName>((b, a) => (share[a].k > share[b].k ? a : b), rest[0]);
      curlShare = +share[curlAxis].n.toFixed(2);
      // Visually confirmed on the trial rig only: curl carries the tips toward the body midline.
      const towardMidline = s === "Left" ? -1 : 1;
      curlSign = (Math.sign(share[curlAxis].dx) === towardMidline ? 1 : -1) as 1 | -1;
    }
    this.fingers.set(`${s}${f}`, {
      key: `${s}${f}`, joints: js,
      mode: this.compatible && js.length === 3 && !!idx && !!lit ? "anatomical" : "local",
      curlAxis, curlShare, curlSign, spreadAxis,
      curl: { target: 0, current: 0, layer: 0 }, spread: { target: 0, current: 0, layer: 0 },
      local: { target: zeroOffsets(), current: zeroOffsets() },
    });
  }

  // ── Measurements (recomputed for every model; unavailable when assumptions do not hold).
  private prepareMeasurements() {
    const m = this.features.measurements;
    const headBone = this.boneForRole("Head");
    const meshes: THREE.Mesh[] = [];
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const faceCands = meshes.filter((x) => x.morphTargetDictionary && "eyeBlinkLeft" in x.morphTargetDictionary && "jawOpen" in x.morphTargetDictionary);
    const face = faceCands.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
    const teethCands = meshes.filter((x) => /^teeth$/i.test(x.name));
    const eyeL = this.analysis.bones.get("FACIAL_L_EyeParallel")?.bone, eyeR = this.analysis.bones.get("FACIAL_R_EyeParallel")?.bone;
    const hair = meshes.filter((x) => /^hair$/i.test(x.name));
    const why = (cond: Array<[boolean, string]>) => cond.filter(([ok]) => !ok).map(([, r]) => r);

    // Drift is only meaningful if the face DEFORMS with the skeleton. An unskinned face follows
    // no bone in this trial (production reparents it to the head; the trial deliberately does not).
    const faceSkinned = !!face && (face as THREE.SkinnedMesh).isSkinnedMesh === true;
    const eyeMissing = why([[!!headBone, "Head role not mapped"], [!!face, "no face mesh with eyeBlinkLeft + jawOpen"], [!face || faceSkinned, `face mesh "${face?.name}" is not skinned, so it follows no bone here (production attaches it rigidly to the head; this trial does not reparent meshes)`], [!!eyeL && !!eyeR, "no FACIAL eye bones"]]);
    m.eyeSocketDrift = eyeMissing.length ? { available: false, reason: eyeMissing.join("; ") } : { available: true, reason: `Eye pivots vs the 40 nearest vertices of "${face!.name}", in the "${headBone!.name}" frame.` };
    const lipMissing = why([[!!headBone, "Head role not mapped"], [!!face, "no face mesh with eyeBlinkLeft + jawOpen"], [!face || faceSkinned, `face mesh "${face?.name}" is not skinned (see eye-socket note)`], [teethCands.length === 1, teethCands.length ? "more than one Teeth mesh" : "no mesh named Teeth"]]);
    m.lipTeethDrift = lipMissing.length ? { available: false, reason: lipMissing.join("; ") } : { available: true, reason: `Front lower-teeth vertex of "${teethCands[0].name}" vs nearest "${face!.name}" vertex, in the "${headBone!.name}" frame.` };
    const hairSkinned = hair.filter((x) => (x as THREE.SkinnedMesh).isSkinnedMesh);
    m.hairStrain = hairSkinned.length === 1 ? { available: true, reason: `Edge-length strain on skinned "${hairSkinned[0].name}" vs rest.` } : { available: false, reason: hair.length ? "Hair mesh is not skinned (rigid hair cannot strain) or more than one hair mesh." : "No mesh named Hair." };

    try {
      if (m.eyeSocketDrift.available) {
        const fv = this.worldVerts(face!);
        const nearest = (p: THREE.Vector3) => { const d: Array<[number, number]> = []; for (let i = 0; i < fv.length / 3; i++) d.push([Math.hypot(fv[i * 3] - p.x, fv[i * 3 + 1] - p.y, fv[i * 3 + 2] - p.z), i]); return d.sort((a, b) => a[0] - b[0]).slice(0, 40).map((x) => x[1]); };
        const L = nearest(eyeL!.getWorldPosition(new THREE.Vector3())), R = nearest(eyeR!.getWorldPosition(new THREE.Vector3()));
        this.measureCtx.eye = { face, L, R, eyeL, eyeR, restL: this.socketOffset(face!, L, eyeL!, headBone!), restR: this.socketOffset(face!, R, eyeR!, headBone!) };
      }
      if (m.lipTeethDrift.available) {
        const teeth = teethCands[0];
        const tv = this.worldVerts(teeth);
        let minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < tv.length / 3; i++) { minY = Math.min(minY, tv[i * 3 + 1]); maxY = Math.max(maxY, tv[i * 3 + 1]); }
        let tip = 0, bestZ = -Infinity;
        for (let i = 0; i < tv.length / 3; i++) if (tv[i * 3 + 1] < (minY + maxY) / 2 && tv[i * 3 + 2] > bestZ) { bestZ = tv[i * 3 + 2]; tip = i; }
        const fv = this.worldVerts(face!);
        let lip = 0, bd = Infinity;
        for (let i = 0; i < fv.length / 3; i++) { const d = Math.hypot(fv[i * 3] - tv[tip * 3], fv[i * 3 + 1] - tv[tip * 3 + 1], fv[i * 3 + 2] - tv[tip * 3 + 2]); if (d < bd) { bd = d; lip = i; } }
        this.measureCtx.lip = { face, teeth, tip, lip, rest: this.lipOffset(face!, teeth, tip, lip, headBone!) };
      }
      if (m.hairStrain.available) this.measureCtx.hair = { mesh: hairSkinned[0], rest: this.worldVerts(hairSkinned[0]) };
    } catch (e) {
      for (const k of Object.keys(m)) if (m[k].available) m[k] = { available: false, reason: `Preparation failed: ${(e as Error).message}` };
    }
  }

  private vertexWorld(mesh: THREE.Mesh, i: number, out = new THREE.Vector3()) {
    out.fromBufferAttribute(mesh.geometry.attributes.position as THREE.BufferAttribute, i);
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) (mesh as THREE.SkinnedMesh).applyBoneTransform(i, out);
    return out.applyMatrix4(mesh.matrixWorld);
  }
  private worldVerts(mesh: THREE.Mesh) {
    this.root.updateMatrixWorld(true);
    const n = mesh.geometry.attributes.position.count;
    const a = new Float32Array(n * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { this.vertexWorld(mesh, i, v); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; }
    return a;
  }
  /**
   * Into the head's RIGID frame: translation and rotation only, scale NOT applied.
   * A bone's full inverse world matrix would also divide by its scale (0.0083 on a
   * facial `head`, 1.27 on a placed body `Head`), which corrupts distances. Output
   * stays in world units; `measure()` divides by the model's world scale once.
   */
  private toLocal(bone: THREE.Bone, v: THREE.Vector3) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    bone.matrixWorld.decompose(p, q, s);
    return v.sub(p).applyQuaternion(q.invert());
  }
  private socketOffset(face: THREE.Mesh, idx: number[], eye: THREE.Bone, head: THREE.Bone) {
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (const i of idx) c.add(this.vertexWorld(face, i, v));
    c.multiplyScalar(1 / idx.length);
    return this.toLocal(head, c).sub(this.toLocal(head, eye.getWorldPosition(new THREE.Vector3())));
  }
  private lipOffset(face: THREE.Mesh, teeth: THREE.Mesh, tip: number, lip: number, head: THREE.Bone) {
    return this.toLocal(head, this.vertexWorld(teeth, tip)).sub(this.toLocal(head, this.vertexWorld(face, lip)));
  }

  measure() {
    this.root.updateMatrixWorld(true);
    const unit = this.root.getWorldScale(new THREE.Vector3()).x || 1;
    const mm = (x: number) => +((x / unit) * 1000).toFixed(2);
    const head = this.boneForRole("Head");
    const out: Record<string, unknown> = {
      note: "Numerical, at the CURRENT pose, relative to THIS model's authored rest. Distances in the head's rigid frame (rotation + translation, no bone scale), converted to model-space mm by removing the model's world scale once; assumes the file is authored in metres.",
      model: this.asset.fileName,
    };
    const m = this.features.measurements;
    const ctxEye = this.measureCtx.eye as { face: THREE.Mesh; L: number[]; R: number[]; eyeL: THREE.Bone; eyeR: THREE.Bone; restL: THREE.Vector3; restR: THREE.Vector3 } | undefined;
    out.eyeSocketDriftHeadLocalMm = m.eyeSocketDrift.available && ctxEye && head
      ? { L: mm(this.socketOffset(ctxEye.face, ctxEye.L, ctxEye.eyeL, head).distanceTo(ctxEye.restL)), R: mm(this.socketOffset(ctxEye.face, ctxEye.R, ctxEye.eyeR, head).distanceTo(ctxEye.restR)) }
      : `unavailable: ${m.eyeSocketDrift.reason}`;
    const ctxLip = this.measureCtx.lip as { face: THREE.Mesh; teeth: THREE.Mesh; tip: number; lip: number; rest: THREE.Vector3 } | undefined;
    out.lowerLipToLowerTeethDriftHeadLocalMm = m.lipTeethDrift.available && ctxLip && head
      ? mm(this.lipOffset(ctxLip.face, ctxLip.teeth, ctxLip.tip, ctxLip.lip, head).distanceTo(ctxLip.rest))
      : `unavailable: ${m.lipTeethDrift.reason}`;
    const ctxHair = this.measureCtx.hair as { mesh: THREE.Mesh; rest: Float32Array } | undefined;
    if (m.hairStrain.available && ctxHair) {
      const cur = this.worldVerts(ctxHair.mesh);
      const idx = ctxHair.mesh.geometry.index;
      let maxS = 0, over = 0;
      const n = idx ? idx.count : cur.length / 3;
      for (let t = 0; t + 2 < n; t += 3) for (let e = 0; e < 3; e++) {
        const i = idx ? idx.getX(t + e) : t + e, j = idx ? idx.getX(t + ((e + 1) % 3)) : t + ((e + 1) % 3);
        const r = ctxHair.rest;
        const l0 = Math.hypot(r[i * 3] - r[j * 3], r[i * 3 + 1] - r[j * 3 + 1], r[i * 3 + 2] - r[j * 3 + 2]);
        if (l0 < 1e-7) continue;
        const s = Math.abs(Math.hypot(cur[i * 3] - cur[j * 3], cur[i * 3 + 1] - cur[j * 3 + 1], cur[i * 3 + 2] - cur[j * 3 + 2]) / l0 - 1);
        if (s > 0.1) over++;
        maxS = Math.max(maxS, s);
      }
      out.hairMaxEdgeStrainPct = +(maxS * 100).toFixed(1);
      out.hairEdgesOver10Pct = over;
    } else out.hairStrain = `unavailable: ${m.hairStrain.reason}`;
    out.headBinding = this.features.headMode === "semantic" ? this.headBinding : this.features.headMode;
    if (this.bodyBones) out.bodyHeadAppliedDeg = this.bodyBones.appliedDegrees().head;
    if (this.runtimeBones) out.runtimeHeadAppliedDeg = this.runtimeBones.appliedDegrees().head;
    if (this.gazeCtl) out.gazeDeg = this.gazeCtl.getState();
    return out;
  }

  // ── Motion.
  startTest(id: string) {
    const t = this.tests.find((x) => x.id === id);
    if (!t?.available) return;
    this.test.name = id;
    this.test.startedAt = performance.now();
    this.test.stopAt = null;
    if (id === "combined" || id === "localCombined") {
      this.face.blink = this.features.blink.available;
      this.face.speech = this.features.speech.available;
    }
  }
  stopTest() { if (this.test.name) this.test.stopAt = performance.now(); }

  private runTest(id: string, t: number) {
    const J = (n: string) => this.joints.get(n);
    const flex = this.motionAxes.flex, abd = this.motionAxes.abduct;
    const add = (n: string, ax: { axis: AxisName; sign: 1 | -1 } | undefined, v: number) => { const j = J(n); if (j && ax) j.layer[ax.axis] += ax.sign * v; };
    const sin = (f: number, ph = 0) => Math.sin(t * 2 * Math.PI * f + ph);
    switch (id) {
      case "shoulders": { const b = sin(0.25); for (const s of SIDES) add(`${s}Shoulder`, abd[`${s}Shoulder`], 1.5 * b); const uc = J("UpperChest"); if (uc) uc.layer.X += -0.8 * b; break; }
      case "armSway": for (const s of SIDES) { const ph = s === "Left" ? 0 : Math.PI; add(`${s}UpperArm`, flex[`${s}UpperArm`], 4 * sin(0.4, ph)); add(`${s}LowerArm`, flex[`${s}LowerArm`], 3 + 3 * sin(0.4, ph - 0.6)); } break;
      case "elbow": for (const s of SIDES) add(`${s}LowerArm`, flex[`${s}LowerArm`], 15 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI * 0.3))); break;
      case "wrist": for (const s of SIDES) { add(`${s}Hand`, flex[`${s}Hand`], 8 * sin(0.35)); const la = J(`${s}LowerArm`); if (la) la.layer.twist += 10 * sin(0.25); } break;
      case "fingers": { let k = 0; for (const f of this.fingers.values()) f.curl.layer += 30 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI * 0.5 - k++ * 0.5)); break; }
      case "headGaze": this.head.layer.yaw += 6 * sin(0.2); this.head.layer.pitch += 3 * sin(0.33); this.gaze.layer.yaw += 5 * sin(0.2, 0.4); break;
      case "combined": {
        this.runTest("shoulders", t);
        for (const s of SIDES) { add(`${s}UpperArm`, flex[`${s}UpperArm`], 2.5 * sin(0.3, s === "Left" ? 0 : 1.3)); add(`${s}LowerArm`, flex[`${s}LowerArm`], 6 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI * 0.23))); add(`${s}Hand`, flex[`${s}Hand`], 4 * sin(0.41)); }
        let k = 0; for (const f of this.fingers.values()) f.curl.layer += 10 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI * 0.27 - k++ * 0.3));
        this.head.layer.yaw += 4 * sin(0.17); this.head.layer.pitch += 2 * sin(0.31); this.head.layer.roll += 1.5 * sin(0.13); this.gaze.layer.yaw += 3 * sin(0.17, 0.5);
        break;
      }
      case "localSweep": {
        const phase = Math.floor(t / 2) % 3;
        const ax = AXIS_NAMES[phase];
        const v = 4 * Math.sin(((t % 2) / 2) * 2 * Math.PI);
        for (const j of this.joints.values()) j.layer[ax] += /Proximal|Intermediate|Distal/.test(j.role) ? v * 2 : v;
        break;
      }
      case "localCombined": {
        let k = 0;
        for (const j of this.joints.values()) { const ph = k++ * 0.37; j.layer.X += 2 * sin(0.21, ph); j.layer.Y += 1.5 * sin(0.17, ph + 1); j.layer.Z += 2 * sin(0.27, ph + 2); }
        if (this.gazeCtl) this.gaze.layer.yaw += 3 * sin(0.17, 0.5);
        break;
      }
    }
  }

  private facePose(time: number): Record<string, number> {
    const pose: Record<string, number> = {};
    if (this.face.blink && this.features.blink.available) {
      if (time > this.nextBlink) { this.blinkStart = time; this.nextBlink = time + 2.5 + Math.random() * 2.5; }
      const bt = time - this.blinkStart;
      const w = bt < 0.08 ? bt / 0.08 : bt < 0.2 ? 1 - (bt - 0.08) / 0.12 : 0;
      pose.eyeBlinkLeft = Math.max(0, w); pose.eyeBlinkRight = Math.max(0, w);
    }
    if (this.face.speech && this.features.speech.available) {
      const syl = time * 4.5, phase = syl - Math.floor(syl), kind = Math.floor(syl) % 5, env = Math.sin(Math.PI * phase);
      const has = (n: string) => this.morphNames.includes(n);
      pose.jawOpen = (kind === 3 ? 0.08 : 0.35) * env;
      if (kind === 1 && has("mouthFunnel")) pose.mouthFunnel = 0.45 * env;
      if (kind === 2 && has("mouthPucker")) pose.mouthPucker = 0.4 * env;
      if (kind === 3) { if (has("mouthClose")) pose.mouthClose = 0.5 * env; if (has("mouthPressLeft")) pose.mouthPressLeft = 0.3 * env; if (has("mouthPressRight")) pose.mouthPressRight = 0.3 * env; }
      if (kind === 4) { if (has("mouthStretchLeft")) pose.mouthStretchLeft = 0.25 * env; if (has("mouthStretchRight")) pose.mouthStretchRight = 0.25 * env; }
    }
    if (this.face.smile > 0 && this.features.smile.available) { pose.mouthSmileLeft = this.face.smile; pose.mouthSmileRight = this.face.smile; }
    for (const [k, v] of Object.entries(this.face.manual)) pose[k] = Math.max(pose[k] ?? 0, v);
    return pose;
  }

  step(now: number, dt: number) {
    if (this.disposed) return;
    const alpha = 1 - Math.exp(-dt / 0.12);
    for (const j of this.joints.values()) j.layer = zeroOffsets();
    for (const f of this.fingers.values()) { f.curl.layer = 0; f.spread.layer = 0; }
    this.head.layer = zeroRot(); this.neck.layer = zeroRot(); this.gaze.layer = { yaw: 0, pitch: 0 };
    if (this.test.name) {
      const t = (now - this.test.startedAt) / 1000;
      const env = smoothstep(t / 0.8) * (this.test.stopAt ? 1 - smoothstep((now - this.test.stopAt) / 800) : 1);
      this.runTest(this.test.name, t);
      for (const j of this.joints.values()) for (const k of ["X", "Y", "Z", "twist"] as const) j.layer[k] *= env;
      for (const f of this.fingers.values()) { f.curl.layer *= env; f.spread.layer *= env; }
      for (const k of ["pitch", "yaw", "roll"] as const) { this.head.layer[k] *= env; this.neck.layer[k] *= env; }
      this.gaze.layer.yaw *= env; this.gaze.layer.pitch *= env;
      if (this.test.stopAt && now - this.test.stopAt > 800) { this.test.name = null; this.test.stopAt = null; }
    }
    for (const f of this.fingers.values()) {
      if (f.mode === "anatomical") {
        f.curl.current += (f.curl.target + f.curl.layer - f.curl.current) * alpha;
        f.spread.current += (f.spread.target + f.spread.layer - f.spread.current) * alpha;
        const split = [0.4, 0.35, 0.25];
        f.joints.forEach((j, i) => { j.layer[f.curlAxis] += f.curlSign * f.curl.current * split[i] * 3; if (i === 0) j.layer[f.spreadAxis] += f.spread.current; });
      } else {
        for (const a of AXIS_NAMES) f.local.current[a] += (f.local.target[a] - f.local.current[a]) * alpha;
        for (const j of f.joints) for (const a of AXIS_NAMES) j.layer[a] += f.local.current[a];
      }
    }
    const tmp = new THREE.Quaternion();
    for (const j of this.joints.values()) {
      const isFinger = /Proximal|Intermediate|Distal/.test(j.role);
      for (const k of ["X", "Y", "Z", "twist"] as const) {
        const goal = j.target[k] + j.layer[k];
        j.current[k] = isFinger ? goal : j.current[k] + (goal - j.current[k]) * alpha;
      }
      j.bone.quaternion.copy(j.rest);
      for (const a of AXIS_NAMES) if (j.current[a]) j.bone.quaternion.multiply(tmp.setFromAxisAngle(AXES[a], j.current[a] * DEG));
      if (j.current.twist) j.bone.quaternion.multiply(tmp.setFromAxisAngle(j.twistAxis, j.current.twist * DEG));
    }
    if (this.bodyBones) {
      for (const k of ["pitch", "yaw", "roll"] as const) {
        this.head.current[k] += (this.head.target[k] + this.head.layer[k] - this.head.current[k]) * alpha;
        this.neck.current[k] += (this.neck.target[k] + this.neck.layer[k] - this.neck.current[k]) * alpha;
      }
      const pose = {
        active: true, manualActive: false, diagnosticActive: true,
        head: { pitch: this.head.current.pitch * DEG, yaw: this.head.current.yaw * DEG, roll: this.head.current.roll * DEG },
        neck: { pitch: this.neck.current.pitch * DEG, yaw: this.neck.current.yaw * DEG, roll: this.neck.current.roll * DEG },
      } as unknown as HeadMotionPose;
      ((this.headBinding === "runtime" && this.runtimeBones) || this.bodyBones).apply(pose, dt);
    }
    if (this.gazeCtl) {
      this.gaze.current.yaw += (this.gaze.target.yaw + this.gaze.layer.yaw - this.gaze.current.yaw) * alpha;
      this.gaze.current.pitch += (this.gaze.target.pitch + this.gaze.layer.pitch - this.gaze.current.pitch) * alpha;
      this.gazeCtl.applyDegrees(this.gaze.current.yaw, this.gaze.current.pitch);
    }
    const pose = this.facePose(now / 1000);
    if (Object.keys(pose).length || this.morphTouched) {
      this.restoreMorphs();
      this.morph.write(this.calibrate ? calibrateHyper3dPose(pose) : pose);
      this.morphTouched = Object.keys(pose).length > 0;
    }
    this.root.updateMatrixWorld(true);
  }
  private morphTouched = false;
  private restoreMorphs() { for (const [m, inf] of this.restMorphs) if (m.morphTargetInfluences) for (let i = 0; i < inf.length; i++) m.morphTargetInfluences[i] = inf[i]; }

  /** Restores THIS model's authored pose. Does not reload anything. */
  resetPose() {
    this.test.name = null;
    for (const [b, r] of this.restBones) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); }
    for (const j of this.joints.values()) { j.target = zeroOffsets(); j.current = zeroOffsets(); }
    for (const f of this.fingers.values()) { f.curl = { target: 0, current: 0, layer: 0 }; f.spread = { target: 0, current: 0, layer: 0 }; f.local = { target: zeroOffsets(), current: zeroOffsets() }; }
    Object.assign(this.head.target, zeroRot()); Object.assign(this.head.current, zeroRot());
    Object.assign(this.neck.target, zeroRot()); Object.assign(this.neck.current, zeroRot());
    Object.assign(this.gaze.target, { yaw: 0, pitch: 0 }); Object.assign(this.gaze.current, { yaw: 0, pitch: 0 });
    this.runtimeBones?.reset(); this.bodyBones?.reset(); this.gazeCtl?.reset();
    this.face.blink = false; this.face.speech = false; this.face.smile = 0; this.face.manual = {};
    this.restoreMorphs();
    this.morphTouched = false;
    this.root.updateMatrixWorld(true);
  }

  dispose() {
    if (this.disposed) return;
    this.resetPose();
    this.disposed = true;
    for (const h of this.helpers) { h.removeFromParent(); h.dispose(); }
    this.helpers.length = 0;
    this.helperGroups.length = 0;
  }
}

export function remapRole(stage: TrialStage, role: string, bone: string | null) {
  if (!stage.session) return;
  if (!ALL_ROLES.includes(role)) throw new Error(`Unknown role ${role}`);
  const overrides = new Map(stage.session.overrides);
  overrides.set(role, bone);
  stage.rebuildSession({ overrides });
}

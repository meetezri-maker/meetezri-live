import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { SpeechAcousticFrame } from "./engine/engine/avatar/upstream/threejs-talking-avatar/audioAnalysis";
import type { HeadPerformancePlan } from "./engine/engine/avatar/upstream/threejs-talking-avatar/performance";
import type { PlacedSentencePlan, LiveSentencePlannerStats } from "./liveSentencePlanner";
import type { BlendshapePose } from "./engine/types/facialAnimation";
import type { AvatarPayload } from "./engine/types/avatarPayload";
import { avatarModelConfigs } from "./engine/mappings/avatarModelConfig";
import {
  HYPER3D_GLB_URL,
  HYPER3D_LEGACY_GLB_URL,
} from "./engine/mappings/avatars/hyper3dAssetSelection";
import { HYPER3D_EYELASH_TARGET_NAMES } from "./engine/mappings/avatars/hyper3dEyelashBinding";
import { AvatarController } from "./engine/engine/avatar/AvatarController";
import { MorphTargetController } from "./engine/engine/avatar/MorphTargetController";
import { BoneController } from "./engine/engine/avatar/BoneController";
import { EyeGeometryController } from "./engine/engine/avatar/EyeGeometryController";
import { Hyper3dEyeBoneGaze } from "./engine/engine/avatar/Hyper3dEyeBoneGaze";
import { HybridLowerFaceController } from "./engine/engine/avatar/HybridLowerFaceController";
import { attachHeadMeshes } from "./engine/engine/avatar/attachHeadMeshes";
import { applyHyper3dGlbMaterials } from "./engine/components/avatar/hyper3dMaterials";
import { applyAcceptedHyper3dAppearance } from "./hyper3dAppearance";
import {
  buildThreejsTalkingAvatarHeadPlan,
  createThreejsTalkingAvatarPerformance,
  resolveThreejsTalkingAvatarHead,
  THREEJS_TALKING_AVATAR_BLINK_CHANNELS,
  THREEJS_TALKING_AVATAR_BROW_CHANNELS,
  THREEJS_TALKING_AVATAR_GAZE_CHANNELS,
} from "./engine/engine/avatar/hyper3dThreejsTalkingAvatarHead";
import {
  affectArticulationYield,
  hyper3dAffectPose,
  Hyper3dWarmthYieldFollower,
} from "./engine/engine/avatar/hyper3dFacialLiveliness";
import { ActivePresenceDirector, ACTIVE_PRESENCE_OWNER } from "./engine/engine/avatar/hyper3dActivePresence";
import { EXPECTED_MINIFACE_BLENDSHAPES } from "./engine/mappings/avatarBlendshapeConfig";
import {
  HYPER3D_LOWER_FACE_REVIEW_CHANNELS,
  HYPER3D_SPEECH_MOUTH_CHANNELS,
  createHyper3dMouthTrace,
  resolveHyper3dFrame,
  createHyper3dPerformance,
  type Hyper3dMouthTrace,
} from "./hyper3dFrameOrchestrator";
import {
  createHyper3dIdleExpressionShowcaseRuntime,
  isHyper3dIdleExpressionShowcaseEnabled,
} from "./hyper3dIdleExpressionShowcase";
import type { Hyper3dEngineReviewFrame } from "./hyper3dLiveSpeechAdapter";
import { measureHyper3dViewport } from "./hyper3dViewportDiagnostics";
import {
  captureHyper3dAssetResourceTiming,
  countHyper3dOrchestratorFrame,
  failHyper3dPhase,
  markHyper3dPhase,
  recordHyper3dAssetProgress,
  recordHyper3dAssetTimeline,
  recordHyper3dEngineSpans,
  recordHyper3dPath,
  type Hyper3dPathPhase,
} from "./hyper3dPathDiagnostics";
import type {
  Hyper3dEngineFactory,
  Hyper3dEngineHandle,
  Hyper3dEngineInit,
  Hyper3dFrameContext,
} from "./hyper3dEngineRegistry";

/**
 * HYPER3D ENGINE FACTORY — the imperative replacement for avatar-test's r3f
 * `AvatarModel`, and nothing more.
 *
 * It LOADS, DISCOVERS, CONNECTS, APPLIES, TICKS and DISPOSES. It decides no
 * phoneme pose, no expression value, no head amplitude, no gaze policy, no blink
 * timing, no Active Presence probability and no affect: every one of those comes
 * out of the ported accepted modules, unchanged. The order below is the order
 * `AvatarModel.tsx` performs, transcribed in `docs/hyper3d-imperative-binding-contract.md`.
 *
 * Production configuration (both promoted, both independently pinned):
 *   head performance source  "threejs-talking-avatar"
 *   talkingHeadTuning        null        (hardware-rejected as a motion generator)
 *   speaking preset          hyper3d-presence
 */

const CONFIG = avatarModelConfigs["hyper3d-usc"];

/** Live Solace inputs. All read-only; the engine owns none of them. */
export type Hyper3dLiveInputs = {
  shouldCaptureReviewFrame: () => boolean;
  noteControllerCreated: () => void;
  recordReviewFrame: (frame: Hyper3dEngineReviewFrame) => void;
  /** DEV-only: one lip-sync trace per frame, read off the real mesh after the write. */
  recordLipSyncFrame?: (trace: Hyper3dMouthTrace) => void;
  /** The growing live payload: text, phonemes, duration, performance_seed. */
  getPayload: () => AvatarPayload;
  /** Response-relative acoustic frames from the scheduler's decoded buffers. */
  getAcousticFrames: () => readonly SpeechAcousticFrame[];
  /** Bumps whenever the payload or acoustics changed enough to re-plan. */
  getRevision: () => number;
  getSentencePlans: () => PlacedSentencePlan[];
  resolveSentencePlanAt: (time: number) => { placed: PlacedSentencePlan; localTime: number } | null;
  freezeSentencePlans: () => void;
  getSentencePlannerStats: () => Pick<LiveSentencePlannerStats, "turnId">;
  noteSentencePlanConsumed: (index: number, revision: number) => void;
};

export type Hyper3dAssetChoice = "production" | "legacy";

export type Hyper3dBindingReport = {
  assetUrl: string;
  assetChoice: Hyper3dAssetChoice;
  faceMesh: string | null;
  morphCount: number;
  missingMorphs: string[];
  headBone: string | null;
  neckBones: string[];
  eyeBones: { left: string | null; right: string | null };
  teethJawOpenBound: boolean;
  hairMeshes: string[];
  materials: string[];
  attachedHeadMeshes: string[];
  /**
   * OPTIONAL CHANNEL — reported, never gated. Null mesh or a short target list
   * means this asset carries no eyelashes, or fewer than the binding table
   * expects, and the avatar runs exactly as it did before they existed.
   */
  eyelashMesh: string | null;
  eyelashTargetsBound: string[];
  eyelashTargetsMissing: string[];
};

/** Thrown when a required binding is absent — init fails, nothing half-renders. */
export class Hyper3dBindingError extends Error {
  constructor(message: string, readonly report: Partial<Hyper3dBindingReport>) {
    super(message);
    this.name = "Hyper3dBindingError";
  }
}

const loadGltfScene = (url: string, signal: AbortSignal): Promise<THREE.Group> =>
  new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (signal.aborted) {
          disposeSceneResources(gltf.scene);
          reject(new Error("aborted"));
          return;
        }
        resolve(gltf.scene);
      },
      // Phase 2G.1C: `onProgress` was already a parameter of this call; supplying
      // it changes nothing about the load and gives the network-read boundary.
      (event) => recordHyper3dAssetProgress(event.loaded, event.total),
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });

/**
 * Releases everything this engine loaded.
 *
 * avatar-test never does this: r3f's `useLoader` cache owns its GLB and outlives
 * the component. Solace loads the asset itself, so nothing else will free it.
 */
function disposeSceneResources(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material as unknown as Record<string, unknown>)) {
        if (value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture);
      }
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

const readMeshMorph = (mesh: THREE.Mesh | null, ...names: string[]): number | null => {
  if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) return null;
  for (const name of names) {
    const index = mesh.morphTargetDictionary[name];
    if (index !== undefined) return mesh.morphTargetInfluences[index] ?? 0;
  }
  return null;
};

const findMeshByName = (root: THREE.Object3D, name: string): THREE.Mesh | null => {
  let found: THREE.Mesh | null = null;
  root.traverse((object) => {
    if (found) return;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.name === name) found = mesh;
  });
  return found;
};

export function createHyper3dEngineFactory(live: Hyper3dLiveInputs): Hyper3dEngineFactory {
  return async (init: Hyper3dEngineInit): Promise<Hyper3dEngineHandle> => {
    // ── ASSET FALLBACK CHAIN ────────────────────────────────────────────────
    // female_2291 → female_229 → (throw, and the Phase 2A host falls back to the
    // existing Solace avatar). Each attempt is complete: load AND validate.
    let scene: THREE.Group | null = null;
    let assetChoice: Hyper3dAssetChoice = "production";
    let assetUrl = HYPER3D_GLB_URL;
    const attempts: Array<{ url: string; choice: Hyper3dAssetChoice }> = [
      { url: HYPER3D_GLB_URL, choice: "production" },
      { url: HYPER3D_LEGACY_GLB_URL, choice: "legacy" },
    ];
    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        markHyper3dPhase("glb-fetch");
        recordHyper3dPath(
          attempt.choice === "production"
            ? { productionAssetAttempted: true }
            : { legacyAssetAttempted: true },
          `loading ${attempt.url}`,
        );
        recordHyper3dAssetTimeline({
          url: attempt.url,
          loadStartedAtMs: Math.round(globalThis.performance.now()),
        });
        scene = await loadGltfScene(attempt.url, init.signal);
        assetChoice = attempt.choice;
        assetUrl = attempt.url;
        recordHyper3dAssetTimeline({
          loaderOnLoadAtMs: Math.round(globalThis.performance.now()),
        });
        captureHyper3dAssetResourceTiming(attempt.url);
        markHyper3dPhase("gltf-parse");
        recordHyper3dPath(
          attempt.choice === "production"
            ? { productionAssetLoaded: true, assetUrl: attempt.url }
            : { legacyAssetLoaded: true, assetUrl: attempt.url },
          `loaded ${attempt.url}`,
        );
        break;
      } catch (error) {
        lastError = error;
        failHyper3dPhase(
          "glb-fetch",
          `${attempt.url}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (init.signal.aborted) throw error;
      }
    }
    if (!scene) {
      throw new Hyper3dBindingError(
        `Neither Hyper3D asset could be loaded: ${String(lastError)}`,
        { assetUrl: HYPER3D_GLB_URL },
      );
    }

    // ── SETUP ORDER (contract §C) ───────────────────────────────────────────
    // 1-3. accepted root transform. No visual re-centering, no camera fitting.
    scene.position.set(...CONFIG.position);
    scene.rotation.set(...CONFIG.rotation);
    scene.scale.set(...CONFIG.scale);

    // 4. authoring leftovers must not render, and must not reach discovery.
    const hidden = new Set(CONFIG.hiddenMeshNames ?? []);
    if (hidden.size) {
      scene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh && hidden.has(object.name)) object.visible = false;
      });
    }

    // 5. accepted appearance. "evened" is the production albedo
    // (`texture_diffuse_evened.png`); "f228-profile" the accepted face look.
    const materialReport = applyHyper3dGlbMaterials(
      scene,
      CONFIG.hyper3dMaterials!.textureBaseUrl,
      "f228-profile",
      undefined,
      "evened",
    );

    // 6-11. discovery, in the accepted order.
    const morph = new MorphTargetController();
    const bones = new BoneController();
    const eyes = new EyeGeometryController();
    const eyeBoneGaze = new Hyper3dEyeBoneGaze();
    const lowerFace = new HybridLowerFaceController();

    morph.discover(scene, CONFIG);
    bones.discover(scene, CONFIG);
    // Must follow bone discovery: the head bone has to exist to attach to.
    const attachment = attachHeadMeshes(
      scene,
      bones.getHeadBone(),
      CONFIG.headAttachedMeshes ?? [],
    );
    lowerFace.discover(scene, CONFIG.id === "female");
    eyes.discover(scene, CONFIG.eyeGeometry);
    eyeBoneGaze.discover(
      scene,
      CONFIG.eyeBoneGaze,
      CONFIG.eyeBoneGaze?.restCorrection,
      // Store production default.
      "centered",
    );

    // ── VALIDATION GATE ─────────────────────────────────────────────────────
    const faceMesh = findMeshByName(scene, CONFIG.meshNames.face[0] ?? "");
    const teethMesh = findMeshByName(scene, CONFIG.meshNames.teeth[0] ?? "");
    const morphNames = new Set(morph.names());
    const missingMorphs = EXPECTED_MINIFACE_BLENDSHAPES.filter((name) => !morphNames.has(name));
    const hairMeshes = CONFIG.meshNames.hair.filter((name) => findMeshByName(scene!, name));

    /**
     * EYELASHES — resolved ONCE, here, and never gated.
     *
     * Resolution is a diagnostic only. The lash influences are written by
     * `morph.write` through `morphMapping`, using the mesh/index pairs
     * `morph.discover` already cached above, so nothing in the frame loop
     * traverses the scene or looks a name up. This block exists so that an asset
     * without lashes says so in the report instead of failing silently, and so
     * that a re-export which renames a target is visible immediately.
     *
     * Phase 10 of the brief, stated as code: an absent optional channel must not
     * take the avatar down. There is no `fail()` below.
     */
    const eyelashMesh = CONFIG.meshNames.eyelashes[0]
      ? findMeshByName(scene, CONFIG.meshNames.eyelashes[0])
      : null;
    const eyelashBound: string[] = [];
    const eyelashMissing: string[] = [];
    for (const target of HYPER3D_EYELASH_TARGET_NAMES) {
      if (eyelashMesh?.morphTargetDictionary?.[target] !== undefined) eyelashBound.push(target);
      else eyelashMissing.push(target);
    }
    if (import.meta.env.DEV === true && CONFIG.meshNames.eyelashes.length && eyelashMissing.length) {
      console.warn(
        `[hyper3d] eyelashes degraded: mesh ${eyelashMesh ? `"${eyelashMesh.name}" resolved` : `"${CONFIG.meshNames.eyelashes[0]}" NOT FOUND`}, ` +
          `${eyelashBound.length}/${HYPER3D_EYELASH_TARGET_NAMES.length} targets bound. ` +
          `Missing: ${eyelashMissing.join(", ")}. The avatar runs without them.`,
      );
    }
    const eyeGazeSupport = eyeBoneGaze.getSupport();
    const boneSupport = bones.getSupport();

    const report: Hyper3dBindingReport = {
      assetUrl,
      assetChoice,
      faceMesh: faceMesh?.name ?? null,
      morphCount: morphNames.size,
      missingMorphs,
      headBone: bones.getHeadBone()?.name ?? null,
      neckBones: boneSupport.neckBone ? [boneSupport.neckBone] : [],
      eyeBones: { left: eyeGazeSupport.leftBone, right: eyeGazeSupport.rightBone },
      teethJawOpenBound: Boolean(teethMesh?.morphTargetDictionary?.JawOpen !== undefined),
      hairMeshes,
      materials: materialReport ? [...materialReport.textured, ...materialReport.flat] : [],
      attachedHeadMeshes: attachment.attached,
      eyelashMesh: eyelashMesh?.name ?? null,
      eyelashTargetsBound: eyelashBound,
      eyelashTargetsMissing: eyelashMissing,
    };

    /**
     * Each gate names the PHASE it belongs to, so a fallback reports where the
     * binding actually broke instead of one undifferentiated "init failed".
     */
    const fail = (phase: Hyper3dPathPhase, reason: string) => {
      failHyper3dPhase(phase, reason);
      recordHyper3dPath({ validationPassed: false });
      disposeSceneResources(scene!);
      throw new Hyper3dBindingError(`${reason} (asset: ${assetUrl})`, report);
    };

    markHyper3dPhase("morph-validation");
    if (!faceMesh) fail("morph-validation", "face mesh did not resolve");
    if (missingMorphs.length) fail("morph-validation", `${missingMorphs.length} required face morphs missing: ${missingMorphs.join(", ")}`);
    markHyper3dPhase("bone-validation");
    if (!bones.isSupported() || !report.headBone) fail("bone-validation", "head bone did not resolve");
    if (!boneSupport.neckBone) fail("bone-validation", "neck bone did not resolve");
    markHyper3dPhase("eye-adapter");
    if (!eyeGazeSupport.found) fail("eye-adapter", "eye mechanism did not resolve");
    markHyper3dPhase("teeth-jaw");
    if (!teethMesh) fail("teeth-jaw", "teeth mesh did not resolve");
    if (!report.teethJawOpenBound) fail("teeth-jaw", "Teeth.JawOpen did not resolve");
    markHyper3dPhase("material-setup");
    if (!hairMeshes.length) fail("material-setup", "hair meshes did not resolve");
    if (!materialReport) fail("material-setup", "face/hair material binding did not resolve");
    recordHyper3dAssetTimeline({ bindingValidatedAtMs: Math.round(globalThis.performance.now()) });
    recordHyper3dPath({ validationPassed: true }, "binding validation passed");

    // ── SCENE, CAMERA, LIGHTING (accepted values) ───────────────────────────
    init.scene.add(scene);
    const camera = init.camera;
    camera.position.set(...CONFIG.camera.position);
    camera.fov = CONFIG.camera.fov;
    camera.near = CONFIG.camera.near;
    camera.far = CONFIG.camera.far;
    camera.lookAt(new THREE.Vector3(...CONFIG.camera.target));
    camera.updateProjectionMatrix();

    const appearance = applyAcceptedHyper3dAppearance(scene, init.scene, init.renderer);

    // ── ONE RUNTIME PER MOUNT ───────────────────────────────────────────────
    markHyper3dPhase("controller-init");
    const controller = new AvatarController(live.getPayload());
    live.noteControllerCreated();
    const performance = createHyper3dPerformance();
    const activePresence = new ActivePresenceDirector(live.getPayload().performance_seed ?? "solace-live");
    const warmthYield = new Hyper3dWarmthYieldFollower();
    const idleShowcase = createHyper3dIdleExpressionShowcaseRuntime({
      enabled: isHyper3dIdleExpressionShowcaseEnabled(),
    });

    type CachedHeadPlan = {
      revision: number;
      plan: HeadPerformancePlan | null;
      acousticFrames: readonly SpeechAcousticFrame[];
    };
    const headPlans = new Map<number, CachedHeadPlan>();
    let planRevision = -1;
    let payloadRevision = -1;
    let planningTurnId = -1;
    let lastConsumedKey = "";
    let disposed = false;

    /**
     * DEV-only lip-sync trace. The face-mesh indices are resolved ONCE through
     * the accepted morph mapping, so the per-frame read is the physical
     * `morphTargetInfluences[index]` the renderer uses, not a re-derivation.
     */
    const traceEnabled = import.meta.env.DEV === true && typeof live.recordLipSyncFrame === "function";
    const mouthTrace = traceEnabled ? createHyper3dMouthTrace() : undefined;
    const faceMouthIndices: Array<{ channel: string; target: string; index: number }> = [];
    if (traceEnabled && faceMesh?.morphTargetDictionary) {
      for (const channel of HYPER3D_SPEECH_MOUTH_CHANNELS) {
        const bindings = CONFIG.morphMapping[channel] ?? [{ target: channel }];
        for (const binding of bindings) {
          const index = faceMesh.morphTargetDictionary[binding.target];
          if (index !== undefined) faceMouthIndices.push({ channel, target: binding.target, index });
        }
      }
    }
    const teethJawIndex = teethMesh?.morphTargetDictionary?.JawOpen ?? teethMesh?.morphTargetDictionary?.jawOpen;
    // DEV-only viewport measurement, re-taken only when the canvas size changes.
    let viewportKey = "";
    let tracedFrames = 0;
    // Phase 2G.1C: `performance` in this scope is the accepted head performer, so
    // every timing stamp below goes through `globalThis.performance`.
    const DEV_ENGINE_SPANS = import.meta.env.DEV === true;
    recordHyper3dAssetTimeline({ engineReadyAtMs: Math.round(globalThis.performance.now()) });

    return {
      update(context: Hyper3dFrameContext) {
        if (disposed) return;
        const t = context.timeSeconds;
        const delta = context.deltaSeconds;
        const captureReview = live.shouldCaptureReviewFrame();

        // Freeze from the authoritative AudioContext before selecting a plan.
        // This call is allocation-free when no sentence crosses its onset.
        live.freezeSentencePlans();

        // Rebuild only FUTURE sentence head plans when live inputs change.
        // Frozen entries are immutable even if later chunks/acoustics arrive.
        const revision = live.getRevision();
        if (revision !== planRevision) {
          planRevision = revision;
          const payload = live.getPayload();
          if (payloadRevision !== revision) {
            payloadRevision = revision;
            controller.setLivePayload(payload);
          }
          const nextTurnId = live.getSentencePlannerStats().turnId;
          if (nextTurnId !== planningTurnId) {
            planningTurnId = nextTurnId;
            headPlans.clear();
            lastConsumedKey = "";
          }
          const acousticFrames = live.getAcousticFrames();
          for (const sentence of live.getSentencePlans()) {
            const cached = headPlans.get(sentence.index);
            if (sentence.frozen) continue;
            if (cached?.revision === sentence.revision && acousticFrames.length === cached.acousticFrames.length) continue;
            const localAcoustics = acousticFrames
              .filter((frame) => frame.time >= sentence.offsetSeconds && frame.time < sentence.endSeconds)
              .map((frame) => ({ ...frame, time: frame.time - sentence.offsetSeconds }));
            headPlans.set(sentence.index, {
              revision: sentence.revision,
              acousticFrames: localAcoustics,
              plan: buildThreejsTalkingAvatarHeadPlan({
                text: sentence.text,
                phonemes: sentence.localPhonemes,
                acousticFrames: localAcoustics,
                durationSeconds: sentence.localDurationSeconds,
                segmentIntent: true,
              }),
            });
          }
        }

        const active = live.resolveSentencePlanAt(t);
        const cachedHead = active ? headPlans.get(active.placed.index) : undefined;
        const consumedKey = active
          ? planningTurnId + ":" + active.placed.index + ":" + active.placed.revision
          : "";
        if (active && consumedKey !== lastConsumedKey) {
          lastConsumedKey = consumedKey;
          live.noteSentencePlanConsumed(active.placed.index, active.placed.revision);
        }

        if (import.meta.env.DEV === true) countHyper3dOrchestratorFrame();
        const orchestratorStartMs = DEV_ENGINE_SPANS ? globalThis.performance.now() : 0;
        const resolved = resolveHyper3dFrame(
          { config: CONFIG, controller, performance, activePresence, warmthYield, idleShowcase, headSupported: bones.isSupported() },
          {
            timeSeconds: t,
            deltaSeconds: delta,
            isSpeaking: context.conversation.isSpeaking,
            isListening: context.conversation.isListening,
            isThinking: context.conversation.isThinking,
            isAudioActive: context.conversation.isSpeaking,
            elapsedSeconds: context.elapsedSeconds,
            plan: cachedHead?.plan ?? null,
            acousticFrames: cachedHead?.acousticFrames ?? [],
            speechPerformancePlan: active?.placed.plan ?? null,
            performanceClock: active?.localTime ?? t,
            headClock: active?.localTime ?? t,
            captureReview,
            mouthTrace,
          },
        );
        const orchestratorEndMs = DEV_ENGINE_SPANS ? globalThis.performance.now() : 0;
        const finalPose = resolved.pose;
        const headMotion = resolved.headMotion;

        // The writes, in the accepted order.
        const morphStartMs = DEV_ENGINE_SPANS ? globalThis.performance.now() : 0;
        morph.write(finalPose);
        if (DEV_ENGINE_SPANS) {
          recordHyper3dEngineSpans({
            orchestratorMs: orchestratorEndMs - orchestratorStartMs,
            morphWriteMs: globalThis.performance.now() - morphStartMs,
          });
        }
        if (mouthTrace && live.recordLipSyncFrame) {
          const glb = mouthTrace.glb;
          const influences = faceMesh?.morphTargetInfluences;
          glb.faceMeshResolved = Boolean(influences);
          glb.teethMeshResolved = Boolean(teethMesh?.morphTargetInfluences && teethJawIndex !== undefined);
          glb.jawOpenInfluence = 0;
          glb.mouthMaxInfluence = 0;
          glb.mouthMaxMorphName = null;
          for (const channel of HYPER3D_SPEECH_MOUTH_CHANNELS) glb.channels[channel] = 0;
          if (influences) {
            for (const entry of faceMouthIndices) {
              const value = influences[entry.index] ?? 0;
              if (value > glb.channels[entry.channel]) glb.channels[entry.channel] = value;
              if (entry.channel === "jawOpen" && value > glb.jawOpenInfluence) glb.jawOpenInfluence = value;
              if (value > glb.mouthMaxInfluence) {
                glb.mouthMaxInfluence = value;
                glb.mouthMaxMorphName = entry.target;
              }
            }
            let written = 0;
            for (let index = 0; index < influences.length; index += 1) {
              if (influences[index] !== 0) written += 1;
            }
            glb.writtenMorphCount = written;
          }
          glb.teethJawOpenInfluence =
            teethJawIndex !== undefined ? teethMesh?.morphTargetInfluences?.[teethJawIndex] ?? 0 : 0;
          tracedFrames += 1;
          const canvasElement = (init.renderer as { domElement?: HTMLCanvasElement }).domElement;
          const nextViewportKey = canvasElement
            ? `${canvasElement.clientWidth}x${canvasElement.clientHeight}/${canvasElement.width}x${canvasElement.height}`
            : "no-canvas";
          // Frame 2 onward: at least one render has populated the matrices.
          if (tracedFrames > 1 && nextViewportKey !== viewportKey) {
            viewportKey = nextViewportKey;
            mouthTrace.viewport = measureHyper3dViewport({
              renderer: init.renderer,
              camera: init.camera,
              root: scene as THREE.Object3D,
              faceMesh,
              // `performance` in this scope is the accepted head performer.
              nowMs: globalThis.performance.now(),
            });
          }
          live.recordLipSyncFrame(mouthTrace);
        }
        if (resolved.review) {
          const finalBindings = {} as Hyper3dEngineReviewFrame["finalBindings"];
          for (const name of HYPER3D_LOWER_FACE_REVIEW_CHANNELS) {
            const bindings = CONFIG.morphMapping[name] ?? [{ target: name }];
            let value = 0;
            for (const binding of bindings) {
              for (const entry of morph.inspect(binding.target)) {
                value = Math.max(value, entry.influence);
              }
            }
            finalBindings[name] = value;
          }
          finalBindings.faceJawOpen = readMeshMorph(faceMesh, "jawOpen", "JawOpen");
          finalBindings.teethJawOpen = readMeshMorph(teethMesh, "jawOpen", "JawOpen");
          // The accepted female_2291 path has no jaw-bone writer.
          finalBindings.jawBoneRotation = null;
          live.recordReviewFrame({
            avatarEvaluationTime: t,
            hostFrameTime: context.timeSeconds,
            frame: resolved.review,
            finalBindings,
          });
        }
        if (CONFIG.eyeBoneGaze) {
          try {
            eyeBoneGaze.apply(finalPose);
          } catch {
            /* optional feature: a failure disables gaze, never the frame */
          }
        }
        if (CONFIG.eyeGeometry && eyes.isSupported()) {
          try {
            eyes.apply(
              resolved.gazeYawDegrees * CONFIG.eyeGeometry.gazeScale,
              resolved.gazePitchDegrees * CONFIG.eyeGeometry.gazeScale,
              CONFIG.eyeGeometry,
            );
          } catch {
            /* same */
          }
        }
        bones.apply(headMotion, delta);
      },

      dispose() {
        if (disposed) return;
        disposed = true;
        // Accepted teardown: reset the controllers.
        try { morph.reset(); } catch { /* independent */ }
        try { bones.reset(); } catch { /* independent */ }
        try { eyes.reset(); } catch { /* independent */ }
        try { eyeBoneGaze.reset(); } catch { /* independent */ }
        try { lowerFace.reset(); } catch { /* independent */ }
        // Solace-owned teardown: nothing else holds these.
        appearance.dispose();
        if (scene) {
          scene.parent?.remove(scene);
          disposeSceneResources(scene);
        }
        // The renderer, the host scene and the camera belong to the host, and the
        // AudioContext to Solace. None of them are touched here.
      },
    };
  };
}

// `readPresenceHandoffPose` now lives beside the frame sequence it belongs to,
// in `hyper3dFrameOrchestrator.ts`, so there is one copy of it.


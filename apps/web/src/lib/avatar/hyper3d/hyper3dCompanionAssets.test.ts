import { describe, expect, it } from "vitest";
import {
  HYPER3D_COMPANION_ASSETS,
  HYPER3D_MAPPED_COMPANION_IDS,
  resolveHyper3dCompanionAsset,
} from "./hyper3dCompanionAssets";
import {
  HYPER3D_ASSET_URLS,
  isOperatorSelectableHyper3dAsset,
  type Hyper3dAssetId,
} from "./engine/mappings/avatars/hyper3dAssetSelection";
import {
  avatarModelConfigs,
  hyper3dAssetHasHair,
  hyper3dConfigForAsset,
  hyper3dPreservesAuthoredHair,
  hyper3dUsesSharedFaceMaps,
} from "./engine/mappings/avatarModelConfig";
import { MorphTargetController } from "./engine/engine/avatar/MorphTargetController";
import {
  HYPER3D_BIANCA_EYE_REST_CORRECTION,
  HYPER3D_DAMIAN_EYE_REST_CORRECTION,
  HYPER3D_FRANKIE_EYE_REST_CORRECTION,
  HYPER3D_PERM_EYE_REST_CORRECTION,
  HYPER3D_SASHA_EYE_REST_CORRECTION,
} from "./engine/engine/avatar/hyper3dRigAdapter";
import { resolveEzriWsVoiceForCompanion } from "@/lib/ezri/voiceForCompanion";
import { companionSessionUses3dModel } from "@/lib/avatar/companionModelUrl";
import { isCompanionComingSoon } from "@/lib/avatar/companionAvailability";

/**
 * THE FOUR-COMPANION CONTRACT.
 *
 * One runtime, four assets. These assert the three things that make that safe:
 * identity resolves to the right FILE, a config is never shared between
 * instances, and nothing behavioural varies between companions.
 */

const BASE = avatarModelConfigs["hyper3d-usc"];

describe("companion to Hyper3D asset mapping", () => {
  /**
   * THE CONFIRMED MAPPING, INCLUDING ITS TWO CROSSOVERS.
   *
   * `afr.glb` is Sara Mitchell and `sara.glb` is MAYA CHEN. The filenames are
   * the designer's appearance labels, not companion names, so this table is the
   * authority and the test exists to keep anyone from "fixing" it by filename.
   */
  it.each([
    ["Sara Mitchell", "hyper3d_arfv2", "/avatars/hyper3d/arfv2.glb"],
    ["Maya Chen", "hyper3d_sara", "/avatars/hyper3d/sara.glb"],
    ["Alex", "hyper3d_frankie", "/avatars/hyper3d/frankie.glb"],
    ["Jordan Taylor", "hyper3d_jordan", "/avatars/hyper3d/jordan.glb"],
    ["Bianca", "hyper3d_bianca", "/avatars/hyper3d/bianca.glb"],
    ["Damian", "hyper3d_damian", "/avatars/hyper3d/damian.glb"],
    ["Sasha", "hyper3d_sasha", "/avatars/hyper3d/sasha.glb"],
  ])("%s resolves to %s", (displayName, assetId, url) => {
    expect(resolveHyper3dCompanionAsset(displayName)).toBe(assetId);
    expect(HYPER3D_ASSET_URLS[assetId as Hyper3dAssetId]).toBe(url);
  });

  it.each([
    ["sara", "hyper3d_arfv2"],
    ["sarah", "hyper3d_arfv2"],
    ["Sarah Mitchell", "hyper3d_arfv2"],
    ["maya", "hyper3d_sara"],
    ["Alex Rivera", "hyper3d_frankie"],
    ["alex", "hyper3d_frankie"],
    ["jordan", "hyper3d_jordan"],
  ])("resolves the existing alias %s", (alias, assetId) => {
    expect(resolveHyper3dCompanionAsset(alias)).toBe(assetId);
  });

  /** `activeAvatarId` carries runtime keys the canonical normaliser rejects. */
  it.each([
    ["saraV3", "hyper3d_arfv2"],
    ["sara", "hyper3d_arfv2"],
    ["legacyHybridSara", "hyper3d_arfv2"],
    ["jordan", "hyper3d_jordan"],
  ])("resolves the runtime key %s when no label is supplied", (key, assetId) => {
    expect(resolveHyper3dCompanionAsset(undefined, key)).toBe(assetId);
  });

  /**
   * THE IDENTITY GUARANTEE. An unmapped companion gets NOTHING — not a default,
   * and above all not another companion's asset.
   */
  it.each([undefined, null, "", "   ", "Someone Else", "test", "sara mitchell's twin"])(
    "returns null rather than a default for %o",
    (label) => {
      expect(resolveHyper3dCompanionAsset(label as string | undefined)).toBeNull();
    },
  );

  it("never maps two companions to the same asset", () => {
    const assets = Object.values(HYPER3D_COMPANION_ASSETS);
    expect(new Set(assets).size).toBe(assets.length);
  });

  /** `perm.glb` is Frankie's backup now, never anyone's primary. */
  it("maps no companion to perm.glb as a primary", () => {
    expect(Object.values(HYPER3D_COMPANION_ASSETS)).not.toContain("hyper3d_perm");
  });

  it("maps every companion the product can select", () => {
    expect([...HYPER3D_MAPPED_COMPANION_IDS].sort()).toEqual([
      "alex",
      "bianca",
      "damian",
      "jordan",
      "maya",
      "sarah",
      "sasha",
    ]);
  });
});

describe("per-companion configuration is instance-specific", () => {
  /**
   * The shared module config must stay bound to the single-avatar asset. If a
   * resolution ever wrote through to it, the second host on a page — or the
   * next session — would inherit the first one's avatar.
   */
  it("never mutates the shared module config", () => {
    const before = JSON.stringify(BASE);
    for (const assetId of Object.values(HYPER3D_COMPANION_ASSETS)) {
      hyper3dConfigForAsset(BASE, assetId);
    }
    expect(JSON.stringify(BASE)).toBe(before);
    expect(BASE.url).toBe("/avatars/female_2291.glb");
  });

  it("returns a distinct object per asset, sharing no mutable sub-objects", () => {
    const sara = hyper3dConfigForAsset(BASE, "hyper3d_afr");
    const maya = hyper3dConfigForAsset(BASE, "hyper3d_sara");
    expect(sara).not.toBe(maya);
    expect(sara.meshNames).not.toBe(maya.meshNames);
    expect(sara.url).not.toBe(maya.url);
  });

  /** The shipped asset and its rollbacks must come back untouched. */
  it.each(["female_2291", "female_229", "female_2291_lowerlip_v2"] as const)(
    "leaves the single-avatar asset %s on the shipped transform",
    (assetId) => {
      const config = hyper3dConfigForAsset(BASE, assetId);
      expect(config.scale).toEqual(BASE.scale);
      expect(config.position).toEqual(BASE.position);
      expect(config.meshNames.face).toEqual(["blendshapes"]);
      expect(config.meshNames.hair).toEqual(["Character002", "Character002_1"]);
      expect(config.hiddenMeshNames).toEqual(["Face002_4"]);
      expect(config.url).toBe(HYPER3D_ASSET_URLS[assetId]);
    },
  );
});

describe("per-model adapters", () => {
  /**
   * Measured against the real GLTFLoader: `sara`, `perm` and `jordan` export the
   * head as two primitives, which three.js names `blendshapes_1` and
   * `blendshapes_2` under a GROUP called `blendshapes`. `afr` is one primitive
   * and keeps the node name.
   */
  it.each([
    ["hyper3d_afr", ["blendshapes"]],
    // The 2026-10-27 arfv2.glb splits the head into `blendshapes.001` with two
    // primitives. The face proper (`M_Face.002`) loads as the SECOND, so it is
    // listed first; the first is a 1,099-vertex interior shell on `M_Face.001`.
    ["hyper3d_arfv2", ["blendshapes001_1", "blendshapes001"]],
    ["hyper3d_sara", ["blendshapes_1", "blendshapes_2"]],
    ["hyper3d_perm", ["blendshapes_1", "blendshapes_2"]],
    // frankie.glb names the head mesh `blendshapes.001`, so the loader names
    // its primitives after the mesh. Perm's names do not exist in this file.
    ["hyper3d_frankie", ["blendshapes001", "blendshapes001_1"]],
    ["hyper3d_jordan", ["blendshapes_1", "blendshapes_2"]],
    ["hyper3d_bianca", ["blendshapes_1", "blendshapes_2"]],
    ["hyper3d_damian", ["blendshapes_1", "blendshapes_2"]],
    // Mesh named `blendshapes.001`, like frankie.glb.
    ["hyper3d_sasha", ["blendshapes001", "blendshapes001_1"]],
  ])("%s binds the face meshes the loader actually produces", (assetId, face) => {
    expect(hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId).meshNames.face).toEqual(face);
  });

  /**
   * `jordan` ships no hair mesh — his scalp is part of the head mesh's second
   * primitive — so the gate must SKIP for him rather than fail. `perm` gained
   * hair in the 2026-10-14 re-delivery (`Object_7`), which is why the optional
   * hair path and the still-armed gate are both exercised here.
   */
  it.each([
    ["hyper3d_afr", ["Character002", "Character002_1"]],
    // The new hairstyle, still under the `Hair` node (resolved structurally).
    ["hyper3d_arfv2", ["Character001", "Character001_1"]],
    // The frozen backup still describes its own, unchanged file.
    ["hyper3d_romy_backup", ["Character002", "Character002_1"]],
    ["hyper3d_sara", ["Character002", "Character002_1"]],
    ["hyper3d_perm", ["Object_7"]],
    ["hyper3d_frankie", ["Object_7"]],
    ["hyper3d_jordan", []],
    // The `Hair` node is itself the mesh; it also resolves structurally.
    ["hyper3d_bianca", ["Hair"]],
    ["hyper3d_damian", ["Hair"]],
    ["hyper3d_sasha", ["Hair"]],
  ])("%s declares the hair meshes it actually has", (assetId, hair) => {
    const config = hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId);
    expect(config.meshNames.hair).toEqual(hair);
    expect(hyper3dAssetHasHair(config)).toBe((hair as string[]).length > 0);
  });

  it("keeps the hair gate armed for assets that do declare hair", () => {
    expect(hyper3dAssetHasHair(BASE)).toBe(true);
  });

  /** All of them renamed the lash node from `Object_2.002` to `Lashes`. */
  it.each(["hyper3d_afr", "hyper3d_sara", "hyper3d_perm", "hyper3d_frankie", "hyper3d_jordan", "hyper3d_bianca", "hyper3d_damian", "hyper3d_sasha"])(
    "%s names the renamed eyelash mesh",
    (assetId) => {
      expect(
        hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId).meshNames.eyelashes,
      ).toEqual(["Lashes"]);
    },
  );

  /**
   * Scale is DERIVED, `0.01 / faceAuthoringScale`, never fitted — the same
   * derivation as the shipped 1.266446. Position is then solved so the eye line
   * lands on the accepted anchor. Pinned here so a later "tidy-up" cannot
   * quietly turn a measurement into a preference.
   */
  it.each([
    ["hyper3d_afr", 1.266446, [0, -0.24607, -0.05247]],
    ["hyper3d_sara", 1.275206, [0, -0.25805, -0.05324]],
    ["hyper3d_perm", 1.174981, [0, -0.12097, -0.04438]],
    ["hyper3d_frankie", 1.163023, [0, -0.10462, -0.04332]],
    ["hyper3d_jordan", 1.182122, [0, -0.13074, -0.04501]],
    ["hyper3d_bianca", 1.272596, [0, -0.25448, -0.05302]],
    // Same face node as perm, byte for byte, so the same transform.
    ["hyper3d_damian", 1.174981, [0, -0.12097, -0.04438]],
    ["hyper3d_sasha", 1.274839, [0, -0.25755, -0.05322]],
  ])("%s carries its measured transform", (assetId, scale, position) => {
    const config = hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId);
    expect(config.scale).toEqual([scale, scale, scale]);
    expect(config.position).toEqual(position);
  });

  it("gives afr the shipped transform, because it is the updated female_2291", () => {
    const afr = hyper3dConfigForAsset(BASE, "hyper3d_afr");
    expect(afr.scale).toEqual(BASE.scale);
    expect(afr.position).toEqual(BASE.position);
  });

  /**
   * Every asset needs a rest correction that cancels ITS OWN authored neutral.
   * Sharing one would double-compensate, which is the defect the female_229 ->
   * female_2291 migration documented at +19.9 / +21.6 degrees.
   */
  it("gives every asset its own eye-rest correction", () => {
    const corrections = new Map<string, unknown>();
    for (const assetId of Object.keys(HYPER3D_ASSET_URLS) as Hyper3dAssetId[]) {
      const correction = hyper3dConfigForAsset(BASE, assetId).eyeBoneGaze?.restCorrection;
      expect(correction, `${assetId} has no eye-rest correction`).toBeDefined();
      corrections.set(assetId, correction);
    }
    // female_2291 and its byte-identical experimental twin deliberately share.
    expect(corrections.get("female_2291")).toBe(corrections.get("female_2291_lowerlip_v2"));
    for (const [a, b] of [
      ["hyper3d_afr", "hyper3d_sara"],
      ["hyper3d_sara", "hyper3d_perm"],
      ["hyper3d_perm", "hyper3d_jordan"],
      ["hyper3d_afr", "female_2291"],
      ["hyper3d_frankie", "hyper3d_perm"],
    ]) {
      expect(corrections.get(a)).not.toBe(corrections.get(b));
    }
  });

  /**
   * frankie.glb's eyes were re-aimed: perm's correction on this file leaves him
   * about seven degrees off neutral. Pinned to the constant solved for it, and
   * perm's own constant stays on perm, unchanged, for the backup.
   */
  it("solves Frankie's eye rest for frankie.glb and leaves perm's on perm", () => {
    expect(hyper3dConfigForAsset(BASE, "hyper3d_frankie").eyeBoneGaze?.restCorrection).toBe(
      HYPER3D_FRANKIE_EYE_REST_CORRECTION,
    );
    expect(hyper3dConfigForAsset(BASE, "hyper3d_perm").eyeBoneGaze?.restCorrection).toBe(
      HYPER3D_PERM_EYE_REST_CORRECTION,
    );
    expect(HYPER3D_FRANKIE_EYE_REST_CORRECTION.left).toEqual([
      -0.014194775, -0.001783689, -0.054286761, 0.998422894,
    ]);
    expect(HYPER3D_FRANKIE_EYE_REST_CORRECTION.right).toEqual([
      -0.023153115, 0.000697662, 0.033944703, 0.999155245,
    ]);
    expect(HYPER3D_PERM_EYE_REST_CORRECTION.left).toEqual([
      0.034363983, -0.00552383, -0.092306089, 0.995122199,
    ]);
  });

  /**
   * The 2026-10-23 three are solved on the eyeball's own aim. Damian's eye
   * geometry is perm's, but perm's constant is NOT shared: by that measure it
   * leaves these eyeballs ~8 degrees off neutral.
   */
  it.each([
    ["hyper3d_bianca", HYPER3D_BIANCA_EYE_REST_CORRECTION],
    ["hyper3d_damian", HYPER3D_DAMIAN_EYE_REST_CORRECTION],
    ["hyper3d_sasha", HYPER3D_SASHA_EYE_REST_CORRECTION],
  ] as const)("%s uses the eye-rest constant solved for its own file", (assetId, constant) => {
    const correction = hyper3dConfigForAsset(BASE, assetId).eyeBoneGaze?.restCorrection;
    expect(correction).toBe(constant);
    expect(correction).not.toBe(HYPER3D_PERM_EYE_REST_CORRECTION);
    expect(correction?.left).not.toEqual(HYPER3D_PERM_EYE_REST_CORRECTION.left);
  });

  /**
   * NOTHING BEHAVIOURAL VARIES. If a per-model adapter ever reached one of
   * these, four avatars would stop being one runtime.
   */
  it.each(["hyper3d_afr", "hyper3d_sara", "hyper3d_perm", "hyper3d_frankie", "hyper3d_jordan", "hyper3d_bianca", "hyper3d_damian", "hyper3d_sasha"])(
    "%s shares the camera, lighting, morph mapping and rig with the shipped asset",
    (assetId) => {
      const config = hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId);
      expect(config.camera).toEqual(BASE.camera);
      expect(config.lighting).toEqual(BASE.lighting);
      expect(config.morphMapping).toBe(BASE.morphMapping);
      expect(config.boneNames).toBe(BASE.boneNames);
      expect(config.boneAxisSign).toBe(BASE.boneAxisSign);
      expect(config.rotation).toEqual(BASE.rotation);
      expect(config.speakingHeadMotion).toBe(BASE.speakingHeadMotion);
      expect(config.meshNames.teeth).toEqual(BASE.meshNames.teeth);
      expect(config.meshNames.eyes).toEqual(BASE.meshNames.eyes);
      // The material PIPELINE is shared — only the face-map source may differ.
      expect(config.hyper3dMaterials?.mode).toBe(BASE.hyper3dMaterials?.mode);
      expect(config.hyper3dMaterials?.textureBaseUrl).toBe(BASE.hyper3dMaterials?.textureBaseUrl);
    },
  );

  /**
   * The head group is what `attachHeadMeshes` reparents; on a split-primitive
   * asset naming the GROUP carries both children in one call.
   */
  it.each([
    ["hyper3d_afr", ["blendshapes", "Teeth", "Character002", "Character002_1", "Lashes"]],
    ["hyper3d_arfv2", ["blendshapes", "Teeth", "Character001", "Character001_1", "Lashes"]],
    ["hyper3d_romy_backup", ["blendshapes", "Teeth", "Character002", "Character002_1", "Lashes"]],
    ["hyper3d_sara", ["blendshapes", "Teeth", "Character002", "Character002_1", "Lashes"]],
    // `Object_7` is perm's hair sculpt, and it is UNSKINNED: without this entry
    // the head would turn inside a stationary wig.
    ["hyper3d_perm", ["blendshapes", "Teeth", "Lashes", "Object_7"]],
    // Same unskinned `Object_7` sculpt as perm, byte for byte.
    ["hyper3d_frankie", ["blendshapes", "Teeth", "Lashes", "Object_7"]],
    ["hyper3d_jordan", ["blendshapes", "Teeth", "Lashes"]],
    ["hyper3d_bianca", ["blendshapes", "Teeth", "Lashes", "Hair"]],
    ["hyper3d_damian", ["blendshapes", "Teeth", "Lashes", "Hair"]],
    ["hyper3d_sasha", ["blendshapes", "Teeth", "Lashes", "Hair"]],
  ])("%s attaches the head-borne objects it actually has", (assetId, attached) => {
    expect(
      hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId).headAttachedMeshes,
    ).toEqual(attached);
  });

  /**
   * FACE IDENTITY. The shared USC albedo is bound by matching the material name
   * stem `M_Face`, which cannot tell one character's face from another's.
   * Binding it on a different person overwrites them — on `jordan.glb` it
   * erased the beard AND the short hair, because both live in head textures
   * whose materials are `M_Face.001` and `M_Face.002`, and rendered him bald
   * and clean-shaven in the app.
   *
   * Only afr and Romy's frozen backup may take the shared maps: afr is the
   * updated female_2291 and its authored face map is that very texture.
   *
   * Romy's primary (`arfv2.glb`, 2026-10-27) does NOT: its face map carries the
   * designer's corrected nostril interior and the dark scalp under the new
   * hairstyle, and the shared albedo replaced both with a pale nostril.
   */
  it.each([
    ["hyper3d_afr", true],
    ["hyper3d_arfv2", false],
    ["hyper3d_romy_backup", true],
    ["hyper3d_sara", false],
    ["hyper3d_perm", false],
    ["hyper3d_frankie", false],
    ["hyper3d_jordan", false],
    ["hyper3d_bianca", false],
    // Both of Damian's head materials are `M_Face.*`: shared maps would also
    // overwrite his scalp with a face texture.
    ["hyper3d_damian", false],
    ["hyper3d_sasha", false],
  ])("%s uses the shared USC face maps: %s", (assetId, shared) => {
    expect(hyper3dUsesSharedFaceMaps(hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId))).toBe(
      shared,
    );
  });

  /** The single-avatar family keeps the shared albedo, which is its correction. */
  it.each(["female_2291", "female_229", "female_2291_lowerlip_v2"] as const)(
    "%s still takes the shared USC face maps",
    (assetId) => {
      expect(hyper3dUsesSharedFaceMaps(hyper3dConfigForAsset(BASE, assetId))).toBe(true);
    },
  );

  it("defaults to the shared maps when an asset says nothing", () => {
    expect(hyper3dUsesSharedFaceMaps(BASE)).toBe(true);
  });

  /** Only female_2291 and sara carry the 9-vertex `Face002_4` export stub. */
  it.each([
    ["hyper3d_afr", []],
    ["hyper3d_sara", ["Face002_4"]],
    ["hyper3d_perm", []],
    ["hyper3d_frankie", []],
    ["hyper3d_jordan", []],
    ["hyper3d_bianca", []],
    ["hyper3d_damian", []],
    // Sasha's outfit loads as Face002..Face002_3 — no `Face002_4` stub exists.
    ["hyper3d_sasha", []],
  ])("%s hides only the stubs it has", (assetId, hidden) => {
    expect(
      hyper3dConfigForAsset(BASE, assetId as Hyper3dAssetId).hiddenMeshNames,
    ).toEqual(hidden);
  });

  /**
   * HAIR POLICY. Only Sasha opts out of the shared hair passes; every asset
   * that existed before keeps the shared correction it always had.
   */
  it.each([
    ["female_2291", false],
    ["female_229", false],
    ["hyper3d_afr", false],
    ["hyper3d_arfv2", false],
    ["hyper3d_romy_backup", false],
    ["hyper3d_sara", false],
    ["hyper3d_perm", false],
    ["hyper3d_frankie", false],
    ["hyper3d_jordan", false],
    ["hyper3d_bianca", false],
    ["hyper3d_damian", false],
    ["hyper3d_sasha", true],
  ] as const)("%s preserves its authored hair: %s", (assetId, preserved) => {
    expect(hyper3dPreservesAuthoredHair(hyper3dConfigForAsset(BASE, assetId))).toBe(preserved);
  });

  it("keeps every pre-existing asset's material config unchanged by the hair field", () => {
    for (const assetId of ["hyper3d_afr", "hyper3d_arfv2", "hyper3d_romy_backup", "hyper3d_sara", "hyper3d_perm", "hyper3d_frankie", "hyper3d_jordan"] as const) {
      expect(hyper3dConfigForAsset(BASE, assetId).hyper3dMaterials).not.toHaveProperty("hairAppearance");
    }
  });
});

/**
 * BOTH HEAD PRIMITIVES ANIMATE.
 *
 * `MorphTargetController` buckets by target NAME across every mesh it finds, so
 * the split head needs no extra morph bindings — but "needs no change" is a
 * claim worth a test, because the failure it prevents (a face that deforms
 * while the back of the head stays rigid) is silent.
 */
describe("split head primitives", () => {
  const mesh = (name: string, targets: string[]) => ({
    name,
    isMesh: true,
    morphTargetDictionary: Object.fromEntries(targets.map((t, i) => [t, i])),
    morphTargetInfluences: targets.map(() => 0),
    geometry: {
      morphAttributes: {
        position: targets.map(() => ({ array: new Float32Array([0, 1, 0]) })),
      },
    },
  });

  const sceneOf = (...meshes: ReturnType<typeof mesh>[]) =>
    ({
      traverse(visit: (object: unknown) => void) {
        for (const m of meshes) visit(m);
      },
    }) as never;

  it("writes one canonical channel to every mesh that declares it", () => {
    const face = mesh("blendshapes_1", ["jawOpen", "eyeBlinkLeft"]);
    const backHead = mesh("blendshapes_2", ["jawOpen", "eyeBlinkLeft"]);
    const controller = new MorphTargetController();
    controller.discover(sceneOf(face, backHead));

    controller.write({ jawOpen: 0.75 });
    expect(face.morphTargetInfluences[0]).toBeCloseTo(0.75, 6);
    expect(backHead.morphTargetInfluences[0]).toBeCloseTo(0.75, 6);

    controller.reset();
    expect(face.morphTargetInfluences[0]).toBe(0);
    expect(backHead.morphTargetInfluences[0]).toBe(0);
  });

  /** The lash channel reaches the renamed mesh because binding is by name. */
  it("drives the lash mesh whatever the mesh is called", () => {
    const face = mesh("blendshapes_1", ["eyeBlinkLeft"]);
    const lashes = mesh("Lashes", ["eyeBlinkLashesLeft"]);
    const controller = new MorphTargetController();
    controller.discover(sceneOf(face, lashes), {
      ...BASE,
      meshNames: { ...BASE.meshNames, face: ["blendshapes_1"], eyelashes: ["Lashes"] },
    });

    controller.write({ eyeBlinkLeft: 1 });
    expect(face.morphTargetInfluences[0]).toBe(1);
    expect(lashes.morphTargetInfluences[0]).toBe(1);
  });
});

/**
 * PRESERVED PRODUCT BEHAVIOUR. The integration changes which MODEL loads. It
 * must not change who the companion is or how they sound.
 */
describe("companion identity is unchanged by the integration", () => {
  /**
   * THE CATEGORY DEFAULTS, as the explicit per-option mapping defines them.
   *
   * A companion with no saved voice falls to its category default — Voice 1 for
   * female, Voice 2 for male — which map to `marin` and `echo`. These are the
   * ids the mapping pins, not environment presets: the two `VITE_EZRI_VOICE_*`
   * variables are no longer consulted, precisely so Voice 3 and Voice 4 cannot
   * collapse back onto them.
   */
  const femaleVoice = "marin";
  const maleVoice = "echo";

  it("keeps the two category defaults distinct", () => {
    expect(femaleVoice).not.toBe(maleVoice);
  });

  it.each([
    ["Sara Mitchell", "female"],
    ["Maya Chen", "female"],
    ["Alex", "male"],
    ["Jordan Taylor", "male"],
  ])("%s keeps its existing %s voice", (displayName, group) => {
    expect(resolveEzriWsVoiceForCompanion(displayName)).toBe(
      group === "female" ? femaleVoice : maleVoice,
    );
  });

  /** The aliases the lobby and older profiles still store must land identically. */
  it.each([
    ["sara", "female"],
    ["Sarah Mitchell", "female"],
    ["maya", "female"],
    ["Alex Rivera", "male"],
    ["jordan", "male"],
  ])("the alias %s keeps the %s voice", (alias, group) => {
    expect(resolveEzriWsVoiceForCompanion(alias)).toBe(
      group === "female" ? femaleVoice : maleVoice,
    );
  });

  it("still corrects a saved voice that disagrees with the companion", () => {
    expect(resolveEzriWsVoiceForCompanion("Alex", "Voice 1")).toBe(maleVoice);
    expect(resolveEzriWsVoiceForCompanion("Maya Chen", "Voice 2")).toBe(femaleVoice);
  });

  it.each(["Sara Mitchell", "Maya Chen", "Alex", "Jordan Taylor"])(
    "%s renders in 3D and is selectable",
    (displayName) => {
      expect(companionSessionUses3dModel(displayName)).toBe(true);
      expect(isCompanionComingSoon(displayName)).toBe(false);
    },
  );

  it("still refuses a companion the product does not know", () => {
    expect(companionSessionUses3dModel("Someone Else")).toBe(false);
  });
});

/**
 * OPERATOR FLAGS CANNOT SUBSTITUTE A COMPANION.
 *
 * `?hyper3dLegacyGlb=1` predates the four-avatar mapping, when swapping the
 * asset and swapping the avatar were the same action. Scoping it is what stops
 * it putting female_229's face on a Maya Chen session.
 */
describe("operator asset controls stay inside the single-avatar family", () => {
  it.each(["female_2291", "female_229", "female_2291_lowerlip_v2"] as const)(
    "%s remains operator-selectable",
    (assetId) => {
      expect(isOperatorSelectableHyper3dAsset(assetId)).toBe(true);
    },
  );

  it.each(["hyper3d_afr", "hyper3d_sara", "hyper3d_perm", "hyper3d_frankie", "hyper3d_jordan", "hyper3d_bianca", "hyper3d_damian", "hyper3d_sasha"] as const)(
    "%s is not reachable from an operator flag",
    (assetId) => {
      expect(isOperatorSelectableHyper3dAsset(assetId)).toBe(false);
    },
  );
});

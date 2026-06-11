import { SARA_RFV2_MORPH_NAMES } from "./saraRfv2Config";

/**
 * Sara RFv2 target mapping layer.
 *
 * Foundation only. This module is not wired into live runtime, ThreeAvatar,
 * ActiveSession, or Sara V2. Sara still uses the current Sara V2 /
 * legacyHybrid path. Do not activate until a later explicit phase.
 *
 * Phase 8 GLB audit facts:
 * - RFv2 face morphs live on mesh: Face
 * - Character.002 / Mouth is a generic body mesh morph and is forbidden for
 *   RFv2 visemes or mouth targets
 * - viseme_S is missing; S/Z should continue to fall back to viseme_E
 */

const SARA_RFV2_FACE_MESH_NAME = "Face";

export type SaraRfv2TargetGroup =
  | "visemes"
  | "mouth"
  | "eyes"
  | "expressions";

export type SaraRfv2TargetMapping = {
  meshName: string;
  morphName: string;
  fallbackUsed: boolean;
  missing: boolean;
  notes: string;
};

export type SaraRfv2SemanticTarget =
  | keyof typeof SARA_RFV2_TARGET_MAP.visemes
  | keyof typeof SARA_RFV2_TARGET_MAP.mouth
  | keyof typeof SARA_RFV2_TARGET_MAP.eyes
  | keyof typeof SARA_RFV2_TARGET_MAP.expressions
  | `${SaraRfv2TargetGroup}.${string}`;

const createFaceTarget = (
  morphName: string,
  notes = "Mapped to audited Sara RFv2 Face mesh morph.",
): SaraRfv2TargetMapping => ({
  meshName: SARA_RFV2_FACE_MESH_NAME,
  morphName,
  fallbackUsed: false,
  missing: false,
  notes,
});

export const SARA_RFV2_TARGET_MAP = {
  visemes: {
    rest: createFaceTarget(SARA_RFV2_MORPH_NAMES.visemes.rest),
    aa: createFaceTarget(SARA_RFV2_MORPH_NAMES.visemes.aa),
    ih: createFaceTarget(SARA_RFV2_MORPH_NAMES.visemes.ih),
    e: createFaceTarget(SARA_RFV2_MORPH_NAMES.visemes.e),
    o: createFaceTarget(SARA_RFV2_MORPH_NAMES.visemes.o),
    pp: createFaceTarget(SARA_RFV2_MORPH_NAMES.visemes.pp),
    ch: createFaceTarget(SARA_RFV2_MORPH_NAMES.visemes.ch),
    s: {
      meshName: SARA_RFV2_FACE_MESH_NAME,
      morphName: SARA_RFV2_MORPH_NAMES.visemes.e,
      fallbackUsed: true,
      missing: false,
      notes:
        "viseme_S is missing from the audited GLB; S/Z fallback intentionally maps to viseme_E.",
    },
  },
  mouth: {
    jawOpen: createFaceTarget(SARA_RFV2_MORPH_NAMES.mouth.jawOpen),
  },
  eyes: {
    blinkLeft: createFaceTarget(SARA_RFV2_MORPH_NAMES.eyes.blinkLeft),
    blinkRight: createFaceTarget(SARA_RFV2_MORPH_NAMES.eyes.blinkRight),
    lookUpLeft: createFaceTarget(SARA_RFV2_MORPH_NAMES.eyes.lookUpLeft),
    lookUpRight: createFaceTarget(SARA_RFV2_MORPH_NAMES.eyes.lookUpRight),
    lookDownLeft: createFaceTarget(SARA_RFV2_MORPH_NAMES.eyes.lookDownLeft),
    lookDownRight: createFaceTarget(SARA_RFV2_MORPH_NAMES.eyes.lookDownRight),
  },
  expressions: {
    smileLeft: createFaceTarget(SARA_RFV2_MORPH_NAMES.mouth.smileLeft),
    smileRight: createFaceTarget(SARA_RFV2_MORPH_NAMES.mouth.smileRight),
    frownLeft: createFaceTarget(SARA_RFV2_MORPH_NAMES.mouth.frownLeft),
    frownRight: createFaceTarget(SARA_RFV2_MORPH_NAMES.mouth.frownRight),
    smile: createFaceTarget(SARA_RFV2_MORPH_NAMES.emotions.smile),
    sad: createFaceTarget(SARA_RFV2_MORPH_NAMES.emotions.sad),
    cheekSquintLeft: createFaceTarget(SARA_RFV2_MORPH_NAMES.cheeks.squintLeft),
    cheekSquintRight: createFaceTarget(SARA_RFV2_MORPH_NAMES.cheeks.squintRight),
    brows: createFaceTarget(
      "eyebrows",
      "Mapped to audited Sara RFv2 Face mesh brow morph.",
    ),
  },
} as const;

export const SARA_RFV2_FORBIDDEN_MORPHS = [
  {
    meshName: "Character.002",
    morphName: "Mouth",
    reason:
      "Generic body mesh mouth morph; caused sticking/open mouth in legacy path. Do not use for RFv2 face visemes.",
  },
  {
    meshName: "Character.002",
    morphName: "Eyes",
    reason:
      "Generic body mesh eyes morph. Do not use Character.002 controls for Sara RFv2 face animation.",
  },
] as const;

const SARA_RFV2_MISSING_TARGET: SaraRfv2TargetMapping = {
  meshName: "",
  morphName: "",
  fallbackUsed: false,
  missing: true,
  notes: "Semantic target is not defined in the Sara RFv2 target map.",
};

const getTargetGroups = (): Array<{
  groupName: SaraRfv2TargetGroup;
  targets: Record<string, SaraRfv2TargetMapping>;
}> => [
  { groupName: "visemes", targets: SARA_RFV2_TARGET_MAP.visemes },
  { groupName: "mouth", targets: SARA_RFV2_TARGET_MAP.mouth },
  { groupName: "eyes", targets: SARA_RFV2_TARGET_MAP.eyes },
  { groupName: "expressions", targets: SARA_RFV2_TARGET_MAP.expressions },
];

export const getSaraRfv2MappedTarget = (
  semanticTarget: SaraRfv2SemanticTarget | string,
): SaraRfv2TargetMapping => {
  const [maybeGroup, maybeKey] = semanticTarget.split(".");

  if (maybeKey) {
    const group = getTargetGroups().find(({ groupName }) => groupName === maybeGroup);
    return group?.targets[maybeKey] ?? SARA_RFV2_MISSING_TARGET;
  }

  for (const { targets } of getTargetGroups()) {
    const target = targets[semanticTarget];
    if (target) {
      return target;
    }
  }

  return SARA_RFV2_MISSING_TARGET;
};

export const validateSaraRfv2TargetMap = (): {
  valid: boolean;
  warnings: string[];
} => {
  const warnings: string[] = [];
  const bareSemanticKeys = new Map<string, SaraRfv2TargetMapping>();
  const requiredFaceMorphNames = [
    SARA_RFV2_MORPH_NAMES.visemes.rest,
    SARA_RFV2_MORPH_NAMES.visemes.aa,
    SARA_RFV2_MORPH_NAMES.visemes.ih,
    SARA_RFV2_MORPH_NAMES.visemes.e,
    SARA_RFV2_MORPH_NAMES.visemes.o,
    SARA_RFV2_MORPH_NAMES.visemes.pp,
    SARA_RFV2_MORPH_NAMES.visemes.ch,
    SARA_RFV2_MORPH_NAMES.mouth.jawOpen,
    SARA_RFV2_MORPH_NAMES.eyes.blinkLeft,
    SARA_RFV2_MORPH_NAMES.eyes.blinkRight,
    SARA_RFV2_MORPH_NAMES.eyes.lookUpLeft,
    SARA_RFV2_MORPH_NAMES.eyes.lookUpRight,
    SARA_RFV2_MORPH_NAMES.eyes.lookDownLeft,
    SARA_RFV2_MORPH_NAMES.eyes.lookDownRight,
    SARA_RFV2_MORPH_NAMES.mouth.smileLeft,
    SARA_RFV2_MORPH_NAMES.mouth.smileRight,
    SARA_RFV2_MORPH_NAMES.mouth.frownLeft,
    SARA_RFV2_MORPH_NAMES.mouth.frownRight,
    SARA_RFV2_MORPH_NAMES.cheeks.squintLeft,
    SARA_RFV2_MORPH_NAMES.cheeks.squintRight,
    SARA_RFV2_MORPH_NAMES.emotions.smile,
    SARA_RFV2_MORPH_NAMES.emotions.sad,
    "eyebrows",
  ];
  const mappedMorphNames = new Set<string>();

  for (const { groupName, targets } of getTargetGroups()) {
    for (const [semanticKey, target] of Object.entries(targets)) {
      if (!target.meshName || !target.morphName) {
        warnings.push(`${groupName}.${semanticKey} has an empty mesh or morph name.`);
      }

      if (
        target.meshName === "Character.002" &&
        target.morphName === SARA_RFV2_MORPH_NAMES.mouth.mouth
      ) {
        warnings.push(
          `${groupName}.${semanticKey} maps to forbidden Character.002 / Mouth morph.`,
        );
      }

      const existing = bareSemanticKeys.get(semanticKey);
      if (
        existing &&
        (existing.meshName !== target.meshName || existing.morphName !== target.morphName)
      ) {
        warnings.push(
          `Semantic key ${semanticKey} is duplicated with conflicting morph bindings.`,
        );
      }

      bareSemanticKeys.set(semanticKey, target);
      mappedMorphNames.add(target.morphName);
    }
  }

  const visemeSFallback = SARA_RFV2_TARGET_MAP.visemes.s;
  if (
    visemeSFallback.meshName !== SARA_RFV2_FACE_MESH_NAME ||
    visemeSFallback.morphName !== SARA_RFV2_MORPH_NAMES.visemes.e ||
    !visemeSFallback.fallbackUsed
  ) {
    warnings.push("viseme s must remain an explicit Face / viseme_E fallback.");
  }

  for (const morphName of requiredFaceMorphNames) {
    if (!mappedMorphNames.has(morphName)) {
      warnings.push(`Required audited Face morph is missing from map: ${morphName}.`);
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
};

import * as THREE from "three";
import type { AvatarDefinition } from "./avatarConfigTypes";
import {
  prepareSaraV2AlignedScene,
  type SaraV2AlignmentDiagnostics,
} from "./saraV2Alignment";
import { SARA_V2_AVATAR_DEFINITION } from "./configs/saraV2Config";

export type SaraV2RuntimeDiagnostics = SaraV2AlignmentDiagnostics & {
  modelUrl: string;
  sameHelperUsed: true;
  bodyCandidateUsed: string | null;
  faceCandidateUsed: string | null;
  hairCandidateUsed: string | null;
  didDetachCharacterFromArmature: boolean;
};

declare global {
  interface Window {
    saraLiveV2Diagnostics?: SaraV2RuntimeDiagnostics;
  }
}

export function prepareSaraV2Scene(
  sceneRoot: THREE.Object3D,
  options: {
    modelUrl?: string;
    definition?: AvatarDefinition;
  } = {}
): SaraV2RuntimeDiagnostics {
  const definition = options.definition ?? SARA_V2_AVATAR_DEFINITION;
  const aligned = prepareSaraV2AlignedScene({
    gltfScene: sceneRoot,
    config: definition,
    THREE,
    mode: "live",
  });

  const diagnostics: SaraV2RuntimeDiagnostics = {
    ...aligned.diagnostics,
    modelUrl: options.modelUrl ?? definition.model.url,
    sameHelperUsed: true,
    bodyCandidateUsed: aligned.bodyObject?.name || null,
    faceCandidateUsed: aligned.faceObject?.name || null,
    hairCandidateUsed: aligned.hairObject?.name || null,
    didDetachCharacterFromArmature: aligned.diagnostics.characterDetached,
  };

  if (typeof window !== "undefined") {
    window.saraLiveV2Diagnostics = diagnostics;
  }

  return diagnostics;
}

import { degreesToRadians } from "../../mappings/avatarBlendshapeConfig";
import type {
  HeadNeckDiagnosticDebugState,
  HeadNeckDiagnosticPose,
  HeadNeckDiagnosticSettings,
  HeadRotationTarget
} from "../../types/facialAnimation";

const zero = (): HeadRotationTarget => ({ pitch: 0, yaw: 0, roll: 0 });
const headDiagnostic = {
  yaw: degreesToRadians(8),
  pitch: degreesToRadians(6),
  roll: degreesToRadians(3)
};
const neckDiagnostic = {
  yaw: degreesToRadians(5),
  pitch: degreesToRadians(4),
  roll: degreesToRadians(2)
};
const sequenceLengthSeconds = 19;
const sequence: Array<{ start: number; end: number; pose: HeadNeckDiagnosticPose }> = [
  { start: 0, end: 1, pose: "neutral" },
  { start: 1, end: 3, pose: "yaw-left" },
  { start: 3, end: 4, pose: "neutral" },
  { start: 4, end: 6, pose: "yaw-right" },
  { start: 6, end: 7, pose: "neutral" },
  { start: 7, end: 9, pose: "pitch-down" },
  { start: 9, end: 10, pose: "neutral" },
  { start: 10, end: 12, pose: "pitch-up" },
  { start: 12, end: 13, pose: "neutral" },
  { start: 13, end: 15, pose: "roll-left" },
  { start: 15, end: 16, pose: "neutral" },
  { start: 16, end: 18, pose: "roll-right" },
  { start: 18, end: 19, pose: "neutral" }
];

export const defaultHeadNeckDiagnosticSettings: HeadNeckDiagnosticSettings = {
  enabled: false,
  target: "both",
  pose: "neutral",
  sequenceEnabled: false,
  showSkeleton: false
};

export const diagnosticPoseRotation = (pose: HeadNeckDiagnosticPose, target: "head" | "neck"): HeadRotationTarget => {
  const limits = target === "head" ? headDiagnostic : neckDiagnostic;
  if (pose === "yaw-left") return { pitch: 0, yaw: limits.yaw, roll: 0 };
  if (pose === "yaw-right") return { pitch: 0, yaw: -limits.yaw, roll: 0 };
  if (pose === "pitch-down") return { pitch: limits.pitch, yaw: 0, roll: 0 };
  if (pose === "pitch-up") return { pitch: -limits.pitch, yaw: 0, roll: 0 };
  if (pose === "roll-left") return { pitch: 0, yaw: 0, roll: limits.roll };
  if (pose === "roll-right") return { pitch: 0, yaw: 0, roll: -limits.roll };
  return zero();
};

export const diagnosticPoseAtTime = (timeSeconds: number): { pose: HeadNeckDiagnosticPose; sequenceTime: number } => {
  const sequenceTime = ((timeSeconds % sequenceLengthSeconds) + sequenceLengthSeconds) % sequenceLengthSeconds;
  return {
    sequenceTime,
    pose: sequence.find((step) => sequenceTime >= step.start && sequenceTime < step.end)?.pose ?? "neutral"
  };
};

export const evaluateHeadNeckDiagnostic = (
  settings: HeadNeckDiagnosticSettings,
  timeSeconds: number
): HeadNeckDiagnosticDebugState => {
  const timed = settings.sequenceEnabled ? diagnosticPoseAtTime(timeSeconds) : { pose: settings.pose, sequenceTime: timeSeconds };
  const targetHead = settings.target === "head" || settings.target === "both";
  const targetNeck = settings.target === "neck" || settings.target === "both";
  return {
    enabled: settings.enabled,
    target: settings.target,
    pose: timed.pose,
    sequenceEnabled: settings.sequenceEnabled,
    sequenceTime: timed.sequenceTime,
    requestedHead: targetHead ? diagnosticPoseRotation(timed.pose, "head") : zero(),
    requestedNeck: targetNeck ? diagnosticPoseRotation(timed.pose, "neck") : zero()
  };
};

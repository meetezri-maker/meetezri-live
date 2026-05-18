export type GuidedScriptStep = { id: string; duration: number; instruction: string };

export type GuidedWellnessPayload = {
  scriptSteps: GuidedScriptStep[];
  tags?: string[];
  enabledForGuidedMode?: boolean;
  audioEnabled?: boolean;
  visualsEnabled?: boolean;
};

/** Parses JSON stored in `wellness_tools.content_url` when it is guided script data (not an http URL). */
export function parseGuidedPayloadFromContentUrl(
  raw: string | null | undefined
): Partial<GuidedWellnessPayload> | null {
  if (!raw || !raw.trim()) return null;
  if (/^https?:\/\//i.test(raw.trim())) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j && typeof j === "object" && Array.isArray((j as { scriptSteps?: unknown }).scriptSteps)) {
      return j as Partial<GuidedWellnessPayload>;
    }
  } catch {
    return null;
  }
  return null;
}

export function formatStepDurationSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (r === 0) return m === 1 ? "1 min" : `${m} min`;
  return `${m} min ${r} sec`;
}

import {
  canonicalCompanionDisplayName,
  companionAnalyticsChartLabel,
} from "@meetezri/shared";

/**
 * Map `profiles.selected_avatar` to Session Lobby companion name, "Not set", or "Other".
 * Delegates to `@meetezri/shared` so admin charts match the API and Session Lobby.
 */
export function canonicalCompanionLabelForAdmin(raw: string): string {
  return canonicalCompanionDisplayName(raw);
}

export function mergeCompanionAvatarCountsClient(
  rows: Array<{ name: string; c: number }>
): Array<{ name: string; count: number }> {
  const merged = new Map<string, number>();
  for (const r of rows) {
    const canonical = canonicalCompanionDisplayName(r.name === "Not set" ? "" : r.name);
    const label = companionAnalyticsChartLabel(canonical);
    merged.set(label, (merged.get(label) ?? 0) + r.c);
  }
  return [...merged.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

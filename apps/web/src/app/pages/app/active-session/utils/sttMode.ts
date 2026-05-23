/** Matches Ezri_Avatar/frontend/app.js STT provider values. */
export function normalizeSttProvider(provider: string | undefined): string {
  return String(provider ?? "runpod").toLowerCase();
}

export function usesBrowserStt(provider: string | undefined): boolean {
  return normalizeSttProvider(provider) === "browser";
}

export function usesServerPcmStt(provider: string | undefined): boolean {
  return !usesBrowserStt(provider);
}

export type EzriProviders = {
  brainProvider: string;
  ttsProvider: string;
  sttProvider: string;
};

export type EzriConfig = {
  apiBase: string;
  wsBase: string;
  defaults: EzriProviders;
};

function requireEnv(name: string, value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) {
    throw new Error(
      `Missing env ${name}. Add it to apps/web/.env (Vite) and restart dev server.`
    );
  }
  return v;
}

function deriveWsBaseFromApiBase(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      `Invalid VITE_EZRI_API_BASE: expected http(s) URL, got "${apiBase}".`
    );
  }
  const wsOrigin = base.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://");
  return `${wsOrigin}/api/v1/ws/active`;
}

export function getEzriConfig(): EzriConfig {
  // Vite only exposes env vars prefixed with VITE_.
  const apiBase = requireEnv("VITE_EZRI_API_BASE", import.meta.env.VITE_EZRI_API_BASE);
  const wsBase =
    (import.meta.env.VITE_EZRI_WS_BASE as string | undefined)?.trim() ||
    deriveWsBaseFromApiBase(apiBase);

  const brainProvider =
    (import.meta.env.VITE_DEFAULT_BRAIN_PROVIDER as string | undefined) || "groq";
  const ttsProvider =
    (import.meta.env.VITE_DEFAULT_TTS_PROVIDER as string | undefined) || "pocket_tts";
  const sttProvider =
    (import.meta.env.VITE_DEFAULT_STT_PROVIDER as string | undefined) || "browser";

  return {
    apiBase,
    wsBase,
    defaults: { brainProvider, ttsProvider, sttProvider },
  };
}

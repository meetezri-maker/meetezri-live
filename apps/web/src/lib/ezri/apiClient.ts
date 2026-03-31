import type { EzriAudioSource } from "./audio";
import { looksLikeBase64 } from "./audio";

export type EzriChatRestRequest = {
  prompt: string;
  provider: string;
  userid: string;
  session_id: string;
};

export type EzriChatRestResult = {
  text: string;
  audio?: EzriAudioSource;
  raw: unknown;
};

export type EzriSpeakRestRequest = {
  text: string;
  tts_provider: string;
};

export type EzriSpeakRestResult = {
  audio: EzriAudioSource;
  raw: unknown;
};

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function extractTextFromUnknown(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  return (
    asString(payload.detail) ||
    asString(payload.text) ||
    asString(payload.message) ||
    asString(payload.response) ||
    asString(payload.output) ||
    asString(payload.summary) ||
    asString(payload.assistant) ||
    null
  );
}

function extractAudioFromUnknown(payload: any): EzriAudioSource | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  const url =
    asString(payload.audio_url) ||
    asString(payload.audioUrl) ||
    asString(payload.url) ||
    asString(payload.audio);
  if (url && /^https?:\/\//i.test(url)) return { kind: "url", url };

  const b64 =
    asString(payload.audio_base64) ||
    asString(payload.audioBase64) ||
    (typeof payload.audio === "string" && looksLikeBase64(payload.audio) ? payload.audio : null);
  if (b64) return { kind: "base64", base64: b64, mimeType: asString(payload.mime_type) || undefined };

  return undefined;
}

async function readJsonOrText(res: Response): Promise<{ json?: any; text?: string }> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const json = await res.json().catch(() => undefined);
    return { json };
  }
  const text = await res.text().catch(() => "");
  return { text };
}

export function createEzriApiClient(apiBase: string) {
  const base = apiBase.replace(/\/+$/, "");

  return {
    async sendChatRest(req: EzriChatRestRequest): Promise<EzriChatRestResult> {
      const res = await fetch(`${base}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });

      const body = await readJsonOrText(res);
      if (!res.ok) {
        const msg =
          extractTextFromUnknown(body.json) ||
          body.text ||
          `Ezri chat failed (${res.status})`;
        const err = new Error(msg);
        (err as any).status = res.status;
        (err as any).payload = body.json ?? body.text;
        throw err;
      }

      const raw = body.json ?? body.text;
      const text = extractTextFromUnknown(body.json) || body.text || "";
      const audio = extractAudioFromUnknown(body.json);

      if (!text && !audio) {
        const err = new Error("Ezri chat returned no text/audio.");
        (err as any).payload = raw;
        throw err;
      }

      return { text, audio, raw };
    },

    async speakRest(req: EzriSpeakRestRequest): Promise<EzriSpeakRestResult> {
      const res = await fetch(`${base}/api/v1/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const body = await readJsonOrText(res);
        const msg =
          extractTextFromUnknown(body.json) ||
          body.text ||
          `Ezri speak failed (${res.status})`;
        const err = new Error(msg);
        (err as any).status = res.status;
        (err as any).payload = body.json ?? body.text;
        throw err;
      }

      if (ct.includes("application/json")) {
        const json = await res.json().catch(() => ({}));
        const audio = extractAudioFromUnknown(json);
        if (!audio) {
          const err = new Error("Ezri speak returned JSON but no audio payload.");
          (err as any).payload = json;
          throw err;
        }
        return { audio, raw: json };
      }

      // Binary audio: set type from Content-Type (fetch Blob type can be empty in edge cases).
      const ab = await res.arrayBuffer();
      const headerMime = (res.headers.get("content-type") || "").split(";")[0].trim();
      const blob = new Blob([ab], {
        type: headerMime || "application/octet-stream",
      });
      return { audio: { kind: "blob", blob }, raw: { contentType: headerMime || "application/octet-stream" } };
    },
  };
}


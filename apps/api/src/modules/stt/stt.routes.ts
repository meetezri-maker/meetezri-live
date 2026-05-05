import { FastifyInstance } from 'fastify';

/**
 * POST /api/stt
 *
 * Accepts a JSON body with a base64-encoded audio blob and transcribes it.
 *
 * Routing priority:
 *  1. Proxy to AI_SERVICE_URL + /api/v1/stt (Python AI server, local or HF Spaces)
 *  2. Fall back to OpenAI Whisper directly (requires OPENAI_API_KEY)
 *
 * Body: { audio: string (base64), mimeType: string, ext?: string }
 * Response: { text: string }
 */
export async function sttRoutes(app: FastifyInstance) {
  app.post<{
    Body: { audio: string; mimeType: string; ext?: string };
    Reply: { text: string } | { error: string };
  }>('/api/stt', async (request, reply) => {
    const { audio, mimeType, ext } = request.body as {
      audio?: string;
      mimeType?: string;
      ext?: string;
    };

    if (!audio || typeof audio !== 'string') {
      return reply.code(400).send({ error: 'Missing audio field (base64 string required)' });
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = Buffer.from(audio, 'base64');
    } catch {
      return reply.code(400).send({ error: 'Invalid base64 audio data' });
    }

    if (audioBuffer.length < 100) {
      return reply.code(400).send({ error: 'Audio chunk too small' });
    }

    const resolvedMime = mimeType || 'audio/webm';
    const resolvedExt = ext || (resolvedMime.includes('ogg') ? 'ogg' : 'webm');
    const filename = `chunk.${resolvedExt}`;

    // ── 1. Try AI service (Python FastAPI) ──────────────────────────────────
    const aiServiceUrl = (process.env.AI_SERVICE_URL || '').replace(/\/+$/, '');
    if (aiServiceUrl) {
      try {
        const formData = new FormData();
        formData.append(
          'file',
          new Blob([audioBuffer], { type: resolvedMime }),
          filename,
        );

        const res = await fetch(`${aiServiceUrl}/api/v1/stt`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(30_000),
        });

        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          request.log.info({ chars: data.text?.length }, 'STT via AI service');
          return { text: (data.text ?? '').trim() };
        }

        const errText = await res.text().catch(() => '');
        request.log.warn(
          { status: res.status, body: errText },
          'STT: AI service returned non-OK, trying OpenAI Whisper fallback',
        );
      } catch (e) {
        request.log.warn(
          { err: String(e) },
          'STT: AI service unreachable, trying OpenAI Whisper fallback',
        );
      }
    }

    // ── 2. Fallback: OpenAI Whisper ──────────────────────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return reply.code(503).send({
        error:
          'STT service unavailable — set AI_SERVICE_URL or OPENAI_API_KEY in the API environment',
      });
    }

    try {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([audioBuffer], { type: resolvedMime }),
        filename,
      );
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        request.log.error({ status: res.status, body: text }, 'OpenAI Whisper STT failed');
        return reply.code(502).send({ error: 'STT transcription failed' });
      }

      const data = (await res.json()) as { text?: string };
      request.log.info({ chars: data.text?.length }, 'STT via OpenAI Whisper');
      return { text: (data.text ?? '').trim() };
    } catch (e) {
      request.log.error({ err: String(e) }, 'OpenAI Whisper STT exception');
      return reply.code(500).send({ error: 'STT transcription error' });
    }
  });
}

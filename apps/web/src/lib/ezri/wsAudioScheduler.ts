import {
  type EzriAudioSource,
  audioSourceToArrayBuffer,
  normalizeAudioSource,
} from "./audio";

export type EzriWsAudioFormat = "wav" | "pcm_s16le";

export type EzriWsSchedulerChunkMeta = {
  subtitle: string;
  /** Caller-owned id to recover full chunk metadata in onChunkStart. */
  chunkId?: string;
};

export type EzriWsAudioSchedulerHandlers = {
  /** Fired when a chunk physically starts playing (after jitter buffer delay). */
  onChunkStart?: (
    meta: EzriWsSchedulerChunkMeta,
    timing: { durationMs: number; audioContextStartTime: number },
  ) => void;
  /** All scheduled nodes finished and server sent `tts_done`. */
  onPipelineIdle?: () => void;
  onScheduleError?: (error: unknown, meta: EzriWsSchedulerChunkMeta) => void;
};

const PIPELINE_IDLE_DEBOUNCE_MS = 350;

/**
 * Gapless WebSocket TTS playback — ports `Ezri_Avatar/frontend/app.js` `playAudio` +
 * `checkPlaybackDone`. Chunks are scheduled on a shared AudioContext timeline instead of
 * waiting for each HTMLAudioElement `onended` (which causes audible gaps between sentences).
 */
export class EzriWsAudioScheduler {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeNodes: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private isPlaybackActive = false;
  private sessionId = 0;
  private ttsDoneReceived = false;
  private pendingDecodes = 0;
  private audioFormat: EzriWsAudioFormat = "wav";
  private sampleRate = 24000;
  private handlers: EzriWsAudioSchedulerHandlers;
  /** Serialize decode+schedule so chunk order matches server order (app.js processes in order). */
  private scheduleChain: Promise<void> = Promise.resolve();
  private pipelineIdleTimer: number | null = null;

  constructor(handlers: EzriWsAudioSchedulerHandlers = {}) {
    this.handlers = handlers;
  }

  setHandlers(handlers: EzriWsAudioSchedulerHandlers) {
    this.handlers = handlers;
  }

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  isPipelineActive(): boolean {
    return (
      this.isPlaybackActive ||
      this.activeNodes.length > 0 ||
      this.pendingDecodes > 0 ||
      this.pipelineIdleTimer !== null
    );
  }

  setAudioFormat(format: string | undefined, sampleRate?: number) {
    this.audioFormat = format === "pcm_s16le" ? "pcm_s16le" : "wav";
    if (typeof sampleRate === "number" && sampleRate > 0) {
      this.sampleRate = sampleRate;
    }
  }

  resetForNewTurn() {
    this.ttsDoneReceived = false;
    this.clearPipelineIdleTimer();
  }

  setTtsDoneReceived() {
    this.ttsDoneReceived = true;
    this.checkPlaybackDone();
  }

  stop() {
    this.sessionId += 1;
    this.isPlaybackActive = false;
    this.pendingDecodes = 0;
    this.ttsDoneReceived = false;
    this.scheduleChain = Promise.resolve();
    this.clearPipelineIdleTimer();
    this.activeNodes.forEach((node) => {
      node.onended = null;
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    });
    this.activeNodes = [];
    this.nextStartTime = 0;
  }

  private clearPipelineIdleTimer() {
    if (this.pipelineIdleTimer !== null) {
      window.clearTimeout(this.pipelineIdleTimer);
      this.pipelineIdleTimer = null;
    }
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.masterGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.45;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  private pcm16ToAudioBuffer(
    ctx: AudioContext,
    arrayBuffer: ArrayBuffer,
  ): AudioBuffer {
    const dataView = new DataView(arrayBuffer);
    const numSamples = Math.floor(arrayBuffer.byteLength / 2);
    const audioBuffer = ctx.createBuffer(1, numSamples, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < numSamples; i++) {
      channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }
    return audioBuffer;
  }

  private sniffFormatFromBuffer(arrayBuffer: ArrayBuffer): EzriWsAudioFormat {
    const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      return "wav";
    }
    return this.audioFormat;
  }

  schedule(
    rawSource: EzriAudioSource,
    meta: EzriWsSchedulerChunkMeta,
  ): Promise<void> {
    const session = this.sessionId;
    this.clearPipelineIdleTimer();
    this.scheduleChain = this.scheduleChain
      .then(() => this.scheduleInner(rawSource, meta, session))
      .catch((error) => {
        console.error("[WS Audio] schedule chain error:", error);
      });
    return this.scheduleChain;
  }

  private async scheduleInner(
    rawSource: EzriAudioSource,
    meta: EzriWsSchedulerChunkMeta,
    session: number,
  ): Promise<void> {
    this.pendingDecodes += 1;

    try {
      const ctx = await this.ensureContext();
      const normalized = await normalizeAudioSource(rawSource);
      const arrayBuffer = await audioSourceToArrayBuffer(normalized);

      if (session !== this.sessionId) return;

      const chunkFormat = this.sniffFormatFromBuffer(arrayBuffer);
      let audioBuffer: AudioBuffer;
      if (chunkFormat === "pcm_s16le") {
        audioBuffer = this.pcm16ToAudioBuffer(ctx, arrayBuffer);
      } else {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      }

      if (session !== this.sessionId) return;

      this.pendingDecodes = Math.max(0, this.pendingDecodes - 1);

      // Jitter buffer — reference app.js
      if (!this.isPlaybackActive) {
        this.isPlaybackActive = true;
        this.nextStartTime = ctx.currentTime + 0.25;
      } else if (this.nextStartTime < ctx.currentTime) {
        console.warn(
          "[WS Audio] Underrun detected — rescheduling with small buffer",
        );
        this.nextStartTime = ctx.currentTime + 0.05;
      }

      const crossfadeTime = chunkFormat === "pcm_s16le" ? 0 : 0.005;
      const startTime = this.nextStartTime;
      const duration = audioBuffer.duration;
      const endTime = startTime + duration;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = ctx.createGain();
      source.connect(gainNode);
      gainNode.connect(this.masterGain!);

      if (crossfadeTime > 0) {
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(1, startTime + crossfadeTime);
        gainNode.gain.setValueAtTime(1, endTime - crossfadeTime);
        gainNode.gain.linearRampToValueAtTime(0, endTime);
      } else {
        gainNode.gain.value = 1;
      }

      source.start(startTime);
      this.nextStartTime += duration - crossfadeTime;
      this.activeNodes.push(source);

      const durationMs = duration * 1000;
      const timeUntilPlay = Math.max(0, startTime - ctx.currentTime);
      window.setTimeout(() => {
        if (session !== this.sessionId) return;
        this.handlers.onChunkStart?.(meta, {
          durationMs,
          audioContextStartTime: startTime,
        });
      }, timeUntilPlay * 1000);

      source.onended = () => {
        this.activeNodes = this.activeNodes.filter((n) => n !== source);
        if (session === this.sessionId) {
          this.checkPlaybackDone();
        }
      };
    } catch (error) {
      this.pendingDecodes = Math.max(0, this.pendingDecodes - 1);
      console.error("[WS Audio] Schedule/decode error:", error, {
        subtitle: meta.subtitle,
      });
      this.handlers.onScheduleError?.(error, meta);
      if (session === this.sessionId) {
        this.checkPlaybackDone();
      }
    }
  }

  private checkPlaybackDone() {
    this.clearPipelineIdleTimer();

    if (this.activeNodes.length > 0 || this.pendingDecodes > 0) {
      return;
    }

    this.isPlaybackActive = false;

    if (!this.ttsDoneReceived) {
      return;
    }

    // Debounce: avoid firing idle in brief gaps between sentence chunks.
    this.pipelineIdleTimer = window.setTimeout(() => {
      this.pipelineIdleTimer = null;
      if (this.activeNodes.length > 0 || this.pendingDecodes > 0) {
        return;
      }
      if (!this.ttsDoneReceived) {
        return;
      }
      this.handlers.onPipelineIdle?.();
    }, PIPELINE_IDLE_DEBOUNCE_MS);
  }
}

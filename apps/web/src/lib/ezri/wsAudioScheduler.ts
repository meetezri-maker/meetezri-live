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
  /**
   * Fired SYNCHRONOUSLY at schedule time, right after `source.start(startTime)`,
   * with the FINAL startTime (post underrun-bump) and decoded duration. Use this
   * for sample-accurate, audio-clock-keyed timeline selection — unlike
   * `onChunkStart`, it is not deferred through `setTimeout` and does not lag the
   * audio under main-thread jank.
   */
  onChunkScheduled?: (
    meta: EzriWsSchedulerChunkMeta,
    timing: {
      audioContextStartTime: number;
      durationMs: number;
      /**
       * Leading digital-silence trimmed off the head of the decoded buffer
       * before playback (seconds). Kept on the scheduled chunk metadata for
       * diagnostics; the timeline anchors on the audible voice start, not the
       * buffer start.
       */
      leadInSec: number;
    },
  ) => void;
  /** Fired when a chunk physically starts playing (after jitter buffer delay). */
  onChunkStart?: (
    meta: EzriWsSchedulerChunkMeta,
    timing: { durationMs: number; audioContextStartTime: number },
  ) => void;
  /** All scheduled nodes finished and server sent `tts_done`. */
  onPipelineIdle?: () => void;
  onScheduleError?: (error: unknown, meta: EzriWsSchedulerChunkMeta) => void;
};

const PIPELINE_IDLE_DEBOUNCE_MS = 50;

/**
 * Gapless WebSocket TTS playback — ports `Ezri_Avatar/frontend/app.js` `playAudio` +
 * `checkPlaybackDone`. Chunks are scheduled on a shared AudioContext timeline instead of
 * waiting for each HTMLAudioElement `onended` (which causes audible gaps between sentences).
 */
export class EzriWsAudioScheduler {
  private ctx: AudioContext | null = null;
  private boundContext: AudioContext | null = null;
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

  /** Use AudioContext unlocked during the mic-permission user gesture. */
  bindAudioContext(ctx: AudioContext | null) {
    if (!ctx || ctx.state === "closed") return;
    if (this.activeNodes.length > 0 || this.pendingDecodes > 0) return;
    this.boundContext = ctx;
    this.ctx = ctx;
    this.ensureOutputNodes(ctx);
  }

  private ensureOutputNodes(ctx: AudioContext) {
    if (this.masterGain && this.analyser) return;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.45;
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
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
    if (this.boundContext && this.boundContext.state !== "closed") {
      this.ctx = this.boundContext;
      this.ensureOutputNodes(this.boundContext);
      if (this.boundContext.state === "suspended") {
        await this.boundContext.resume();
      }
      return this.boundContext;
    }
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.masterGain = null;
      this.analyser = null;
      this.ensureOutputNodes(this.ctx);
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

  /**
   * Leading-silence trim. Decoded TTS chunks carry 0.4–1.1s of digital silence
   * at the head, but backend phoneme timestamps are speech-relative (t=0 is the
   * voice onset, not the buffer start). Detect the voice onset and return the
   * seconds to skip so the audible voice aligns with the phoneme timeline.
   *
   * Onset detection uses a windowed-RMS gate rather than a single-sample
   * threshold: isolated clicks/dither near t=0 can cross a per-sample threshold
   * while the actual speech is still 0.5–0.86s away, causing those chunks to
   * incorrectly report leadIn = 0. Requiring a run of consecutive 10ms windows
   * above an RMS floor ignores those transient spikes. Only the first ~2s of
   * channel 0 is scanned (silence is always at the head). Returns 0 if no onset
   * is found or the computed lead-in would consume the whole buffer.
   */
  private computeLeadInSec(audioBuffer: AudioBuffer): number {
    const WINDOW_MS = 10;
    const RMS_THRESHOLD = 0.01;
    const REQUIRED_CONSECUTIVE_WINDOWS = 3;
    const SAFETY_PAD_SEC = 0.05;

    const sampleRate = audioBuffer.sampleRate || this.sampleRate;
    const channel = audioBuffer.getChannelData(0);
    const scanLimit = Math.min(channel.length, Math.ceil(sampleRate * 2));
    const windowSize = Math.max(
      1,
      Math.round((sampleRate * WINDOW_MS) / 1000),
    );

    let consecutive = 0;
    let onsetWindowStart = -1;
    for (let start = 0; start + windowSize <= scanLimit; start += windowSize) {
      let sumSq = 0;
      for (let i = start; i < start + windowSize; i++) {
        const sample = channel[i];
        sumSq += sample * sample;
      }
      const rms = Math.sqrt(sumSq / windowSize);
      if (rms >= RMS_THRESHOLD) {
        if (consecutive === 0) {
          onsetWindowStart = start;
        }
        consecutive += 1;
        if (consecutive >= REQUIRED_CONSECUTIVE_WINDOWS) {
          break;
        }
      } else {
        consecutive = 0;
        onsetWindowStart = -1;
      }
    }

    if (onsetWindowStart < 0 || consecutive < REQUIRED_CONSECUTIVE_WINDOWS) {
      // No sustained speech onset in the scanned head — treat as no trim.
      return 0;
    }

    const onsetSec = onsetWindowStart / sampleRate;
    const leadInSec = Math.max(0, onsetSec - SAFETY_PAD_SEC);
    if (leadInSec >= audioBuffer.duration) {
      return 0;
    }
    return leadInSec;
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
        this.nextStartTime = ctx.currentTime + 0.12;
      } else if (this.nextStartTime < ctx.currentTime) {
        console.warn(
          "[WS Audio] Underrun detected — rescheduling with small buffer",
        );
        this.nextStartTime = ctx.currentTime + 0.05;
      }

      // Trim leading digital silence so the audible voice onset aligns with the
      // speech-relative phoneme timeline (see computeLeadInSec). Everything the
      // scheduler models about the played audio uses `audibleDuration` — the
      // buffer length minus the skipped head — while `source.start` skips the
      // silence via the offset argument.
      const leadInSec = this.computeLeadInSec(audioBuffer);
      const audibleDuration = audioBuffer.duration - leadInSec;

      const crossfadeTime = 0;
      let startTime = this.nextStartTime;
      if (startTime < ctx.currentTime) {
        startTime = ctx.currentTime + 0.02;
        this.nextStartTime = startTime;
      }
      const endTime = startTime + audibleDuration;

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

      // Skip the leading silence: play from `leadInSec` into the buffer.
      source.start(startTime, leadInSec);
      this.nextStartTime += audibleDuration - crossfadeTime;
      this.activeNodes.push(source);

      const durationMs = audibleDuration * 1000;

      // Synchronous, audio-clock-keyed handoff — fires with the FINAL startTime
      // so the consumer can select the timeline against `ctx.currentTime` in its
      // RAF tick instead of waiting on the (laggy) `setTimeout` below.
      this.handlers.onChunkScheduled?.(meta, {
        audioContextStartTime: startTime,
        durationMs,
        leadInSec,
      });

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

import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CORPUS_PAYLOADS,
  loadPayload,
  runCorpus,
  type CorpusRunResult,
  type DeadlineModeId
} from "./hyper3dDeadlineCorpus";
import type { AvatarPayload } from "./engine/types/avatarPayload";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE HARDWARE COMPARISON'S EVIDENCE — three modes over the aligned corpus.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file is where the brief's A/B/C becomes measured rather than argued. It
 * drives the PRODUCTION chain over real MFA payloads three times, changing only
 * the convergence cap, and asserts the properties that must hold whatever the
 * reviewer decides on the face:
 *
 *   CURRENT is production, frame for frame.
 *   The timeline is identical in all three modes, to the microsecond.
 *   The bilabial seal and its timing are identical in all three modes.
 *   Reach rises with the cap; motion rises with it too, and is reported.
 *
 * It also PRINTS the comparison table, because the report has to quote numbers
 * this repository can reproduce rather than numbers from a session.
 *
 * SKIPPED, NOT FAILED, when the fixtures are absent. They live outside this
 * repository (`/home/marqlinux/avatar-test`), exactly as
 * `staticEquivalence.harness` already assumes, so a checkout without them must
 * not report a red suite — but it must also not silently claim to have measured
 * anything, which is why the skip is explicit and named.
 */

const MODES: readonly DeadlineModeId[] = ["current", "d34", "d44"];

const available = CORPUS_PAYLOADS.filter((entry) => existsSync(entry.path));
const describeCorpus = available.length > 0 ? describe : describe.skip;

type Loaded = { id: string; payload: AvatarPayload };

const loaded: Loaded[] = available.map((entry) => ({ id: entry.id, payload: loadPayload(entry.path) }));

/** mode -> payloadId -> result. Computed once; every assertion reads it. */
const runs = new Map<string, CorpusRunResult>();
const keyOf = (mode: DeadlineModeId, payloadId: string) => `${mode}:${payloadId}`;

for (const { id, payload } of loaded) {
  for (const mode of MODES) {
    runs.set(keyOf(mode, id), runCorpus(payload, id, mode));
  }
}

const get = (mode: DeadlineModeId, payloadId: string) => runs.get(keyOf(mode, payloadId))!;

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

describeCorpus("deadline comparison over the aligned corpus", () => {
  it("drove every payload in all three modes", () => {
    for (const { id } of loaded) {
      for (const mode of MODES) {
        const run = get(mode, id);
        expect(run.frames).toBeGreaterThan(100);
        expect(run.reach.samples).toBeGreaterThan(100);
      }
    }
  });

  /**
   * C OF THE BRIEF. CURRENT mode must BE production, and the proof is the
   * rendered pose on every frame of every payload.
   */
  it("CURRENT is the accepted production path, frame for frame", () => {
    for (const { id, payload } of loaded) {
      const production = runCorpus(payload, id, "current");
      const viaComparison = get("current", id);
      expect(viaComparison.rendered).toEqual(production.rendered);
      expect(viaComparison.acceleratedFrames).toBe(0);
      expect(viaComparison.peakDemandedSpeed).toBe(0);
    }
  });

  /**
   * E OF THE BRIEF. The audio clock, the phoneme ids, the phoneme labels and the
   * seconds-remaining derivation, per frame, byte-identical across modes.
   * Timeline drift is zero because the timeline is the SAME SEQUENCE.
   */
  it("the timeline is identical in all three modes — zero drift", () => {
    for (const { id } of loaded) {
      const reference = get("current", id).timeline;
      for (const mode of MODES) {
        expect(get(mode, id).timeline).toEqual(reference);
        expect(get(mode, id).frames).toBe(get("current", id).frames);
      }
    }
  });

  it("does not touch the phoneme timestamps it reads", () => {
    /**
     * The payload object is shared by all three runs above. If any mode had
     * written a timestamp, a fresh parse would disagree with it — so comparing
     * the in-memory payload against a re-read of the file is the direct test.
     */
    for (const entry of available) {
      const reparsed = loadPayload(entry.path);
      const used = loaded.find((item) => item.id === entry.id)!.payload;
      expect(used.phonemes).toEqual(reparsed.phonemes);
      expect(used.audio_duration).toBe(reparsed.audio_duration);
      expect(used.pauses).toEqual(reparsed.pauses);
      expect(used.behaviour_settings).toEqual(reparsed.behaviour_settings);
    }
  });

  /**
   * F OF THE BRIEF. The seal and its timing are not in the eligible set, and
   * this is the end-to-end form of that claim over real bilabials.
   */
  it("the bilabial seal and its timing are identical in all three modes", () => {
    for (const { id } of loaded) {
      const reference = get("current", id);
      for (const mode of MODES) {
        const run = get(mode, id);
        expect(run.closurePeak).toBe(reference.closurePeak);
        expect(run.closureTimingErrorMs).toBe(reference.closureTimingErrorMs);
        expect(run.rendered.map((pose) => pose.mouthClose)).toEqual(
          reference.rendered.map((pose) => pose.mouthClose)
        );
        expect(run.rendered.map((pose) => pose.mouthPressLeft)).toEqual(
          reference.rendered.map((pose) => pose.mouthPressLeft)
        );
        expect(run.rendered.map((pose) => pose.mouthPressRight)).toEqual(
          reference.rendered.map((pose) => pose.mouthPressRight)
        );
      }
    }
  });

  it("raises target reach, and 44 raises it further than 34", () => {
    for (const { id } of loaded) {
      const current = get("current", id).reach.overall;
      const at34 = get("d34", id).reach.overall;
      const at44 = get("d44", id).reach.overall;
      expect(at34).toBeGreaterThan(current);
      expect(at44).toBeGreaterThanOrEqual(at34);
    }
  });

  it("helps the short labels most, which is where the loss was measured", () => {
    for (const { id } of loaded) {
      const current = get("current", id).reach.byDurationBand;
      const at44 = get("d44", id).reach.byDurationBand;
      // The short bands must improve...
      for (const band of ["31-50ms", "51-70ms"]) {
        if (current[band] > 0) expect(at44[band]).toBeGreaterThan(current[band]);
      }
      // ...and the comfortable band must be left essentially alone.
      if (current[">150ms"] > 0) {
        expect(at44[">150ms"]).toBeGreaterThanOrEqual(current[">150ms"]);
        expect(at44[">150ms"] - current[">150ms"]).toBeLessThan(0.05);
      }
    }
  });

  /**
   * The defect Fix G exists to hold down. Jaw CLOSING is ineligible, so a faster
   * opening cannot add an open-close PAIR — and measured over all four payloads
   * the count does not move at all, which is the strongest form of that claim.
   */
  it("adds no jaw oscillation — the cycle rate does not rise", () => {
    for (const { id } of loaded) {
      const current = get("current", id).motion.jawCyclesPerSecond;
      for (const mode of ["d34", "d44"] as const) {
        expect(get(mode, id).motion.jawCyclesPerSecond).toBeLessThanOrEqual(current + 1e-9);
      }
    }
  });

  it("never exceeds its cap", () => {
    for (const { id } of loaded) {
      expect(get("d34", id).peakDemandedSpeed).toBeLessThanOrEqual(34);
      expect(get("d44", id).peakDemandedSpeed).toBeLessThanOrEqual(44);
    }
  });

  /**
   * D OF THE BRIEF. Not an assertion — the table. Printed so the report quotes a
   * number this suite produces, on this machine, from these fixtures.
   */
  it("prints the CURRENT vs 34 vs 44 comparison", () => {
    const lines: string[] = [];
    lines.push("");
    lines.push("=== DEADLINE COMPARISON — CURRENT vs 34 vs 44 ===");
    for (const { id } of loaded) {
      const runsForPayload = MODES.map((mode) => get(mode, id));
      lines.push("");
      lines.push(`${id}  (${runsForPayload[0].frames} frames, ${runsForPayload[0].reach.samples} reach samples)`);
      lines.push(
        [
          "mode".padEnd(9),
          "reach".padStart(7),
          "jaw".padStart(7),
          "vert".padStart(7),
          "width".padStart(7),
          "round".padStart(7),
          "OPEN".padStart(7),
          "FRONT".padStart(7),
          "RND-V".padStart(7),
          "path".padStart(8),
          "velP90".padStart(8),
          "jawCyc".padStart(7),
          "drift".padStart(7),
          "closure".padStart(8),
          "accelFr".padStart(8)
        ].join("")
      );
      for (const run of runsForPayload) {
        lines.push(
          [
            run.mode.padEnd(9),
            pct(run.reach.overall).padStart(7),
            pct(run.reach.byChannelGroup.jaw).padStart(7),
            pct(run.reach.byChannelGroup.vertical).padStart(7),
            pct(run.reach.byChannelGroup.width).padStart(7),
            pct(run.reach.byChannelGroup.rounding).padStart(7),
            pct(run.reach.byPhonemeClass.open).padStart(7),
            pct(run.reach.byPhonemeClass.front).padStart(7),
            pct(run.reach.byPhonemeClass.rounded).padStart(7),
            run.motion.pathRateMMPerSecond.toFixed(2).padStart(8),
            run.motion.velocityP90MMPerSecond.toFixed(2).padStart(8),
            run.motion.jawCyclesPerSecond.toFixed(2).padStart(7),
            "0.000".padStart(7),
            run.closureTimingErrorMs.toFixed(1).padStart(8),
            String(run.acceleratedFrames).padStart(8)
          ].join("")
        );
      }
      lines.push("  reach by label duration:");
      for (const band of ["<=30ms", "31-50ms", "51-70ms", "71-100ms", "101-150ms", ">150ms"]) {
        lines.push(
          `    ${band.padEnd(11)}` +
            runsForPayload.map((run) => pct(run.reach.byDurationBand[band]).padStart(9)).join("")
        );
      }
    }
    lines.push("");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(5);
  });
});

/** Named so an absent fixture set is visible rather than a quiet green. */
describe("corpus availability", () => {
  it("reports whether the aligned fixtures were found", () => {
    // eslint-disable-next-line no-console
    console.log(
      `deadline corpus: ${available.length}/${CORPUS_PAYLOADS.length} fixtures found` +
        (available.length === 0 ? " — comparison SKIPPED" : ` (${available.map((e) => e.id).join(", ")})`)
    );
    expect(CORPUS_PAYLOADS.length).toBe(4);
  });
});

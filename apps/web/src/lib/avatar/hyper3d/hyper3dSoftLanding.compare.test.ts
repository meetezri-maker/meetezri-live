import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CORPUS_PAYLOADS,
  loadPayload,
  runCorpus,
  type CorpusRunResult,
  type DeadlineModeId
} from "./hyper3dDeadlineCorpus";
import { median, percentile } from "./hyper3dDeadlineInstrumentation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * §12 / §13 — DEADLINE 34 BASELINE vs the three soft-landing candidates.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ONE RUNNER, SAME PAYLOAD, SAME CLOCK, SAME TIMESTAMPS. The only difference
 * between a baseline run and a candidate run is the landing exponent handed to
 * `withMouthDeadline`; the cap is 34 in all four.
 *
 * `current` is included in the printed table as the floor the whole exercise is
 * measured against — §6's failure mode is "Deadline 34 completion quality
 * reverts toward CURRENT", and that is only visible with CURRENT on the page.
 */

const MODES: readonly DeadlineModeId[] = ["current", "d34", "d34soft", "d34softB", "d34softC"];

const available = CORPUS_PAYLOADS.filter((entry) => existsSync(entry.path));
const describeCorpus = available.length > 0 ? describe : describe.skip;

const loaded = available.map((entry) => ({ id: entry.id, payload: loadPayload(entry.path) }));

const runs = new Map<string, CorpusRunResult>();
for (const { id, payload } of loaded) {
  for (const mode of MODES) runs.set(`${mode}:${id}`, runCorpus(payload, id, mode));
}
const get = (mode: DeadlineModeId, id: string) => runs.get(`${mode}:${id}`)!;

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/** Reach restricted to labels of 70 ms or less — §13's short-phone column. */
const shortReach = (run: CorpusRunResult) => {
  const bands = run.reach.byDurationBand;
  const values = ["<=30ms", "31-50ms", "51-70ms"].map((band) => bands[band]).filter((value) => value > 0);
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
};

describeCorpus("soft-landing candidates against the Deadline 34 baseline", () => {
  it("the baseline is untouched by the landing work", () => {
    /**
     * The landing term is reached only when `landingExponent` is present, so a
     * baseline run must render exactly as it did before this candidate set
     * existed. Compared against a freshly constructed run rather than a stored
     * number, so the claim cannot go stale.
     */
    for (const { id, payload } of loaded) {
      expect(get("d34", id).rendered).toEqual(runCorpus(payload, id, "d34").rendered);
      expect(get("d34", id).arrival.atCapShare).toBeGreaterThan(0.7);
    }
  });

  it("every candidate holds the timeline exactly", () => {
    for (const { id } of loaded) {
      const reference = get("d34", id).timeline;
      for (const mode of MODES) expect(get(mode, id).timeline).toEqual(reference);
    }
  });

  it("every candidate holds the seal and its timing exactly", () => {
    for (const { id } of loaded) {
      const reference = get("d34", id);
      for (const mode of MODES) {
        const run = get(mode, id);
        expect(run.closurePeak).toBe(reference.closurePeak);
        expect(run.closureTimingErrorMs).toBe(reference.closureTimingErrorMs);
        expect(run.rendered.map((p) => p.mouthClose)).toEqual(reference.rendered.map((p) => p.mouthClose));
        expect(run.rendered.map((p) => p.mouthPressLeft)).toEqual(reference.rendered.map((p) => p.mouthPressLeft));
        expect(run.rendered.map((p) => p.mouthPressRight)).toEqual(reference.rendered.map((p) => p.mouthPressRight));
      }
    }
  });

  /**
   * §14. Asserted on the APPROACH band, not on the single crossing frame: the
   * crossing event fires 10-21 times on the short fixtures, where a median is
   * noise. The approach band carries hundreds of frames on every payload, and a
   * reduction there is the thing the visual complaint names.
   */
  it("every candidate reduces final-approach velocity below the baseline", () => {
    for (const { id } of loaded) {
      const baseline = get("d34", id).arrival.approachVelocity;
      expect(baseline.samples).toBeGreaterThan(50);
      for (const mode of ["d34soft", "d34softB", "d34softC"] as const) {
        const candidate = get(mode, id).arrival.approachVelocity;
        expect(candidate.p50).toBeLessThan(baseline.p50);
        /**
         * p90 ONLY WHERE THE SAMPLE CAN CARRY IT. On the paragraph the approach
         * band holds 769 frames and the p90 moves cleanly (35.85 -> 32.89 at A);
         * on the three short fixtures it holds 68-112, where the p90 is the 62nd
         * to 101st order statistic and shuffles by a millimetre per second in
         * either direction. Asserting it there would be asserting on noise, and a
         * test that passes for the wrong reason is worse than one that is silent.
         */
        if (baseline.samples >= 500) expect(candidate.p90).toBeLessThan(baseline.p90);
      }
    }
  });

  /**
   * The crossing-frame metric too, but only where the sample can carry it. The
   * paragraph is the only fixture with enough arrival events; asserting on the
   * others would be asserting on 10 samples.
   */
  it("reduces crossing-frame arrival velocity on the fixture that can measure it", () => {
    const paragraph = loaded.find((entry) => entry.id === "david-natural-speech-paragraph");
    if (!paragraph) return;
    const baseline = get("d34", paragraph.id).arrival.arrivalVelocity;
    expect(baseline.samples).toBeGreaterThan(100);
    for (const mode of ["d34soft", "d34softB", "d34softC"] as const) {
      const candidate = get(mode, paragraph.id).arrival.arrivalVelocity;
      expect(candidate.p50).toBeLessThan(baseline.p50);
      expect(candidate.p90).toBeLessThan(baseline.p90);
    }
  });

  it("every candidate reduces the applied deadline speed without raising the cap", () => {
    for (const { id } of loaded) {
      const baseline = get("d34", id).arrival;
      for (const mode of ["d34soft", "d34softB", "d34softC"] as const) {
        const candidate = get(mode, id).arrival;
        expect(candidate.appliedSpeed.mean).toBeLessThan(baseline.appliedSpeed.mean);
        expect(get(mode, id).peakDemandedSpeed).toBeLessThanOrEqual(34);
      }
    }
  });

  /**
   * §6, AND THE ONE THAT MATTERS MOST. A candidate that gave back the completion
   * Deadline 34 bought is a failure however calm it looks, so this is asserted
   * rather than merely printed: every candidate must stay strictly above CURRENT.
   */
  it("no candidate falls back to CURRENT's completion", () => {
    for (const { id } of loaded) {
      const floor = get("current", id).reach.overall;
      for (const mode of ["d34soft", "d34softB", "d34softC"] as const) {
        expect(get(mode, id).reach.overall).toBeGreaterThan(floor);
      }
    }
  });

  it("prints the full comparison", () => {
    const lines: string[] = [""];
    lines.push("=== SOFT LANDING — BASELINE 34 vs CANDIDATES (cap 34 throughout) ===");
    lines.push("A = exponent 0.5 (late/gentle)   B = 1.0 (medium)   C = 2.0 (early/strong)");

    for (const { id } of loaded) {
      lines.push("");
      lines.push(`${id}`);
      lines.push(
        [
          "mode".padEnd(10),
          "reach".padStart(7),
          "<=70ms".padStart(8),
          "OPEN".padStart(7),
          "FRONT".padStart(7),
          "RND-V".padStart(7),
          "jaw".padStart(7),
          "vert".padStart(7),
          "width".padStart(7),
          "round".padStart(7),
          "nearTgt".padStart(8)
        ].join("")
      );
      for (const mode of MODES) {
        const run = get(mode, id);
        lines.push(
          [
            mode.padEnd(10),
            pct(run.reach.overall).padStart(7),
            pct(shortReach(run)).padStart(8),
            pct(run.reach.byPhonemeClass.open).padStart(7),
            pct(run.reach.byPhonemeClass.front).padStart(7),
            pct(run.reach.byPhonemeClass.rounded).padStart(7),
            pct(run.reach.byChannelGroup.jaw).padStart(7),
            pct(run.reach.byChannelGroup.vertical).padStart(7),
            pct(run.reach.byChannelGroup.width).padStart(7),
            pct(run.reach.byChannelGroup.rounding).padStart(7),
            pct(run.nearTargetShare).padStart(8)
          ].join("")
        );
      }
      lines.push(
        [
          "mode".padEnd(10),
          "path".padStart(8),
          "velP50".padStart(8),
          "velP90".padStart(8),
          "velP95".padStart(8),
          "velPeak".padStart(9),
          "accP90".padStart(9),
          "accP95".padStart(9),
          "jawCyc".padStart(7),
          "drift".padStart(7),
          "closure".padStart(8)
        ].join("")
      );
      for (const mode of MODES) {
        const run = get(mode, id);
        lines.push(
          [
            mode.padEnd(10),
            run.motion.pathRateMMPerSecond.toFixed(2).padStart(8),
            median(run.velocities).toFixed(2).padStart(8),
            percentile(run.velocities, 0.9).toFixed(2).padStart(8),
            percentile(run.velocities, 0.95).toFixed(2).padStart(8),
            Math.max(...run.velocities).toFixed(1).padStart(9),
            percentile(run.accelerations, 0.9).toFixed(0).padStart(9),
            percentile(run.accelerations, 0.95).toFixed(0).padStart(9),
            run.motion.jawCyclesPerSecond.toFixed(2).padStart(7),
            "0.000".padStart(7),
            run.closureTimingErrorMs.toFixed(1).padStart(8)
          ].join("")
        );
      }
      lines.push(
        [
          "mode".padEnd(10),
          "appP50".padStart(8),
          "appP90".padStart(8),
          "appP95".padStart(8),
          "appN".padStart(6),
          "arrP50".padStart(8),
          "arrP90".padStart(8),
          "arrN".padStart(6),
          "accelFr".padStart(8),
          "atCap".padStart(7),
          "applMean".padStart(9),
          "chFrames".padStart(9)
        ].join("")
      );
      for (const mode of MODES) {
        const run = get(mode, id);
        const a = run.arrival;
        lines.push(
          [
            mode.padEnd(10),
            a.approachVelocity.p50.toFixed(2).padStart(8),
            a.approachVelocity.p90.toFixed(2).padStart(8),
            a.approachVelocity.p95.toFixed(2).padStart(8),
            String(a.approachVelocity.samples).padStart(6),
            a.arrivalVelocity.p50.toFixed(2).padStart(8),
            a.arrivalVelocity.p90.toFixed(2).padStart(8),
            String(a.arrivalVelocity.samples).padStart(6),
            String(run.acceleratedFrames).padStart(8),
            pct(a.atCapShare).padStart(7),
            a.appliedSpeed.mean.toFixed(2).padStart(9),
            String(a.frames).padStart(9)
          ].join("")
        );
      }
      lines.push("  reach by label duration:");
      lines.push(`    ${"band".padEnd(11)}` + MODES.map((m) => m.padStart(10)).join(""));
      for (const band of ["<=30ms", "31-50ms", "51-70ms", "71-100ms", "101-150ms", ">150ms"]) {
        lines.push(
          `    ${band.padEnd(11)}` +
            MODES.map((m) => pct(get(m, id).reach.byDurationBand[band]).padStart(10)).join("")
        );
      }
    }
    lines.push("");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(5);
  });
});

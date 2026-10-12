import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORPUS_PAYLOADS, loadPayload, runCorpus } from "./hyper3dDeadlineCorpus";
import {
  HYPER3D_PRODUCTION_DEADLINE,
  getMouthTransitionProfile,
  resolveMouthDeadline
} from "./engine/mappings/avatarBlendshapeConfig";
import { median, percentile } from "./hyper3dDeadlineInstrumentation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRODUCTION CONVERGENCE — 34 SOFT is what the shipped path renders.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The `production` corpus mode applies NO override, so it drives the
 * `hyper3d-usc` profile exactly as a production frame does. Every claim below is
 * therefore about the shipped configuration rather than about a reconstruction
 * of it:
 *
 *   production renders IDENTICALLY to the selected 34 SOFT configuration
 *   production is strictly better than the follower it replaced
 *   production is NOT 34 BASELINE and NOT 44
 *   timing, closure and jaw cycles are unchanged by the promotion
 *
 * The first one is the important one. `d34soft` states its cap and landing
 * explicitly; `production` inherits whatever the profile carries. Asserting the
 * two render the same frames is what makes "the accepted values were moved into
 * production" a measured fact rather than a claim about an edit.
 */

const corpus = CORPUS_PAYLOADS.filter((entry) => existsSync(entry.path));
const describeCorpus = corpus.length > 0 ? describe : describe.skip;

describe("production ownership", () => {
  it("keeps the accepted values on the hyper3d-usc profile", () => {
    const profile = getMouthTransitionProfile("hyper3d-usc")!;
    expect(HYPER3D_PRODUCTION_DEADLINE.maxSpeed).toBe(34);
    expect(HYPER3D_PRODUCTION_DEADLINE.landingExponent).toBe(0.5);
    expect(profile.deadline?.maxSpeed).toBe(HYPER3D_PRODUCTION_DEADLINE.maxSpeed);
    expect(profile.deadline?.landingExponent).toBe(HYPER3D_PRODUCTION_DEADLINE.landingExponent);
    // And no override is what production passes.
    expect(resolveMouthDeadline(profile, null)).toBe(profile);
  });
});

describeCorpus("the shipped path, over the aligned corpus", () => {
  it("renders identically to the selected 34 SOFT configuration", () => {
    /**
     * THE CENTRAL VERIFICATION. `production` passes no override and inherits the
     * profile; `d34soft` names cap 34 and landing 0.5 explicitly. If the
     * promotion moved the wrong numbers, these two diverge — and `toEqual` on
     * every rendered frame is what would catch a 0.5 that became a 1.
     */
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const production = runCorpus(payload, entry.id, "production");
      const selected = runCorpus(payload, entry.id, "d34soft");
      expect(production.rendered).toEqual(selected.rendered);
      expect(production.reach.overall).toBe(selected.reach.overall);
      expect(production.arrival.appliedSpeed.mean).toBe(selected.arrival.appliedSpeed.mean);
      // The layer is actually doing something: a cap of 34 is in force.
      expect(production.peakDemandedSpeed).toBeGreaterThan(24);
      expect(production.peakDemandedSpeed).toBeLessThanOrEqual(34);
      expect(production.acceleratedFrames).toBeGreaterThan(0);
    }
  });

  it("is a real improvement on the follower it replaced", () => {
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const production = runCorpus(payload, entry.id, "production");
      const pre = runCorpus(payload, entry.id, "current");
      // Pre-deadline runs no deadline at all.
      expect(pre.acceleratedFrames).toBe(0);
      expect(pre.peakDemandedSpeed).toBe(0);
      // And production converges further than it.
      expect(production.reach.overall).toBeGreaterThan(pre.reach.overall);
    }
  });

  it("is neither 34 BASELINE nor 44", () => {
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const production = runCorpus(payload, entry.id, "production");
      const baseline34 = runCorpus(payload, entry.id, "d34");
      const d44 = runCorpus(payload, entry.id, "d44");
      /**
       * Against 34 BASELINE: the same cap, so the same ceiling, but the landing
       * curve withdraws assistance as the shape forms — lower mean applied speed
       * and a far lower share of frames pinned at the cap.
       */
      expect(production.arrival.appliedSpeed.mean).toBeLessThan(baseline34.arrival.appliedSpeed.mean);
      expect(production.arrival.atCapShare).toBeLessThan(baseline34.arrival.atCapShare);
      expect(production.peakDemandedSpeed).toBeLessThanOrEqual(34);
      // Against 44: hardware rejected it, and production must not have reached it.
      expect(d44.peakDemandedSpeed).toBeGreaterThan(34);
      expect(production.peakDemandedSpeed).toBeLessThan(d44.peakDemandedSpeed);
    }
  });

  it("holds the timeline, the closure and the jaw cycles across the promotion", () => {
    /**
     * §6 and the verification list: no timing drift, no closure regression, no
     * jaw-cycle regression. Compared against the PRE-DEADLINE follower, because
     * that is what production used to be — so this is the regression the
     * promotion itself could have caused.
     */
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      const production = runCorpus(payload, entry.id, "production");
      const pre = runCorpus(payload, entry.id, "current");
      // The timeline is the same sequence, not a tolerance.
      expect(production.timeline).toEqual(pre.timeline);
      expect(production.frames).toBe(pre.frames);
      // The bilabial seal and its timing are untouched, frame for frame.
      expect(production.closurePeak).toBe(pre.closurePeak);
      expect(production.closureTimingErrorMs).toBe(pre.closureTimingErrorMs);
      expect(production.rendered.map((p) => p.mouthClose)).toEqual(
        pre.rendered.map((p) => p.mouthClose)
      );
      expect(production.rendered.map((p) => p.mouthPressLeft)).toEqual(
        pre.rendered.map((p) => p.mouthPressLeft)
      );
      // Jaw closing is ineligible, so the open-close rhythm cannot change.
      expect(production.motion.jawCyclesPerSecond).toBeCloseTo(pre.motion.jawCyclesPerSecond, 6);
    }
  });

  it("prints what production now renders", () => {
    const lines: string[] = [""];
    lines.push("=== PRODUCTION (34 SOFT) vs the follower it replaced, and the rejected modes ===");
    lines.push(
      "payload".padEnd(32) + "mode".padEnd(12) + "reach".padStart(8) +
      "path".padStart(9) + "velP90".padStart(9) + "jawCyc".padStart(8) +
      "applMean".padStart(10) + "atCap".padStart(8) + "closure".padStart(9)
    );
    for (const entry of corpus) {
      const payload = loadPayload(entry.path);
      for (const mode of ["current", "d34", "production", "d44"] as const) {
        const run = runCorpus(payload, entry.id, mode);
        const label = mode === "production" ? "PRODUCTION" : mode === "current" ? "pre-deadline" : mode;
        lines.push(
          entry.id.padEnd(32) + label.padEnd(12) +
          `${(run.reach.overall * 100).toFixed(1)}%`.padStart(8) +
          run.motion.pathRateMMPerSecond.toFixed(2).padStart(9) +
          run.motion.velocityP90MMPerSecond.toFixed(1).padStart(9) +
          run.motion.jawCyclesPerSecond.toFixed(2).padStart(8) +
          run.arrival.appliedSpeed.mean.toFixed(2).padStart(10) +
          `${(run.arrival.atCapShare * 100).toFixed(0)}%`.padStart(8) +
          `${run.closureTimingErrorMs.toFixed(1)}ms`.padStart(9)
        );
      }
      const production = runCorpus(payload, entry.id, "production");
      lines.push(
        "".padEnd(44) +
        `velP50 ${median(production.velocities).toFixed(2)}` +
        `  velP95 ${percentile(production.velocities, 0.95).toFixed(2)}` +
        `  approachVel p50 ${production.arrival.approachVelocity.p50.toFixed(2)}` +
        `  drift 0.000 ms`
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(5);
  }, 60_000);
});

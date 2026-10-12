import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORPUS_PAYLOADS, loadPayload, runCorpus } from "./hyper3dDeadlineCorpus";
import { ARRIVAL_BAND } from "./hyper3dArrivalDiagnostics";
import { isDeadlineEligibleChannel, HYPER3D_DEADLINE_MAX_SPEEDS } from "./engine/mappings/avatarBlendshapeConfig";
import { HYPER3D_DEADLINE_ELIGIBLE } from "./hyper3dDeadlineInstrumentation";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * §11 — MEASURE FIRST. Where does Deadline 34 arrive too aggressively?
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file exists to produce the distribution the landing curve is derived
 * FROM, so the curve is chosen from data rather than from the explanatory
 * percentages in the brief. It asserts almost nothing — it prints — and the one
 * thing it does assert is that the measurement agrees with the follower it is
 * measuring.
 */

const available = CORPUS_PAYLOADS.filter((entry) => existsSync(entry.path));
const describeCorpus = available.length > 0 ? describe : describe.skip;

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

describeCorpus("Deadline 34 arrival distribution", () => {
  it("the measurement agrees with the follower it measures", () => {
    /**
     * THE CROSS-CHECK, and the reason the numbers below can be trusted. The
     * diagnostics recompute each channel's deadline speed from
     * `deadlineConvergenceSpeed`; the mixer reports how many channels it actually
     * accelerated. If those two counts differ, the recomputation is not
     * describing the follower and every distribution below is fiction.
     */
    for (const entry of available) {
      const run = runCorpus(loadPayload(entry.path), entry.id, "d34");
      expect(run.recomputedAcceleratedChannelFrames).toBe(run.mixerAcceleratedChannelFrames);
      expect(run.mixerAcceleratedChannelFrames).toBeGreaterThan(100);
    }
  });

  it("the instrumentation's eligible set is the follower's eligible set", () => {
    for (const channel of HYPER3D_DEADLINE_ELIGIBLE) expect(isDeadlineEligibleChannel(channel)).toBe(true);
    for (const channel of ["mouthClose", "mouthPressLeft", "mouthPressRight", "mouthRollUpper", "jawForward"]) {
      expect(HYPER3D_DEADLINE_ELIGIBLE).not.toContain(channel);
      expect(isDeadlineEligibleChannel(channel)).toBe(false);
    }
  });

  it("prints where the acceleration is being spent", () => {
    const lines: string[] = [""];
    lines.push("=== DEADLINE 34 — ARRIVAL DISTRIBUTION (accelerated channel-frames) ===");
    lines.push(`arrival band = targetCompletion >= ${ARRIVAL_BAND}, cap = ${HYPER3D_DEADLINE_MAX_SPEEDS.d34}`);

    for (const entry of available) {
      const run = runCorpus(loadPayload(entry.path), entry.id, "d34");
      const a = run.arrival;
      lines.push("");
      lines.push(`${entry.id}  —  ${a.frames} accelerated channel-frames`);
      lines.push(
        `  targetCompletion    p10 ${a.targetCompletion.p10.toFixed(3)}  p25 ${a.targetCompletion.p25.toFixed(3)}` +
          `  p50 ${a.targetCompletion.p50.toFixed(3)}  p75 ${a.targetCompletion.p75.toFixed(3)}  p90 ${a.targetCompletion.p90.toFixed(3)}`
      );
      lines.push(
        `  excursionCompletion p10 ${a.excursionCompletion.p10.toFixed(3)}  p25 ${a.excursionCompletion.p25.toFixed(3)}` +
          `  p50 ${a.excursionCompletion.p50.toFixed(3)}  p75 ${a.excursionCompletion.p75.toFixed(3)}  p90 ${a.excursionCompletion.p90.toFixed(3)}`
      );
      lines.push(
        `  share of accelerated frames already past completion:  ` +
          Object.entries(a.shareAbove)
            .map(([level, share]) => `${level} ${pct(share)}`)
            .join("   ")
      );
      lines.push(
        `  remaining in label   p10 ${a.remainingMs.p10.toFixed(1)} ms  p50 ${a.remainingMs.p50.toFixed(1)} ms  p90 ${a.remainingMs.p90.toFixed(1)} ms`
      );
      lines.push(
        `  demanded speed       p50 ${a.demandedSpeed.p50.toFixed(1)}  p90 ${a.demandedSpeed.p90.toFixed(1)}  max ${a.demandedSpeed.max.toFixed(1)}  at-cap ${pct(a.atCapShare)}`
      );
      lines.push(
        `  applied speed        mean ${a.appliedSpeed.mean.toFixed(1)}  p50 ${a.appliedSpeed.p50.toFixed(1)}  p90 ${a.appliedSpeed.p90.toFixed(1)}`
      );
      lines.push(
        `  ARRIVAL VELOCITY     n ${a.arrivalVelocity.samples}  p50 ${a.arrivalVelocity.p50.toFixed(2)} mm/s` +
          `  p90 ${a.arrivalVelocity.p90.toFixed(2)}  p95 ${a.arrivalVelocity.p95.toFixed(2)}`
      );
      lines.push(`  accelerated while ALREADY inside the arrival band: ${pct(a.acceleratedInsideBandShare)}`);
      lines.push(`  near-target share of demanded channel-time: ${pct(run.nearTargetShare)}`);
    }
    lines.push("");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(lines.length).toBeGreaterThan(5);
  });
});

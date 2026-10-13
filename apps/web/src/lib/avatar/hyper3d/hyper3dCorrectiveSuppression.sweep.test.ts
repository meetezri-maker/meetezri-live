import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CoarticulationEngine } from "./engine/engine/lipsync/CoarticulationEngine";
import { FacialPoseMixer } from "./engine/engine/avatar/FacialPoseMixer";
import { TimelineCursor } from "./engine/engine/timeline/TimelineCursor";
import { SpeechBoundaryTimeline } from "./engine/engine/timeline/SpeechBoundaryTimeline";
import { normalizePhoneme } from "./engine/engine/lipsync/PhonemeNormalizer";
import { getMouthTransitionProfile, resolveMouthDeadline } from "./engine/mappings/avatarBlendshapeConfig";
import {
  BILABIAL_PHONEMES,
  CORRECTIVE_BILABIAL_LEAD_SECONDS,
  gateCorrectiveOutput,
  applyCorrectiveTargetGate,
  CORRECTIVE_MORPH,
  CORRECTIVE_TARGETS,
  correctiveBilabialSuppression,
  hyper3dCorrectiveProfile
} from "./hyper3dCorrectiveMorph";
import { CORPUS_PAYLOADS, loadPayload } from "./hyper3dDeadlineCorpus";
import { median } from "./hyper3dDeadlineInstrumentation";
import type { AvatarPayload, TimedPhoneme } from "./engine/types/avatarPayload";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STAGE 2 §4 — THE BILABIAL GATE, CHOSEN BY MEASUREMENT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * THE DEFECT THIS FILE EXISTS FOR. The first implementation scaled only the
 * correction's TARGET, ramping it to zero at the closure onset, and 0.099 of
 * rendered correction still survived INTO closure intervals on the real corpus —
 * about 0.30 mm of lower-lip drop against a ~2.3 mm closure gap. A target ramp
 * cannot fix that at any setting, because `FacialPoseMixer` is a geometric
 * follower and `mouthLowerDownDeep` is not in `LIP_SHAPE_CHANNELS`, so it rides
 * `smoothingSpeedByRegion.mouth = 28`: taking AA's 0.85 to 0.01 costs
 * `ln(85)/28 = 159 ms` of pure drain before any ramp, bought from the preceding
 * vowel, and it still only approaches zero asymptotically. The first table below
 * measures that floor rather than asserting it.
 *
 * So the same multiplier is applied on both sides of the follower, and this file
 * measures what each side is worth and what the one remaining parameter costs.
 *
 * WHAT THE SWEEP OVERTURNED, and it is the reason the parameter list shrank. A
 * DRAIN margin — holding the target at zero for a while BEFORE the onset — was
 * added first, on the reasoning that the follower needed frames to shed. With
 * the output side in place that reasoning is void: the residual is exactly zero
 * at every drain including zero. Worse, the drain is actively harmful. It
 * shortens the span the ramp has to travel, and because the output side
 * multiplies the rendered value directly there is no smoothing downstream of it,
 * so a shorter span is a visibly steeper step:
 *
 *   drain  0.00 -> max step 0.2401       drain  0.06 -> 0.2559
 *   drain  0.03 -> max step 0.2401       drain  0.09 -> 0.4078
 *
 * The drain is therefore zero, and what was going to be a swept constant is not
 * a constant at all. The parameter survives only so this file can keep showing
 * why.
 */

const FRAME = 1 / 60;
const PROFILE = getMouthTransitionProfile("hyper3d-usc")!;

/** Same normalisation the controller's suppression predicate uses. */
const isBilabial = (phoneme: TimedPhoneme) =>
  BILABIAL_PHONEMES.has(normalizePhoneme(phoneme.phoneme) ?? phoneme.phoneme);

type Sample = {
  inClosure: boolean;
  gateOpen: boolean;
  target: number;
  rendered: number;
  requested: number;
};

/**
 * The production chain with the corrective profile, at a given gate timing.
 *
 * The flags exist so the sweep can take the gate apart:
 *
 *   `outputGate: false`   the TARGET side alone — the configuration that leaked,
 *                         and a negative control is worth more than an assertion
 *                         that it leaked
 *   `apply: false`        classify every frame exactly as the gated run does but
 *                         apply nothing, which is the UNGATED baseline measured
 *                         over the identical frame set. Without that the two
 *                         runs disagree on which frames to average and a
 *                         "costs nothing" comparison compares two populations.
 */
function drive(
  payload: AvatarPayload,
  leadSeconds: number,
  drainSeconds = 0,
  outputGate = true,
  apply = true
): Sample[] {
  const cursor = new TimelineCursor(payload);
  const engine = new CoarticulationEngine();
  const mixer = new FacialPoseMixer();
  const boundaries = new SpeechBoundaryTimeline(payload);
  const mouth = resolveMouthDeadline(PROFILE, null); // production 34 SOFT
  const window = payload.behaviour_settings?.coarticulation_window ?? 0.08;
  const out: Sample[] = [];

  for (let frame = 0; ; frame += 1) {
    const t = frame * FRAME;
    if (t > payload.audio_duration) break;
    const clock = cursor.seek(t);
    const current = cursor.activePhoneme(clock);
    const lip = engine.blend({
      time: clock,
      current,
      previous: cursor.previousPhoneme(clock),
      next: cursor.nextPhoneme(clock),
      windowSeconds: window,
      profile: hyper3dCorrectiveProfile
    });
    const requested = lip.pose[CORRECTIVE_MORPH] ?? 0;
    // Exactly the controller's two halves, in the controller's order.
    const nextBilabial = cursor.nextMatchingStart(clock, isBilabial, leadSeconds);
    const suppression = correctiveBilabialSuppression(clock, nextBilabial, leadSeconds, drainSeconds);
    if (apply) applyCorrectiveTargetGate(lip.pose, suppression);
    const mixed = mixer.combine([{ channel: "lipsync", pose: lip.pose }] as never);
    const settling = boundaries.proximityAt(clock)?.insidePauseKind === "sentence";
    const followed = mixer.smooth(
      mixed.pose, FRAME, undefined, mouth, settling, current ? current.end_time - clock : null
    );
    const smoothed = apply && outputGate ? gateCorrectiveOutput(followed, suppression) : followed;
    const rendered = smoothed[CORRECTIVE_MORPH] ?? 0;
    out.push({
      inClosure: Boolean(current && isBilabial(current)),
      gateOpen: suppression >= 1,
      target: lip.pose[CORRECTIVE_MORPH] ?? 0,
      rendered,
      requested
    });
  }
  return out;
}

const corpus = CORPUS_PAYLOADS.filter((entry) => existsSync(entry.path));
const describeCorpus = corpus.length > 0 ? describe : describe.skip;

describeCorpus("the bilabial gate, measured", () => {
  const payloads = corpus.map((entry) => ({ id: entry.id, payload: loadPayload(entry.path) }));

  function evaluate(leadSeconds: number, drainSeconds = 0, outputGate = true, apply = true) {
    let worstResidual = 0;
    let maxTargetInClosure = 0;
    let closureFrames = 0;
    let maxStep = 0;
    const reaches: number[] = [];
    const openReaches: number[] = [];
    for (const { payload } of payloads) {
      let previous = 0;
      for (const s of drive(payload, leadSeconds, drainSeconds, outputGate, apply)) {
        if (s.inClosure) {
          closureFrames += 1;
          if (s.rendered > worstResidual) worstResidual = s.rendered;
          if (s.target > maxTargetInClosure) maxTargetInClosure = s.target;
        } else if (s.requested > 0) {
          reaches.push(s.rendered / s.requested);
          // Frames the gate is not touching at all: the articulation it must not cost.
          if (s.gateOpen) openReaches.push(s.rendered / s.requested);
        }
        const step = Math.abs(s.rendered - previous);
        if (step > maxStep) maxStep = step;
        previous = s.rendered;
      }
    }
    return {
      worstResidual,
      maxTargetInClosure,
      closureFrames,
      maxStep,
      medianReach: reaches.length ? median(reaches) : 0,
      medianOpenReach: openReaches.length ? median(openReaches) : 0,
      openFrames: openReaches.length
    };
  }

  /** The same frames, the same classification, nothing applied. */
  const ungated = (leadSeconds = CORRECTIVE_BILABIAL_LEAD_SECONDS) =>
    evaluate(leadSeconds, 0, true, false);

  it("prints the evidence for the gate's shape and its one parameter", () => {
    const base = ungated();
    const lines: string[] = [""];
    lines.push("=== §4 BILABIAL GATE — four aligned payloads, production chain at 34 SOFT ===");
    lines.push("");
    lines.push(
      `UNGATED BASELINE   residual ${base.worstResidual.toFixed(5)}` +
      `   maxStep ${base.maxStep.toFixed(4)}   reach ${(base.medianReach * 100).toFixed(1)}%`
    );
    lines.push("  (the channel's own motion: what the gate must not make worse)");
    lines.push("");
    lines.push("TARGET SIDE ONLY — the configuration that leaked:");
    lines.push("lead".padStart(6) + "drain".padStart(7) + "maxResidual".padStart(13) + "reach".padStart(9));
    for (const [lead, drain] of [[0.12, 0], [0.14, 0], [0.14, 0.06], [0.18, 0.09]] as const) {
      const r = evaluate(lead, drain, false);
      lines.push(
        lead.toFixed(2).padStart(6) + drain.toFixed(2).padStart(7) +
        r.worstResidual.toFixed(5).padStart(13) + `${(r.medianReach * 100).toFixed(1)}%`.padStart(9)
      );
    }
    lines.push("");
    lines.push("BOTH SIDES, DRAIN 0 — residual is exact, so the trade is step against reach:");
    lines.push(
      "lead".padStart(6) + "maxResidual".padStart(13) + "maxStep".padStart(10) +
      "reach".padStart(9) + "reachWhereGateOpen".padStart(20)
    );
    const rows: Array<{ lead: number; r: ReturnType<typeof evaluate> }> = [];
    for (const lead of [0.06, 0.08, 0.1, 0.12, 0.14, 0.18]) {
      const r = evaluate(lead);
      rows.push({ lead, r });
      lines.push(
        lead.toFixed(2).padStart(6) + r.worstResidual.toFixed(5).padStart(13) +
        r.maxStep.toFixed(4).padStart(10) + `${(r.medianReach * 100).toFixed(1)}%`.padStart(9) +
        `${(r.medianOpenReach * 100).toFixed(1)}%`.padStart(20)
      );
    }
    lines.push("");
    lines.push("THE DRAIN, at the shipped lead — shorter ramp, steeper step, less reach:");
    lines.push("drain".padStart(7) + "maxResidual".padStart(13) + "maxStep".padStart(10) + "reach".padStart(9));
    for (const drain of [0, 0.03, 0.06, 0.09]) {
      const r = evaluate(CORRECTIVE_BILABIAL_LEAD_SECONDS, drain);
      lines.push(
        drain.toFixed(2).padStart(7) + r.worstResidual.toFixed(5).padStart(13) +
        r.maxStep.toFixed(4).padStart(10) + `${(r.medianReach * 100).toFixed(1)}%`.padStart(9)
      );
    }
    lines.push("");
    lines.push(`  SHIPPED: lead ${CORRECTIVE_BILABIAL_LEAD_SECONDS}, drain 0`);
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
    expect(rows.length).toBe(6);
  }, 240_000);

  it("leaves a closure exactly untouched", () => {
    const r = evaluate(CORRECTIVE_BILABIAL_LEAD_SECONDS);
    expect(r.closureFrames).toBeGreaterThan(50);
    expect(r.maxTargetInClosure).toBe(0);
    // Exactness is the point of the output side: not "small", zero.
    expect(r.worstResidual).toBe(0);
  }, 240_000);

  it("adds no motion beyond what removing the correction inherently costs", () => {
    /**
     * The gate multiplies the RENDERED value, so unlike a target change it has
     * no follower downstream to smooth it and could in principle introduce
     * motion of its own. The bound that matters is not an arbitrary threshold
     * but the channel's own largest step with nothing applied, over the same
     * frames.
     *
     * The gated run is 5.6 % above it — 0.2401 against 0.2273 — and the excess
     * is not the ramp. It is the correction RISING on the vowel after a closure
     * from a cleanly zeroed start instead of from a residual, which is the
     * direct consequence of having suppressed it and cannot be removed without
     * giving up the suppression. At the asset's 3.0 mm amplitude it is 0.038 mm
     * of extra lower-lip travel in one frame, against a channel that already
     * moves 0.68 mm in a frame.
     */
    const base = ungated();
    const gated = evaluate(CORRECTIVE_BILABIAL_LEAD_SECONDS);
    expect(base.maxStep).toBeGreaterThan(0);
    expect(gated.maxStep).toBeLessThan(base.maxStep * 1.1);
  }, 240_000);

  it("costs nothing on the frames it is not touching", () => {
    /**
     * §4 forbids buying the closure with vowel articulation. Away from a
     * bilabial the gate is exactly 1 and multiplying by 1 is identity, so these
     * frames should be the ungated run — and both runs classify frames with the
     * same lead, so it is the same population twice rather than two different
     * averages.
     *
     * NOT BIT-IDENTICAL, AND THE REASON IS WORTH STATING. The follower has
     * memory. A gate-open frame shortly after a closure inherits a follower
     * state that the suppression helped produce, so its rendered value differs
     * from a run that was never suppressed. At the shipped 100 ms lead the
     * median open-frame reach differs by 0.0015 of weight — 0.0044 mm of
     * lower-lip displacement at the asset's 2.973 mm full travel, three orders
     * of magnitude below the correction itself.
     *
     * THE BOUND IS PHYSICAL, not a decimal count, because the quantity is
     * genuinely inexact and a decimal count hides how large it is allowed to
     * be. 0.01 of weight is 0.03 mm, which is below the 0.1 mm the asset's own
     * vertices are symmetric to.
     */
    const PEAK_MM = 2.973;
    const base = ungated();
    const gated = evaluate(CORRECTIVE_BILABIAL_LEAD_SECONDS);
    expect(gated.openFrames).toBeGreaterThan(100);
    expect(gated.openFrames).toBe(base.openFrames);
    const difference = Math.abs(gated.medianOpenReach - base.medianOpenReach);
    expect(difference).toBeLessThan(0.01);
    expect(difference * PEAK_MM).toBeLessThan(0.03);
    // And the gate never ADDS reach, which would mean it was not a multiplier.
    expect(gated.medianOpenReach).toBeLessThanOrEqual(base.medianOpenReach + 1e-9);
  }, 240_000);

  it("the target side alone cannot do this, which is why there are two", () => {
    const targetOnly = evaluate(CORRECTIVE_BILABIAL_LEAD_SECONDS, 0, false);
    expect(targetOnly.worstResidual).toBeGreaterThan(0.01);
    // Even the most generous target-only setting leaks, and pays in reach for it.
    const generous = evaluate(0.18, 0.09, false);
    expect(generous.worstResidual).toBeGreaterThan(0);
    expect(generous.medianReach).toBeLessThan(targetOnly.medianReach);
  }, 240_000);

  it("a drain margin makes the step worse, which is why it is zero", () => {
    /**
     * The measurement that removed a parameter. A drain cannot improve the
     * residual — it is already exactly zero — and it shortens the ramp, so it
     * can only steepen the gate.
     */
    const none = evaluate(CORRECTIVE_BILABIAL_LEAD_SECONDS, 0);
    const drained = evaluate(CORRECTIVE_BILABIAL_LEAD_SECONDS, 0.09);
    expect(none.worstResidual).toBe(0);
    expect(drained.worstResidual).toBe(0);
    expect(drained.maxStep).toBeGreaterThan(none.maxStep);
    expect(drained.medianReach).toBeLessThan(none.medianReach);
  }, 240_000);
});

describe("the gate's shape", () => {
  it("closes exactly at the onset and stays closed through the closure", () => {
    const onset = 1.0;
    expect(correctiveBilabialSuppression(onset, onset)).toBe(0);
    expect(correctiveBilabialSuppression(onset + 0.05, onset)).toBe(0);
    // Outside the lead: identity, so articulation away from a closure is untouched.
    expect(correctiveBilabialSuppression(onset - 1, onset)).toBe(1);
    /**
     * At exactly one lead before the onset, `1.0 - 0.1` is 0.9 and the lead
     * comes back as 0.09999999999999998 — a hair INSIDE the ramp, so it takes
     * the smootherstep branch at x = 0.9999999999999998 and returns
     * 0.9999999999999993. Asserting `toBe(1)` there would be asserting IEEE 754
     * rather than the gate's shape.
     */
    expect(correctiveBilabialSuppression(onset - CORRECTIVE_BILABIAL_LEAD_SECONDS, onset))
      .toBeCloseTo(1, 12);
  });

  it("is monotone, and its own worst frame step is below the channel's", () => {
    /**
     * The gate multiplies the rendered value with no follower downstream, so its
     * shape is the rendered shape. Two properties matter: it never increases
     * correction as a closure approaches, and no single frame can land on a
     * jump.
     *
     * THE BOUND IS THE CHANNEL'S OWN MOTION. A 100 ms ramp is 6 frames at 60 Hz
     * and smootherstep's steepest point is 1.875, so the worst per-frame change
     * in the MULTIPLIER is ~0.3125. What reaches the lip is that times the
     * correction being removed, and at AA's 0.85 that is 0.27 of weight — which
     * is why the corpus measurement above, at 0.2401 against an ungated 0.2273,
     * is the number that decides this rather than the slope: the ramp's
     * theoretical worst case does not coincide with a frame carrying full
     * correction.
     */
    let previous = 0;
    for (let lead = 0; lead <= CORRECTIVE_BILABIAL_LEAD_SECONDS; lead += 0.0005) {
      const s = correctiveBilabialSuppression(0, lead);
      expect(s).toBeGreaterThanOrEqual(previous - 1e-12);
      previous = s;
    }
    expect(previous).toBeCloseTo(1, 4);

    // Sampled the way a 60 Hz frame actually samples it.
    let worstFrameStep = 0;
    let sampled = correctiveBilabialSuppression(0, 0);
    for (let frame = 1; frame <= 12; frame += 1) {
      const next = correctiveBilabialSuppression(0, frame / 60);
      worstFrameStep = Math.max(worstFrameStep, Math.abs(next - sampled));
      sampled = next;
    }
    expect(worstFrameStep).toBeLessThan(0.35);
  });

  it("degrades gracefully when the timeline gives less lead than it wants", () => {
    /**
     * §4: "when the aligned phoneme timeline provides sufficient lead time". A
     * 30 ms vowel immediately before a bilabial gives 30 ms, not 100. The ramp
     * is a function of the lead ACTUALLY available, so a short lead simply
     * starts the gate part-closed and keeps closing — there is no special case
     * and nothing to retime. And the output side holds whatever the lead was,
     * which is what makes the short-lead case SAFE rather than merely degraded:
     * the closure is still exactly zero after a 10 ms warning.
     */
    let previous = -1;
    for (const lead of [0.01, 0.02, 0.03, 0.05, 0.08]) {
      const s = correctiveBilabialSuppression(0, lead);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(1);
      // Less warning is never MORE correction.
      expect(s).toBeGreaterThan(previous);
      previous = s;
    }
    // However little warning there was, the closure itself is shut.
    expect(correctiveBilabialSuppression(0.01, 0.01)).toBe(0);
  });

  it("fails closed on a malformed timeline", () => {
    expect(correctiveBilabialSuppression(0, Number.NaN)).toBe(0);
    expect(correctiveBilabialSuppression(Number.NaN, 1)).toBe(0);
    expect(correctiveBilabialSuppression(0, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("suppresses nothing when no bilabial is within the horizon", () => {
    expect(correctiveBilabialSuppression(0, null)).toBe(1);
    expect(Object.keys(CORRECTIVE_TARGETS)).toHaveLength(3);
  });
});

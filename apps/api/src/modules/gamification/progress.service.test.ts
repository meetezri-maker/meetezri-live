import {
  ProgressValidationError,
  applyCheckIn,
  computeNumericProgress,
  computeProgress,
  isMilestoneRegression,
  milestoneToProgress,
  validateCheckInValue,
  validateTargetValue,
} from "./progress.service";

describe("gamification/progress.service", () => {
  describe("numeric progress (count / duration / amount)", () => {
    it("computes count progress", () => {
      expect(computeNumericProgress(3, 10)).toBe(30);
      expect(computeProgress({ trackingType: "count", currentValue: 3, targetValue: 10 })).toBe(30);
    });

    it("computes duration progress (e.g. minutes)", () => {
      expect(computeProgress({ trackingType: "duration", currentValue: 45, targetValue: 60 })).toBe(75);
    });

    it("computes amount progress (e.g. dollars saved)", () => {
      expect(computeProgress({ trackingType: "amount", currentValue: 250, targetValue: 1000 })).toBe(25);
    });

    it("caps progress at 100%", () => {
      expect(computeNumericProgress(50, 10)).toBe(100);
      expect(computeProgress({ trackingType: "count", currentValue: 999, targetValue: 10 })).toBe(100);
    });

    it("never returns negative progress", () => {
      expect(computeNumericProgress(-5, 10)).toBe(0);
    });

    it("rounds to the nearest percent", () => {
      expect(computeNumericProgress(1, 3)).toBe(33);
      expect(computeNumericProgress(2, 3)).toBe(67);
    });
  });

  describe("validation", () => {
    it("rejects target values <= 0", () => {
      expect(() => validateTargetValue(0)).toThrow(ProgressValidationError);
      expect(() => validateTargetValue(-1)).toThrow(ProgressValidationError);
      expect(() => computeNumericProgress(1, 0)).toThrow(ProgressValidationError);
    });

    it("accepts positive target values", () => {
      expect(() => validateTargetValue(1)).not.toThrow();
    });

    it("rejects negative check-in values", () => {
      expect(() => validateCheckInValue(-0.01)).toThrow(ProgressValidationError);
      expect(() => validateCheckInValue(0)).not.toThrow();
      expect(() => validateCheckInValue(5)).not.toThrow();
    });
  });

  describe("manual milestone mapping", () => {
    it("maps each milestone to its canonical percentage", () => {
      expect(milestoneToProgress("not_started")).toBe(0);
      expect(milestoneToProgress("started")).toBe(25);
      expect(milestoneToProgress("making_progress")).toBe(50);
      expect(milestoneToProgress("significant_progress")).toBe(75);
      expect(milestoneToProgress("completed")).toBe(100);
    });

    it("rejects invalid milestone values", () => {
      expect(() => milestoneToProgress("almost_there")).toThrow(ProgressValidationError);
      expect(() => computeProgress({ trackingType: "manual_milestone", milestone: "bogus" })).toThrow(
        ProgressValidationError
      );
    });

    it("detects milestone regression", () => {
      expect(isMilestoneRegression("making_progress", "started")).toBe(true);
      expect(isMilestoneRegression("started", "completed")).toBe(false);
      expect(isMilestoneRegression("started", "started")).toBe(false);
    });
  });
});

describe("applyCheckIn (accumulate value / set milestone)", () => {
  it("accumulates numeric value onto the current value", () => {
    const r = applyCheckIn({ trackingType: "count", currentValue: 2, targetValue: 10, submission: { value: 3 } });
    expect(r.currentValue).toBe(5);
    expect(r.progress).toBe(50);
    expect(r.valueAdded).toBe(3);
  });

  it("caps numeric progress at 100", () => {
    const r = applyCheckIn({ trackingType: "amount", currentValue: 900, targetValue: 1000, submission: { value: 500 } });
    expect(r.progress).toBe(100);
  });

  it("sets manual milestone progress without changing current value", () => {
    const r = applyCheckIn({ trackingType: "manual_milestone", currentValue: 0, submission: { milestone: "started" } });
    expect(r.progress).toBe(25);
    expect(r.milestone).toBe("started");
  });

  it("rejects a numeric check-in with no value", () => {
    expect(() => applyCheckIn({ trackingType: "count", currentValue: 0, targetValue: 10, submission: {} })).toThrow(
      ProgressValidationError
    );
  });

  it("rejects a numeric check-in with no positive target", () => {
    expect(() =>
      applyCheckIn({ trackingType: "count", currentValue: 0, targetValue: 0, submission: { value: 1 } })
    ).toThrow(ProgressValidationError);
  });

  it("rejects a manual check-in with no milestone", () => {
    expect(() => applyCheckIn({ trackingType: "manual_milestone", currentValue: 0, submission: {} })).toThrow(
      ProgressValidationError
    );
  });
});

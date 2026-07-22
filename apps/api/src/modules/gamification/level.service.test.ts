import { calculateLevel } from "./level.service";

describe("gamification/level.service", () => {
  it("maps points to levels at the approved boundaries", () => {
    expect(calculateLevel(0).level).toBe(1);
    expect(calculateLevel(99).level).toBe(1);
    expect(calculateLevel(100).level).toBe(2);
    expect(calculateLevel(200).level).toBe(3);
  });

  it("reports level progress within a level", () => {
    const at160 = calculateLevel(160);
    expect(at160.level).toBe(2);
    expect(at160.pointsWithinLevel).toBe(60);
    expect(at160.levelProgressPercentage).toBe(60);
    expect(at160.pointsToNextLevel).toBe(40);
  });

  it("shows a full next-level requirement at an exact threshold", () => {
    const at100 = calculateLevel(100);
    expect(at100.pointsWithinLevel).toBe(0);
    expect(at100.pointsToNextLevel).toBe(100);
    expect(at100.levelProgressPercentage).toBe(0);
  });

  it("normalizes negative and fractional inputs", () => {
    expect(calculateLevel(-50).level).toBe(1);
    expect(calculateLevel(-50).totalPoints).toBe(0);
    expect(calculateLevel(149.9).level).toBe(2);
    expect(calculateLevel(149.9).pointsWithinLevel).toBe(49);
  });
});

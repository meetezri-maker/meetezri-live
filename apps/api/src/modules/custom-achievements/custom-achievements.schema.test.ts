import {
  createCustomAchievementSchema,
  updateCustomAchievementSchema,
} from "./custom-achievements.schema";
import {
  PERSONAL_ACHIEVEMENT_COMPLETION_POINTS,
  PERSONAL_GOAL_COMPLETION_POINTS,
} from "../gamification/rewards.constants";

describe("custom-achievements schema hardening", () => {
  it("strips client-supplied reward/unlock fields on create", () => {
    const parsed = createCustomAchievementSchema.parse({
      title: "Read 5 books",
      description: "Reading goal",
      icon: "book",
      category: "personal",
      progress: 2,
      total: 5,
      rarity: "common",
      // Client attempts to control reward state — must be ignored:
      unlocked: true,
      points: 999999,
    } as Record<string, unknown>);

    expect(parsed).not.toHaveProperty("unlocked");
    expect(parsed).not.toHaveProperty("points");
  });

  it("strips client-supplied reward/unlock fields on update", () => {
    const parsed = updateCustomAchievementSchema.parse({
      progress: 5,
      unlocked: true,
      points: 100,
    } as Record<string, unknown>);

    expect(parsed).not.toHaveProperty("unlocked");
    expect(parsed).not.toHaveProperty("points");
    expect(parsed.progress).toBe(5);
  });
});

describe("reward constants are the single source of truth", () => {
  it("uses the approved reward amounts", () => {
    expect(PERSONAL_GOAL_COMPLETION_POINTS).toBe(20);
    expect(PERSONAL_ACHIEVEMENT_COMPLETION_POINTS).toBe(10);
  });
});

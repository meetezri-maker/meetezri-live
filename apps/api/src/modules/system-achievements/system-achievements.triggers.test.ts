const evaluateSystemAchievements = jest.fn();
jest.mock("./system-achievements.service", () => ({ evaluateSystemAchievements }));

import { onUserActivity } from "./system-achievements.triggers";

const USER = "user-1";

beforeEach(() => {
  jest.clearAllMocks();
  evaluateSystemAchievements.mockResolvedValue({ newlyEarned: [], newlyRewarded: [], pointsAwarded: 0 });
});

describe("onUserActivity event -> metric mapping", () => {
  it("session completion evaluates only the sessions metric", async () => {
    await onUserActivity(USER, "session_completed");
    expect(evaluateSystemAchievements).toHaveBeenCalledWith(USER, { metrics: ["sessions_completed"] });
  });

  it("mood logging evaluates both mood count and streak", async () => {
    await onUserActivity(USER, "mood_logged");
    expect(evaluateSystemAchievements).toHaveBeenCalledWith(USER, {
      metrics: ["mood_checkins", "streak_days"],
    });
  });

  it("journal creation evaluates only the journal metric", async () => {
    await onUserActivity(USER, "journal_created");
    expect(evaluateSystemAchievements).toHaveBeenCalledWith(USER, { metrics: ["journal_entries"] });
  });

  it("wellness completion evaluates only the wellness metric", async () => {
    await onUserActivity(USER, "wellness_exercise_completed");
    expect(evaluateSystemAchievements).toHaveBeenCalledWith(USER, {
      metrics: ["wellness_exercises"],
    });
  });

  it("community publish evaluates only the community metric", async () => {
    await onUserActivity(USER, "community_post_published");
    expect(evaluateSystemAchievements).toHaveBeenCalledWith(USER, { metrics: ["community_posts"] });
  });

  it("never evaluates all metrics at once (scoped per event)", async () => {
    await onUserActivity(USER, "session_completed");
    const call = evaluateSystemAchievements.mock.calls[0][1];
    expect(call.metrics.length).toBeLessThanOrEqual(2);
  });
});

describe("failure isolation", () => {
  it("swallows evaluation errors so the primary action is never rolled back", async () => {
    evaluateSystemAchievements.mockRejectedValue(new Error("ledger down"));
    await expect(onUserActivity(USER, "journal_created")).resolves.toBeNull();
  });

  it("no-ops without a user id", async () => {
    const res = await onUserActivity("", "session_completed");
    expect(res).toBeNull();
    expect(evaluateSystemAchievements).not.toHaveBeenCalled();
  });
});

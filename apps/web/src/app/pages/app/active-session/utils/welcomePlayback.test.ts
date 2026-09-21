import { describe, expect, it, vi } from "vitest";
import {
  attachLateWelcomeAvatarData,
  releasePrePermissionWelcome,
} from "./welcomePlayback";

describe("pre-permission welcome playback bridge", () => {
  it("attaches late avatar data to the queued welcome selected by the runtime boundary", () => {
    const queue = [
      {
        subtitle: "Welcome",
        avatarData: null as { sentence?: string; phonemes: string[] } | null,
        avatarDataReceived: null as number | null,
      },
    ];
    const avatarData = { sentence: "Welcome to Solace", phonemes: ["W", "EH"] };

    const attached = attachLateWelcomeAvatarData(queue, avatarData, 42);

    expect(attached).toBe(queue[0]);
    expect(queue[0]).toMatchObject({
      subtitle: "Welcome to Solace",
      avatarData,
      avatarDataReceived: 42,
    });
  });

  it("starts the live timeline turn before queued audio enters the scheduler", () => {
    const queue = ["welcome-audio"];
    const prepareScheduledTurn = vi.fn();
    const enqueueAll = vi.fn();
    const markSchedulerTtsDone = vi.fn();

    expect(
      releasePrePermissionWelcome({
        queue,
        prepareScheduledTurn,
        enqueueAll,
        ttsDoneReceived: true,
        markSchedulerTtsDone,
      }),
    ).toBe(1);

    expect(queue).toEqual([]);
    expect(prepareScheduledTurn).toHaveBeenCalledOnce();
    expect(enqueueAll).toHaveBeenCalledWith(["welcome-audio"]);
    expect(markSchedulerTtsDone).toHaveBeenCalledOnce();
    expect(prepareScheduledTurn.mock.invocationCallOrder[0]).toBeLessThan(
      enqueueAll.mock.invocationCallOrder[0],
    );
    expect(enqueueAll.mock.invocationCallOrder[0]).toBeLessThan(
      markSchedulerTtsDone.mock.invocationCallOrder[0],
    );
  });
});

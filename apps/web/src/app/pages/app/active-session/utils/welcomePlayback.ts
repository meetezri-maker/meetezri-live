export type QueuedWelcomeWithAvatarData<TAvatarData> = {
  subtitle: string;
  avatarData: TAvatarData | null;
  avatarDataReceived: number | null;
};

/** Attach late welcome metadata before the pre-permission queue is released. */
export function attachLateWelcomeAvatarData<
  TAvatarData extends { sentence?: string | null },
>(
  queue: Array<QueuedWelcomeWithAvatarData<TAvatarData>>,
  avatarData: TAvatarData,
  receivedAt: number,
): QueuedWelcomeWithAvatarData<TAvatarData> | null {
  const queued = queue.find((item) => !item.avatarData) ?? null;
  if (!queued) return null;

  queued.avatarData = avatarData;
  queued.avatarDataReceived = receivedAt;
  queued.subtitle = avatarData.sentence?.trim() || queued.subtitle;
  return queued;
}

/**
 * Release the welcome after the permission gesture and transfer an early
 * `tts_done` into the scheduler that now owns playback completion.
 */
export function releasePrePermissionWelcome<T>(options: {
  queue: T[];
  prepareScheduledTurn?: () => void;
  enqueueAll: (items: T[]) => void;
  ttsDoneReceived: boolean;
  markSchedulerTtsDone: () => void;
}): number {
  const queued = options.queue.splice(0);
  if (queued.length === 0) return 0;

  options.prepareScheduledTurn?.();
  options.enqueueAll(queued);
  if (options.ttsDoneReceived) options.markSchedulerTtsDone();
  return queued.length;
}

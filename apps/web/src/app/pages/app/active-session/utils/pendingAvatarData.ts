/**
 * Pending split-shape `avatar_data` (phonemes without bundled audio) waiting to
 * be paired with a raw binary audio frame — the ONE existing pending queue in
 * ActiveSession (`avatarPendingQueueRef`). Nothing here owns state.
 */
export type PendingAvatarDataEntry<TData> = {
  data: TData;
  receivedAt: number;
  chunkIndex: number | null;
  /**
   * The response epoch current when this entry arrived. The protocol carries
   * no response id, so ownership is bounded by the response-lifecycle messages
   * the client already handles (see `ActiveSession` `wsResponseEpochRef`).
   */
  responseEpoch?: number;
};

type SplitCapable = { audio_b64?: string };

/**
 * EXISTING pairing (B1.1c), unchanged: exact `chunk_index` match on the
 * per-turn ordinal, else FIFO, else null. Mutates `queue`.
 *
 * This is the path every avatar runtime except Hyper3D still takes.
 */
export function takePendingAvatarData<TData>(
  queue: Array<PendingAvatarDataEntry<TData>>,
  seq: number,
): PendingAvatarDataEntry<TData> | null {
  const exactIdx = queue.findIndex((entry) => entry.chunkIndex === seq);
  const idx = exactIdx >= 0 ? exactIdx : queue.length > 0 ? 0 : -1;
  if (idx < 0) return null;
  const [entry] = queue.splice(idx, 1);
  return entry;
}

const ownedBy = <TData extends SplitCapable>(entry: PendingAvatarDataEntry<TData>, epoch: number) =>
  !entry.data.audio_b64 && entry.responseEpoch === epoch;

/**
 * Which pending metadata may survive an `audio_start` (Hyper3D runtime only).
 *
 * The deployed backend sends the greeting's and the comfort phrase's
 * `avatar_data` BEFORE `audio_start`, inside the same response. Only entries
 * that (a) carry no bundled audio — bundled entries were already scheduled as
 * their own audio — and (b) belong to the CURRENT response epoch are kept.
 * Everything else is reported and dropped.
 */
export function retainCurrentResponseAvatarData<TData extends SplitCapable>(
  queue: ReadonlyArray<PendingAvatarDataEntry<TData>>,
  currentEpoch: number,
): {
  kept: Array<PendingAvatarDataEntry<TData>>;
  rejectedStale: number;
  rejectedBundled: number;
} {
  const kept: Array<PendingAvatarDataEntry<TData>> = [];
  let rejectedStale = 0;
  let rejectedBundled = 0;
  for (const entry of queue) {
    if (entry.data.audio_b64) rejectedBundled += 1;
    else if (entry.responseEpoch !== currentEpoch) rejectedStale += 1;
    else kept.push(entry);
  }
  return { kept, rejectedStale, rejectedBundled };
}

export type AvatarDataAssociationMethod = "exact-index" | "existing-fifo" | "no-metadata";

/**
 * Pair a binary audio frame with metadata owned by the response the audio
 * ARRIVED in (Hyper3D runtime only). Mutates `queue`.
 *
 *   1. entries from another response epoch are removed — they can never pair;
 *   2. exact `chunk_index === seq` among current-response split entries;
 *   3. the existing FIFO fallback, restricted to entries WITHOUT an index
 *      (the backend omitted it) — an explicit, different index never wins;
 *   4. otherwise no metadata.
 *
 * A consumed index retires any duplicate of that index in the same response.
 */
export function takeCurrentResponseAvatarData<TData extends SplitCapable>(
  queue: Array<PendingAvatarDataEntry<TData>>,
  seq: number,
  audioEpoch: number,
): {
  entry: PendingAvatarDataEntry<TData> | null;
  method: AvatarDataAssociationMethod;
  rejectedStale: number;
  retiredDuplicates: number;
} {
  let rejectedStale = 0;
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const entry = queue[index];
    if (!entry.data.audio_b64 && entry.responseEpoch !== audioEpoch) {
      queue.splice(index, 1);
      rejectedStale += 1;
    }
  }

  let method: AvatarDataAssociationMethod = "exact-index";
  let at = queue.findIndex((entry) => ownedBy(entry, audioEpoch) && entry.chunkIndex === seq);
  if (at < 0) {
    method = "existing-fifo";
    at = queue.findIndex((entry) => ownedBy(entry, audioEpoch) && entry.chunkIndex === null);
  }
  if (at < 0) return { entry: null, method: "no-metadata", rejectedStale, retiredDuplicates: 0 };

  const [entry] = queue.splice(at, 1);
  let retiredDuplicates = 0;
  if (entry.chunkIndex !== null) {
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      const other = queue[index];
      if (ownedBy(other, audioEpoch) && other.chunkIndex === entry.chunkIndex) {
        queue.splice(index, 1);
        retiredDuplicates += 1;
      }
    }
  }
  return { entry, method, rejectedStale, retiredDuplicates };
}

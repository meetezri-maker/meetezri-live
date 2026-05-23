import { useRef } from "react";

export interface LiveUserSpeechStore {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => string;
  set: (text: string) => void;
}

/** External store for interim STT — updates UI via useSyncExternalStore without re-rendering the session orchestrator. */
export function useLiveUserSpeechStore(): LiveUserSpeechStore {
  const storeRef = useRef<LiveUserSpeechStore | null>(null);

  if (!storeRef.current) {
    let text = "";
    const listeners = new Set<() => void>();

    storeRef.current = {
      subscribe(onStoreChange) {
        listeners.add(onStoreChange);
        return () => {
          listeners.delete(onStoreChange);
        };
      },
      getSnapshot() {
        return text;
      },
      set(next) {
        if (text === next) return;
        text = next;
        listeners.forEach((listener) => listener());
      },
    };
  }

  return storeRef.current;
}

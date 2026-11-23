/**
 * Account isolation signal: fired by AuthContext whenever per-user client state must be dropped
 * (sign-out — including one made in another tab — or a different account signing in).
 *
 * Features that hold per-user state outside React Query (e.g. the Conversations service) listen
 * here so they can discard it and cancel pending work even if none of their components is mounted.
 * Deliberately tiny and dependency-free so importing it never pulls a feature into the main bundle.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onAuthIdentityReset(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAuthIdentityReset(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // one feature's cleanup must not stop another's
    }
  }
}

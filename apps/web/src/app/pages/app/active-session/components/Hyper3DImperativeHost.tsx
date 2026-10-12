import { Suspense, lazy, useEffect, useRef, type MutableRefObject } from "react";
import {
  createHyper3dImperativeHost,
  type Hyper3dHostFailure,
  type Hyper3dImperativeHost as HostInstance,
} from "@/lib/avatar/hyper3d/hyper3dImperativeHost";
import { getHyper3dPlaybackClock } from "@/lib/avatar/hyper3d/hyper3dEngineRegistry";
import { recordHyper3dAssetTimeline } from "@/lib/avatar/hyper3d/hyper3dPathDiagnostics";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEV REVIEW PANELS, AND WHY THEY ARE A DYNAMIC IMPORT.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `import.meta.env.DEV` is replaced by Vite with a literal `false` in a
 * production build, so `false ? lazy(...) : null` folds to `null`, the
 * `import()` below is never emitted, and `Hyper3DDevPanels` — plus both review
 * panels and everything only they reach — is not in the production graph at all.
 *
 * THIS IS THE SECOND OF TWO GATES, not the only one. Each panel still decides
 * its own visibility from its own `import.meta.env.DEV`-first availability flag,
 * so a panel cannot render even in DEV until a reviewer opts in with a query
 * parameter. What changed is that production no longer DOWNLOADS the code it
 * was already refusing to run.
 *
 * `lazy` RATHER THAN A PLAIN `import()`: the panels are React components and the
 * host renders synchronously. `Suspense` with a `null` fallback means the first
 * frame of the avatar never waits for a review panel, which is also what keeps
 * this invisible to the one thing the host exists to do.
 */
const Hyper3DDevPanels = import.meta.env.DEV
  ? lazy(() => import("./Hyper3DDevPanels"))
  : null;

/**
 * The React shell around the imperative host.
 *
 * Deliberately thin: it owns a container div and a mount effect, and nothing
 * else. All three.js work, all failure handling and the animation loop live in
 * `createHyper3dImperativeHost`, which has no React dependency and can be tested
 * without one.
 *
 * NO PER-FRAME REACT STATE. Every live value reaches the host through refs that
 * `ActiveSession` already maintains, read inside the animation loop. This
 * component renders once per mount and then stays out of the way.
 */
export interface Hyper3DImperativeHostProps {
  /** Response-relative playback seconds, written by the Phase 1 timing adapter. */
  avatarAudioCurrentTimeRef: MutableRefObject<number>;
  /** Mouth drive level (analyser RMS), the same ref ThreeAvatar reads. */
  mouthAudioLevelRef: MutableRefObject<number>;
  isSpeaking: boolean;
  isListening: boolean;
  isThinking: boolean;
  /** Called at most once, when the avatar cannot run. The seam then falls back. */
  onFailure: (failure: Hyper3dHostFailure) => void;
}

export function Hyper3DImperativeHost({
  avatarAudioCurrentTimeRef,
  mouthAudioLevelRef,
  isSpeaking,
  isListening,
  isThinking,
  onFailure,
}: Hyper3DImperativeHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HostInstance | null>(null);

  // Conversation state arrives as props but is consumed inside the animation
  // loop, so it is mirrored into refs. Reading props there would capture a
  // stale closure; re-mounting the host on every change would reload the GLB.
  const conversationRef = useRef({ isSpeaking, isListening, isThinking });
  conversationRef.current.isSpeaking = isSpeaking;
  conversationRef.current.isListening = isListening;
  conversationRef.current.isThinking = isThinking;

  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Phase 2G.1C: the earliest stamp in the startup timeline — everything the
    // avatar does begins here. One assignment; it cannot affect the mount.
    recordHyper3dAssetTimeline({
      hostMountedAtMs: Math.round(performance.now()),
    });

    const registeredPlaybackClock = getHyper3dPlaybackClock();
    const host = createHyper3dImperativeHost({
      container,
      // Hyper3D uses the adapter's continuous response clock. The ref remains
      // the legacy ThreeAvatar's chunk-local clock and is fallback-only here.
      getPlaybackTime:
        registeredPlaybackClock ?? (() => avatarAudioCurrentTimeRef.current),
      getAudioLevel: () => mouthAudioLevelRef.current,
      getConversationState: () => conversationRef.current,
      onFailure: (failure) => onFailureRef.current(failure),
    });
    hostRef.current = host;

    return () => {
      hostRef.current = null;
      host.dispose();
    };
    // Mount once per avatar session. The refs above are stable by construction,
    // and nothing in this list may change without a full reload of the avatar.
  }, [avatarAudioCurrentTimeRef, mouthAudioLevelRef]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" aria-hidden />
      {/*
        DEV review panels only. `Hyper3DDevPanels` is `null` in a production
        build, so this subtree does not exist there — see the note above.
      */}
      {Hyper3DDevPanels ? (
        <Suspense fallback={null}>
          <Hyper3DDevPanels />
        </Suspense>
      ) : null}
    </>
  );
}

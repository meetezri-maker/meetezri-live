import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Isolated failure boundary for the avatar, and ONLY the avatar.
 *
 * Scope is the point. It wraps the avatar subtree and nothing else, so a fault
 * in avatar rendering can never unmount the session stage, the transcript, the
 * control dock or the rails — and can never reach the audio pipeline, which
 * lives outside React's render tree entirely.
 *
 * This is the backstop for RENDER-PHASE faults: a throw during render, in a
 * lifecycle method, or in a child's constructor. It does not and cannot catch
 * async failures, rejected promises or throws inside `requestAnimationFrame` —
 * React never sees those. Those are caught inside
 * `createHyper3dImperativeHost`, which reports them through the same
 * `onFailure` channel. Together the two cover the failure list.
 *
 * `renderFallback` is invoked instead of the failed subtree, so the existing
 * Solace avatar keeps rendering. There is NO retry and no remount: the boundary
 * latches. That is what guarantees no reload loop, no session reset and no
 * interruption to audio.
 */
interface AvatarFailureBoundaryProps {
  children: ReactNode;
  /** Rendered in place of `children` once a render-phase fault has occurred. */
  renderFallback: () => ReactNode;
  /** Called once, on the first fault. Used to record the reason and swap runtime. */
  onFailure: (reason: string, error: Error, info: ErrorInfo) => void;
}

interface AvatarFailureBoundaryState {
  failed: boolean;
}

export class AvatarFailureBoundary extends Component<
  AvatarFailureBoundaryProps,
  AvatarFailureBoundaryState
> {
  state: AvatarFailureBoundaryState = { failed: false };

  static getDerivedStateFromError(): AvatarFailureBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged, not rethrown. The session continues.
    console.error("[Avatar] render fault — falling back to the existing avatar:", error);
    try {
      this.props.onFailure(error.message || "Avatar render fault", error, info);
    } catch (handlerError) {
      console.error("[Avatar] failure handler threw:", handlerError);
    }
  }

  render() {
    if (this.state.failed) return this.props.renderFallback();
    return this.props.children;
  }
}

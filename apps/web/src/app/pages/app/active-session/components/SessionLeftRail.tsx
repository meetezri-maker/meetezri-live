import { memo } from "react";
import type { RefObject } from "react";
import { glassPanel } from "../constants";

export interface SessionLeftRailProps {
  stageSidePanelInsetL: string;
  stageRailWidthLeftClass: string;
  leftSessionChromeRef: RefObject<HTMLDivElement>;
  sessionGreeting: string;
  viewerFirstName: string;
}

function SessionLeftRailComponent({
  stageSidePanelInsetL,
  stageRailWidthLeftClass,
  leftSessionChromeRef,
  sessionGreeting,
  viewerFirstName,
}: SessionLeftRailProps) {
  return (
    <aside
      aria-label="Talking greeting"
      className={`pointer-events-none absolute ${stageSidePanelInsetL} z-30 flex max-h-[min(100dvh-5rem,100%)] ${stageRailWidthLeftClass} flex-col gap-0 overflow-x-hidden overflow-y-auto overscroll-contain pb-2`}
    >
      <div
        ref={leftSessionChromeRef}
        className={`pointer-events-auto ${glassPanel} hidden md:block flex min-h-0 max-h-[min(100dvh-8rem,42rem)] shrink-0 flex-col space-y-3 overflow-hidden p-4 sm:p-5`}
      >
        <div className="shrink-0">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl md:text-2xl">
            {sessionGreeting}, {viewerFirstName}!
          </h2>
          <p className="mt-2 border-l-2 border-sky-400/45 pl-3 text-xs leading-relaxed text-white/80 md:text-sm">
            This time is for you—take it at your own pace, and share only what
            feels right in this moment.
          </p>
        </div>
      </div>
    </aside>
  );
}

export const SessionLeftRail = memo(SessionLeftRailComponent);

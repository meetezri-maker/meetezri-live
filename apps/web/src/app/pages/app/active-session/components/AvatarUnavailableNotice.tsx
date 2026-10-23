import { memo } from "react";
import { RefreshCw } from "lucide-react";

import { StaticSessionPortrait } from "./StaticSessionPortrait";

export interface AvatarUnavailableNoticeProps {
  portraitUrl: string;
  isSpeaking: boolean;
  /**
   * Omitted when retrying cannot work — which is the case while the Hyper3D
   * flag is off, because nothing about pressing a button changes a build-time
   * constant. Offering a control that cannot succeed is worse than offering
   * none; the portrait alone is then the whole state.
   */
  onRetry?: () => void;
}

/**
 * WHAT A COMPANION WITH NO LEGACY MODEL SHOWS WHEN NO 3D AVATAR CAN RUN —
 * Romy, and since 2026-10-23 Frankie (`COMPANIONS_WITHOUT_LEGACY_MODEL`).
 * Romy is the worked example below; Frankie's chain is the same shape.
 *
 * Two different situations reach this, and they are deliberately the same
 * picture:
 *
 *   flag disabled   Hyper3D is switched off for this build, so there is no
 *                   runtime to load her models with. No retry is offered.
 *   both failed     her primary asset AND her backup snapshot each failed one
 *                   attempt. A manual retry is offered, and only a manual one.
 *
 * The retired `sara-v3.glb` is never shown here. It is a different character's
 * geometry with a different morph vocabulary, and showing it would put the
 * wrong face under Romy's name — the exact failure the whole asset-identity
 * design exists to prevent.
 *
 * The session is untouched by this state: the conversation, the WebSocket, the
 * audio scheduler, the transcript, the voice and the persona all continue. Only
 * the picture changes, so the portrait keeps the speaking pulse the 2D
 * companions already use.
 */
function AvatarUnavailableNoticeComponent({
  portraitUrl,
  isSpeaking,
  onRetry,
}: AvatarUnavailableNoticeProps) {
  return (
    <div className="absolute inset-0">
      <StaticSessionPortrait imageUrl={portraitUrl} isSpeaking={isSpeaking} />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] flex flex-col items-center gap-2 px-4 pb-4"
        role="status"
      >
        <p className="rounded-full border border-white/12 bg-black/45 px-3 py-1 text-center text-xs text-white/75 backdrop-blur-sm">
          3D avatar unavailable — showing a portrait instead.
        </p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 transition hover:bg-white/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const AvatarUnavailableNotice = memo(AvatarUnavailableNoticeComponent);

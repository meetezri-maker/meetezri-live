import { memo } from "react";

export interface StaticSessionPortraitProps {
  imageUrl: string;
  isSpeaking: boolean;
}

/** 2D-only session view: PNG portrait, no GLB — e.g. Alex, Jordan, Maya. */
function StaticSessionPortraitComponent({
  imageUrl,
  isSpeaking,
}: StaticSessionPortraitProps) {
  return (
    <div className="relative w-full h-full min-h-[500px] flex items-center justify-center px-4">
      <img
        src={imageUrl}
        alt=""
        className={`max-h-[min(100%,720px)] w-auto max-w-full object-contain drop-shadow-2xl transition-transform duration-300 ${
          isSpeaking ? "scale-[1.02]" : "scale-100"
        }`}
      />
    </div>
  );
}

export const StaticSessionPortrait = memo(StaticSessionPortraitComponent);

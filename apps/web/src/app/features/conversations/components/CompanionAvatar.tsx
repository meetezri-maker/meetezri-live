import { companionRoundPortraitImgClass } from "@/lib/avatar/companionModelUrl";
import { cn } from "@/lib/utils";
import type { ConversationCompanion } from "../types";

interface CompanionAvatarProps {
  companion: ConversationCompanion;
  /** Tailwind size classes, e.g. "h-11 w-11". */
  sizeClassName?: string;
  className?: string;
}

/** Circular companion portrait from the existing `public/avatars/` assets, initial as fallback. */
export function CompanionAvatar({ companion, sizeClassName = "h-11 w-11", className }: CompanionAvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-white/15 bg-gradient-to-br from-violet-500/40 to-fuchsia-500/25",
        "shadow-[0_0_18px_-4px_rgba(168,85,247,0.55)]",
        sizeClassName,
        className
      )}
    >
      {companion.portraitUrl ? (
        <img
          src={companion.portraitUrl}
          alt=""
          className={cn("h-full w-full", companionRoundPortraitImgClass)}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-sm font-semibold text-white" aria-hidden>
          {(companion.displayName[0] || "?").toUpperCase()}
        </span>
      )}
    </span>
  );
}

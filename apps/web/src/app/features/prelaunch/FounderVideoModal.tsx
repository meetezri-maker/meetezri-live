import { useEffect, useRef } from "react";
import { Play, Video } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FOUNDER } from "./prelaunch.content";
import {
  FOUNDER_VIDEO_CAPTIONS_SRC,
  FOUNDER_VIDEO_POSTER,
  FOUNDER_VIDEO_SRC,
} from "./prelaunch.imagery";

/**
 * Founder story video.
 *
 * Never autoplays on the page and the media element is only mounted once the
 * modal opens, so nothing downloads until the visitor asks for it. Closing the
 * modal unmounts (and therefore pauses) the video; Radix restores focus to the
 * button that opened it.
 */
export function FounderVideoModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /** The control that had focus when the dialog opened. */
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    videoRef.current?.pause();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        /*
         * Sizing note: the shared dialog primitive ships `sm:max-w-lg`, which is
         * inside a media query and therefore beat the previous `max-w-3xl` on
         * every screen at or above 640px — the modal actually rendered at 512px,
         * not 768px. The `sm:` override below is what makes the desktop width
         * take effect at all.
         */
        className={cn(
          "solace-landing overflow-y-auto border-white/10 bg-[#080b1a]/95 backdrop-blur-2xl",
          "w-[90vw] max-w-[1200px] sm:max-w-[1200px] max-h-[90vh]",
        )}
        /*
         * The shared dialog primitive does not reliably restore focus on close,
         * which strands keyboard users at the top of the document (WCAG 2.4.3).
         * Video behaviour is unchanged; only focus handling is corrected.
         */
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="landing-serif text-xl text-white sm:text-2xl">
            {FOUNDER.videoTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--solace-ds-text-muted)]">
            {FOUNDER.name} — {FOUNDER.role} · {FOUNDER.videoLength}
          </DialogDescription>
        </DialogHeader>

        {/*
          The frame's width is additionally capped by the height left over after
          the dialog chrome, so a 16:9 box can never grow taller than the modal.
          Short and ultrawide viewports shrink the width instead of clipping the
          video or forcing a scroll; the ratio is never distorted.
        */}
        <div
          className={cn(
            "mx-auto mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40",
            "max-w-[min(100%,calc((90vh-10rem)*16/9))]",
          )}
        >
          {/* Fixed ratio in both states keeps the modal from jumping. */}
          <div className="relative aspect-video w-full">
            {open && FOUNDER_VIDEO_SRC ? (
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster={FOUNDER_VIDEO_POSTER ?? undefined}
                className="h-full w-full"
              >
                <source src={FOUNDER_VIDEO_SRC} type="video/mp4" />
                {FOUNDER_VIDEO_CAPTIONS_SRC ? (
                  <track
                    kind="captions"
                    src={FOUNDER_VIDEO_CAPTIONS_SRC}
                    srcLang="en"
                    label="English"
                    default
                  />
                ) : null}
              </video>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Video className="h-8 w-8 text-white/30" aria-hidden />
                <p className="text-sm font-semibold text-white/75">
                  Founder video coming soon
                </p>
                <p className="max-w-sm text-xs leading-relaxed text-white/45">
                  The recording is being finalised. We&rsquo;ll share it here soon.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Premium thumbnail that opens the founder video. Keyboard accessible. */
export function FounderVideoThumbnail({
  onOpen,
  className,
}: {
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Play the founder video: ${FOUNDER.videoTitle}`}
      className={cn(
        "landing-glass landing-glow-pink group relative block w-full overflow-hidden text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
        className,
      )}
    >
      <div className="relative aspect-video w-full">
        {FOUNDER_VIDEO_POSTER ? (
          <img
            src={FOUNDER_VIDEO_POSTER}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full bg-[linear-gradient(160deg,rgba(52,24,74,0.95),rgba(8,10,26,0.98))]"
            aria-hidden
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[#E91E63] to-[#9C27B0] shadow-[0_0_36px_-6px_rgba(233,30,99,0.7)] transition-transform duration-300 group-hover:scale-105">
            <Play className="ml-1 h-6 w-6 text-white" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-white">{FOUNDER.videoTitle}</span>
          <span className="text-xs text-white/60">
            {FOUNDER.name} · {FOUNDER.videoLength}
          </span>
        </div>
      </div>
    </button>
  );
}

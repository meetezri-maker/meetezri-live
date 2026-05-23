import { memo } from "react";
import { GripVertical, MicOff, Video, VideoOff } from "lucide-react";
import { motion } from "motion/react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";

export interface UserCameraPipProps {
  open: boolean;
  pipPos: { left: number; bottom: number };
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  isCameraOff: boolean;
  isMuted: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

function UserCameraPipComponent({
  open,
  pipPos,
  videoRef,
  isCameraOff,
  isMuted,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: UserCameraPipProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[45]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 260, damping: 28 }}
        className="pointer-events-auto absolute z-10 w-[15.5rem] max-w-[calc(100%-1rem)] cursor-grab overflow-hidden rounded-2xl border border-white/[0.07] bg-black/[0.08] shadow-lg backdrop-blur-md touch-none select-none active:cursor-grabbing h-[11.5rem] sm:h-48"
        style={{ left: pipPos.left, bottom: pipPos.bottom }}
        aria-label="Your camera preview — drag to move anywhere on screen"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex h-7 items-center gap-1.5 rounded-t-[0.9rem] bg-black/12 px-2"
          aria-hidden
        >
          <GripVertical className="size-3.5 shrink-0 text-white/45" aria-hidden />
          <Video className="size-4 text-white/70" aria-hidden />
        </div>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`pointer-events-none size-full object-cover ${isCameraOff ? "hidden" : "block"}`}
        />
        {isCameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <VideoOff className="mx-auto mb-2 size-10 text-white/40" />
              <p className="text-xs text-white/50">Camera off</p>
            </div>
          </div>
        )}
        {isMuted && !isCameraOff && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-red-500 p-2">
            <MicOff className="size-4 text-white" />
          </div>
        )}
      </motion.div>
    </div>
  );
}

export const UserCameraPip = memo(UserCameraPipComponent);

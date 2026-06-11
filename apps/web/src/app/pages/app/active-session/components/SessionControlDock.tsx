import { memo } from "react";
import {
  Check,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
} from "lucide-react";
import { motion } from "motion/react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  SESSION_BACKDROP_EMOJI_OPTIONS,
  SESSION_MOOD_SWATCH_GRADIENT,
  SESSION_MOOD_TILE_CAPTION,
  type SessionBackdropPreference,
} from "@/lib/sessionBackdropPresets";
import {
  glassControlBtn,
  glassControlBtnDanger,
  glassControlDock,
} from "../constants";

export interface SessionControlDockProps {
  stageBottomBar: string;
  roomMoodPickerOpen: boolean;
  onRoomMoodPickerOpenChange: (open: boolean) => void;
  isSessionPaused: boolean;
  onToggleSessionPaused: () => void;
  selectedRoomMoodLabel: string;
  sessionBackdropPreference: SessionBackdropPreference;
  onSelectSessionBackdrop: (value: SessionBackdropPreference) => void;
  isMuted: boolean;
  onToggleMuted: () => void;
  isCameraOff: boolean;
  onCameraToggle: () => void;
  isSoundOff: boolean;
  onToggleSoundOff: () => void;
  onShowEndConfirm: () => void;
}

function SessionControlDockComponent({
  stageBottomBar,
  roomMoodPickerOpen,
  onRoomMoodPickerOpenChange,
  isSessionPaused,
  onToggleSessionPaused,
  selectedRoomMoodLabel,
  sessionBackdropPreference,
  onSelectSessionBackdrop,
  isMuted,
  onToggleMuted,
  isCameraOff,
  onCameraToggle,
  isSoundOff,
  onToggleSoundOff,
  onShowEndConfirm,
}: SessionControlDockProps) {
  return (
    <Popover open={roomMoodPickerOpen} onOpenChange={onRoomMoodPickerOpenChange}>
      <PopoverAnchor asChild>
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className={`absolute ${stageBottomBar} left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 px-0 py-0 md:gap-3 ${glassControlDock}`}
        >
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onToggleSessionPaused}
            className={`flex size-12 shrink-0 items-center justify-center rounded-full transition-all md:size-14 ${isSessionPaused
              ? "rounded-full border-0 text-white shadow-none ring-0 backdrop-blur-xl [background-color:rgba(255,255,255,0.2)] hover:[background-color:rgba(255,255,255,0.26)]"
              : glassControlBtn
              }`}
            aria-label={isSessionPaused ? "Resume session" : "Pause session"}
          >
            {isSessionPaused ? (
              <Play className="size-6 md:size-7" />
            ) : (
              <Pause className="size-6 md:size-7" />
            )}
          </motion.button>
          <PopoverTrigger asChild>
            <motion.button
              type="button"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className={`flex size-12 shrink-0 items-center justify-center rounded-full md:size-14 ${glassControlBtn}`}
              aria-label={`Room mood: ${selectedRoomMoodLabel}. Open color palette.`}
              aria-expanded={roomMoodPickerOpen}
              aria-haspopup="dialog"
            >
              <span
                className="size-9 shrink-0 rounded-[0.65rem] border border-white/35 shadow-md ring-1 ring-white/15 sm:size-10"
                style={{
                  background:
                    SESSION_MOOD_SWATCH_GRADIENT[sessionBackdropPreference],
                }}
                aria-hidden
              />
            </motion.button>
          </PopoverTrigger>
          <div className="mx-1 hidden h-8 w-px shrink-0 bg-white/12 sm:block" aria-hidden />
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onToggleMuted}
            className={`flex size-12 items-center justify-center rounded-full md:size-14 ${isMuted ? glassControlBtnDanger : glassControlBtn
              }`}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <MicOff className="size-6 md:size-7" />
            ) : (
              <Mic className="size-6 md:size-7" />
            )}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => void onCameraToggle()}
            className={`flex size-12 items-center justify-center rounded-full md:size-14 ${isCameraOff ? glassControlBtnDanger : glassControlBtn
              }`}
            aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
          >
            {isCameraOff ? (
              <VideoOff className="size-6 md:size-7" />
            ) : (
              <Video className="size-6 md:size-7" />
            )}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onToggleSoundOff}
            className={`flex size-12 items-center justify-center rounded-full md:size-14 ${isSoundOff ? glassControlBtnDanger : glassControlBtn
              }`}
            aria-label={isSoundOff ? "Turn sound on" : "Turn sound off"}
          >
            {isSoundOff ? (
              <VolumeX className="size-6 md:size-7" />
            ) : (
              <Volume2 className="size-6 md:size-7" />
            )}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={onShowEndConfirm}
            className={`flex size-12 items-center justify-center rounded-full md:size-14 ${glassControlBtnDanger}`}
            aria-label="End Talking"
          >
            <PhoneOff className="size-6 text-white md:size-7" />
          </motion.button>
        </motion.div>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={10}
        collisionPadding={16}
        className="z-[200] w-[min(calc(100vw-2rem),28rem)] border border-white/12 bg-[#0A0F1E]/96 p-0 text-white shadow-2xl backdrop-blur-2xl"
      >
        <div className="border-b border-white/[0.06] px-2.5 py-2 sm:px-3 sm:py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Room color mood
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/65 sm:text-xs">
            Tap a gradient that fits how you feel — saved on this device.{" "}
            <span className="text-white/45">
              Auto syncs to your latest check-in.
            </span>
          </p>
        </div>
        <div
          className="grid grid-cols-3 gap-1.5 p-2.5 sm:gap-2 sm:p-3"
          role="listbox"
          aria-label="Room mood color options"
        >
          {SESSION_BACKDROP_EMOJI_OPTIONS.map((o) => {
            const selected = sessionBackdropPreference === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={o.label}
                onClick={() => {
                  onSelectSessionBackdrop(o.value);
                  onRoomMoodPickerOpenChange(false);
                }}
                style={{
                  background: SESSION_MOOD_SWATCH_GRADIENT[o.value],
                }}
                className={`group relative h-[3.25rem] min-h-0 overflow-hidden rounded-lg border text-left shadow-md transition-transform hover:scale-[1.02] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ECDC4] active:scale-[0.98] sm:h-[3.55rem] sm:rounded-xl ${selected
                  ? "border-[#4ECDC4] ring-2 ring-[#4ECDC4]/90 ring-offset-2 ring-offset-[#0A0F1E]"
                  : "border-white/15 hover:border-white/35"
                  }`}
              >
                {selected ? (
                  <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm sm:right-1.5 sm:top-1.5 sm:size-6">
                    <Check
                      className="size-3 text-[#4ECDC4] sm:size-3.5"
                      aria-hidden
                    />
                  </span>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/82 via-black/45 to-transparent px-0.5 pb-1.5 pt-5 text-center text-[8px] font-bold uppercase tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:px-1.5 sm:pb-2 sm:pt-6 sm:text-[9px]">
                  {SESSION_MOOD_TILE_CAPTION[o.value]}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const SessionControlDock = memo(SessionControlDockComponent);

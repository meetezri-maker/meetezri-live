import { memo } from "react";
import {
  AlertCircle,
  Camera,
  Check,
  Loader2,
  Mic,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { EzriWsStatus } from "@/lib/ezri/realtimeClient";
import { cn } from "@/lib/utils";
import {
  modalBodyText,
  modalEmphasisText,
  modalInsetPanel,
  modalMutedText,
  modalOverlay,
  modalPanel,
  modalPrimaryButton,
  modalSecondaryButton,
  modalSubtitle,
  modalTitle,
} from "@/lib/modalTheme";

export interface PermissionModalProps {
  open: boolean;
  companionName: string;
  pendingMediaEntry: boolean;
  ezriWarmupStatus: string;
  ezriWsStatus: EzriWsStatus;
  hasBrowserSpeechRecognition: boolean;
  onCancel: () => void;
  onAllowAccess: () => void;
}

const permissionHeroIcon = cn(
  "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full shadow-lg",
  "bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/50",
  "[html[data-ezri-theme=light]_&]:from-[#a78bfa] [html[data-ezri-theme=light]_&]:to-[#f472b6]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_0_28px_rgba(167,139,250,0.35)]",
  "[html[data-theme=light]_&]:from-[#a78bfa] [html[data-theme=light]_&]:to-[#f472b6]",
  "[html[data-theme=light]_&]:shadow-[0_0_28px_rgba(167,139,250,0.35)]"
);

const permissionPrivacyBox = cn(
  "mb-6 rounded-xl border p-4",
  "border-blue-500/30 bg-blue-500/10",
  "[html[data-ezri-theme=light]_&]:border-[#bfdbfe]",
  "[html[data-ezri-theme=light]_&]:bg-[#eef6ff]",
  "[html[data-theme=light]_&]:border-[#bfdbfe]",
  "[html[data-theme=light]_&]:bg-[#eef6ff]"
);

const permissionPrivacyText = cn(
  "text-sm text-blue-200",
  "[html[data-ezri-theme=light]_&]:text-[#1e40af]",
  "[html[data-theme=light]_&]:text-[#1e40af]"
);

const permissionStatusBar = cn(
  "mb-6 rounded-xl border px-4 py-3",
  "border-purple-500/25 bg-purple-500/10",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--surface-lavender,#f5eeff)]"
);

const permissionStatusText = cn(
  "text-sm text-purple-100",
  "[html[data-ezri-theme=light]_&]:text-[#5b21b6]",
  "[html[data-theme=light]_&]:text-[#5b21b6]"
);

const permissionRowIconCamera = cn(
  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
  "bg-purple-500/20",
  "[html[data-ezri-theme=light]_&]:bg-[color-mix(in_srgb,#a78bfa_18%,#ffffff)]",
  "[html[data-theme=light]_&]:bg-[color-mix(in_srgb,#a78bfa_18%,#ffffff)]"
);

const permissionRowIconMic = cn(
  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
  "bg-pink-500/20",
  "[html[data-ezri-theme=light]_&]:bg-[color-mix(in_srgb,#f472b6_14%,#ffffff)]",
  "[html[data-theme=light]_&]:bg-[color-mix(in_srgb,#f472b6_14%,#ffffff)]"
);

const permissionBrowserNote = cn(
  "rounded-lg border px-3 py-2 text-center text-xs",
  "border-blue-500/20 bg-blue-500/10 text-blue-300",
  "[html[data-ezri-theme=light]_&]:border-[#bfdbfe]",
  "[html[data-ezri-theme=light]_&]:bg-[#eef6ff]",
  "[html[data-ezri-theme=light]_&]:text-[#1d4ed8]",
  "[html[data-theme=light]_&]:border-[#bfdbfe]",
  "[html[data-theme=light]_&]:bg-[#eef6ff]",
  "[html[data-theme=light]_&]:text-[#1d4ed8]"
);

function PermissionModalComponent({
  open,
  companionName,
  pendingMediaEntry,
  ezriWarmupStatus,
  ezriWsStatus,
  hasBrowserSpeechRecognition,
  onCancel,
  onAllowAccess,
}: PermissionModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={modalOverlay}
          role="presentation"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={cn(modalPanel, "max-w-lg p-8")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="permission-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className={permissionHeroIcon}
              >
                <Camera className="h-10 w-10 text-white" aria-hidden />
              </motion.div>
              <h3 id="permission-modal-title" className={cn(modalTitle, "mb-2 text-2xl")}>
                Camera & Microphone Access
              </h3>
              <p className={cn(modalSubtitle, "leading-relaxed")}>
                To have a video talking with {companionName}, we need permission to access your
                camera and microphone.
              </p>
            </div>

            <div className={cn(modalInsetPanel, "mb-6")}>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className={permissionRowIconCamera}>
                    <Video
                      className="h-4 w-4 text-purple-400 [html[data-ezri-theme=light]_&]:text-[#7c3aed] [html[data-theme=light]_&]:text-[#7c3aed]"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <p className={modalEmphasisText}>Camera Access</p>
                    <p className={cn(modalMutedText, "text-sm")}>
                      So {companionName} can see you during the conversation
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={permissionRowIconMic}>
                    <Mic
                      className="h-4 w-4 text-pink-400 [html[data-ezri-theme=light]_&]:text-[#db2777] [html[data-theme=light]_&]:text-[#db2777]"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <p className={modalEmphasisText}>Microphone Access</p>
                    <p className={cn(modalMutedText, "text-sm")}>
                      So you can speak naturally with your Solace avatar
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={permissionPrivacyBox}>
              <div className="flex items-start gap-3">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-blue-400 [html[data-ezri-theme=light]_&]:text-[#2563eb] [html[data-theme=light]_&]:text-[#2563eb]"
                  aria-hidden
                />
                <p className={permissionPrivacyText}>
                  <span className="font-semibold">Your privacy matters:</span> Your video is only
                  used during the Talking and is never recorded or stored. You can disable your
                  camera at any time.
                </p>
              </div>
            </div>

            <div className={permissionStatusBar}>
              {pendingMediaEntry && ezriWarmupStatus !== "ready" ? (
                <div className={cn("flex items-center justify-center gap-2", permissionStatusText)}>
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  <span>Almost ready — finishing Talking setup…</span>
                </div>
              ) : ezriWarmupStatus === "ready" ? (
                <div
                  className={cn(
                    "flex items-center justify-center gap-2 text-sm text-emerald-300",
                    "[html[data-ezri-theme=light]_&]:text-[#047857]",
                    "[html[data-theme=light]_&]:text-[#047857]"
                  )}
                >
                  <Check className="size-4 shrink-0" aria-hidden />
                  <span>Session ready — allow access when you&apos;re set</span>
                </div>
              ) : ezriWsStatus === "connecting" || ezriWsStatus === "reconnecting" ? (
                <div className={cn("flex items-center justify-center gap-2", permissionStatusText)}>
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  <span>Connecting to Solace…</span>
                </div>
              ) : ezriWarmupStatus === "warming" || ezriWsStatus === "connected" ? (
                <div className={cn("flex items-center justify-center gap-2", permissionStatusText)}>
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  <span>Preparing your session (warming up AI)…</span>
                </div>
              ) : (
                <p className={cn("text-center text-sm", modalMutedText)}>
                  Session setup will begin automatically.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                className={cn(modalSecondaryButton, "flex flex-1 items-center justify-center gap-2 py-4")}
              >
                <X className="h-5 w-5" aria-hidden />
                Cancel
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: pendingMediaEntry ? 1 : 1.02 }}
                whileTap={{ scale: pendingMediaEntry ? 1 : 0.98 }}
                onClick={onAllowAccess}
                disabled={pendingMediaEntry}
                className={cn(
                  modalPrimaryButton,
                  "flex flex-1 items-center justify-center gap-2 py-4 disabled:cursor-wait disabled:opacity-80"
                )}
              >
                {pendingMediaEntry ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    Setting up…
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" aria-hidden />
                    Allow Access
                  </>
                )}
              </motion.button>
            </div>

            {!hasBrowserSpeechRecognition && (
              <p className={cn(permissionBrowserNote, "mt-3")}>
                Using server voice recognition for this browser.
              </p>
            )}

            <p className={cn(modalBodyText, "mt-2 text-center text-xs")}>
              Your browser may show an additional permission prompt after clicking &quot;Allow
              Access&quot;
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const PermissionModal = memo(PermissionModalComponent);

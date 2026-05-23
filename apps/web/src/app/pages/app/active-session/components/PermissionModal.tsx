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
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-purple-500/30 shadow-2xl"
          >
            <div className="text-center mb-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/50"
              >
                <Camera className="w-10 h-10 text-white" />
              </motion.div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Camera & Microphone Access
              </h3>
              <p className="text-gray-300 leading-relaxed">
                To have a video session with {companionName}, we need
                permission to access your camera and microphone.
              </p>
            </div>

            <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-5 mb-6 border border-white/10">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Video className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Camera Access</p>
                    <p className="text-sm text-gray-400">
                      So {companionName} can see you during the
                      conversation
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mic className="w-4 h-4 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Microphone Access</p>
                    <p className="text-sm text-gray-400">
                      So you can speak naturally with your Solace avatar
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 backdrop-blur-xl rounded-xl p-4 mb-6 border border-blue-500/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-200">
                  <span className="font-semibold">Your privacy matters:</span>{" "}
                  Your video is only used during the Talking and is never
                  recorded or stored. You can disable your camera at any time.
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-xl border border-purple-500/25 bg-purple-500/10 px-4 py-3">
              {pendingMediaEntry && ezriWarmupStatus !== "ready" ? (
                <div className="flex items-center justify-center gap-2 text-sm text-purple-100">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  <span>Almost ready — finishing Talking setup…</span>
                </div>
              ) : ezriWarmupStatus === "ready" ? (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-300">
                  <Check className="size-4 shrink-0" aria-hidden />
                  <span>Session ready — allow access when you&apos;re set</span>
                </div>
              ) : ezriWsStatus === "connecting" || ezriWsStatus === "reconnecting" ? (
                <div className="flex items-center justify-center gap-2 text-sm text-purple-100">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  <span>Connecting to Solace…</span>
                </div>
              ) : ezriWarmupStatus === "warming" || ezriWsStatus === "connected" ? (
                <div className="flex items-center justify-center gap-2 text-sm text-purple-100">
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  <span>Preparing your session (warming up AI)…</span>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400">
                  Session setup will begin automatically.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCancel}
                className="flex-1 px-6 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center justify-center gap-2 border border-white/10"
              >
                <X className="w-5 h-5" />
                Cancel
              </motion.button>

              <motion.button
                whileHover={{ scale: pendingMediaEntry ? 1 : 1.02 }}
                whileTap={{ scale: pendingMediaEntry ? 1 : 0.98 }}
                onClick={onAllowAccess}
                disabled={pendingMediaEntry}
                className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/50 disabled:cursor-wait disabled:opacity-80"
              >
                {pendingMediaEntry ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
                    Setting up…
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Allow Access
                  </>
                )}
              </motion.button>
            </div>

            {!hasBrowserSpeechRecognition && (
              <p className="text-xs text-blue-300 text-center mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                Using server voice recognition for this browser.
              </p>
            )}

            <p className="text-xs text-gray-400 text-center mt-2">
              Your browser may show an additional permission prompt after
              clicking "Allow Access"
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const PermissionModal = memo(PermissionModalComponent);

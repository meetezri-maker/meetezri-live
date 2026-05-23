import { memo } from "react";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Crown,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { formatSessionTime } from "../utils/sessionFormat";

export interface OutOfCreditsModalProps {
  open: boolean;
  sessionTime: number;
  onBuyMoreMinutes: () => void;
  onUpgradePlan: () => void;
  onReturnToDashboard: () => void;
}

function OutOfCreditsModalComponent({
  open,
  sessionTime,
  onBuyMoreMinutes,
  onUpgradePlan,
  onReturnToDashboard,
}: OutOfCreditsModalProps) {
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
            className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-red-500/30 shadow-2xl"
          >
            <div className="text-center mb-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <Clock className="w-10 h-10 text-white" />
              </motion.div>
              <h3 className="text-3xl font-bold text-white mb-2">
                Talking Paused
              </h3>
              <p className="text-gray-300 text-lg">
                You've used all your included minutes for this month.
              </p>
            </div>

            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/10">
              <div className="text-center mb-4">
                <p className="text-gray-300 mb-2">Your Talk time:</p>
                <p className="text-4xl font-bold text-white font-mono">
                  {formatSessionTime(sessionTime)}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  0 minutes remaining
                </span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="text-white font-semibold text-center mb-3">
                Continue Your Wellness Journey:
              </h4>
              <button
                onClick={onBuyMoreMinutes}
                className="w-full p-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl text-white font-semibold flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Buy More Minutes</p>
                    <p className="text-xs text-green-100">
                      Pay-as-you-go available
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onUpgradePlan}
                className="w-full p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-white font-semibold flex items-center justify-between group transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold">Upgrade Your Plan</p>
                    <p className="text-xs text-purple-100">
                      Get more minutes & better rates
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <button
              onClick={onReturnToDashboard}
              className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
            >
              End Talking & Return to Dashboard
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const OutOfCreditsModal = memo(OutOfCreditsModalComponent);

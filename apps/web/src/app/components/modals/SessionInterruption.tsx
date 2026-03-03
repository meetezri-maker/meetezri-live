import { motion, AnimatePresence } from "motion/react";
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Shield,
  Home,
  PlayCircle
} from "lucide-react";
import { useState, useEffect } from "react";

interface SessionInterruptionProps {
  isInterrupted: boolean;
  onReconnect: () => void;
  onEndSession: () => void;
  sessionTime: number;
  transcriptSaved: boolean;
  reconnectAttempts?: number;
  maxReconnectAttempts?: number;
}

export function SessionInterruption({
  isInterrupted,
  onReconnect,
  onEndSession,
  sessionTime,
  transcriptSaved,
  reconnectAttempts = 0,
  maxReconnectAttempts = 5
}: SessionInterruptionProps) {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isReconnecting && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isReconnecting && countdown === 0) {
      setIsReconnecting(false);
      onReconnect();
    }
  }, [isReconnecting, countdown, onReconnect]);

  const handleReconnect = () => {
    setIsReconnecting(true);
    setCountdown(3);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isInterrupted && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-red-500/30 rounded-3xl shadow-2xl max-w-xl w-full pointer-events-auto overflow-hidden relative"
            >
              {/* Animated Border Glow */}
              <motion.div
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-xl"
              />

              {/* Content */}
              <div className="relative z-10 p-8">
                {/* Icon & Status */}
                <div className="text-center mb-6">
                  <motion.div
                    animate={
                      isReconnecting
                        ? { rotate: 360 }
                        : {
                            scale: [1, 1.1, 1],
                            opacity: [0.7, 1, 0.7],
                          }
                    }
                    transition={
                      isReconnecting
                        ? { duration: 1, repeat: Infinity, ease: "linear" }
                        : { duration: 2, repeat: Infinity }
                    }
                    className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center shadow-2xl"
                  >
                    {isReconnecting ? (
                      <RefreshCw className="w-12 h-12 text-white" />
                    ) : (
                      <WifiOff className="w-12 h-12 text-white" />
                    )}
                  </motion.div>

                  <h2 className="text-3xl font-bold text-white mb-2">
                    {isReconnecting ? "Reconnecting..." : "Connection Lost"}
                  </h2>
                  <p className="text-gray-400">
                    {isReconnecting
                      ? `Attempting to reconnect (${countdown}s)`
                      : "Your session has been interrupted"}
                  </p>
                </div>

                {/* Session Info */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/10">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-400" />
                    Your Session is Protected
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Session Time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-sm">Session Duration</span>
                      </div>
                      <span className="text-white font-bold font-mono">{formatTime(sessionTime)}</span>
                    </div>

                    {/* Transcript Saved */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Save className="w-4 h-4 text-purple-400" />
                        <span className="text-sm">Transcript Saved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {transcriptSaved ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                            <span className="text-green-400 text-sm font-medium">Auto-saved</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5 text-yellow-400" />
                            <span className="text-yellow-400 text-sm font-medium">Saving...</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Reconnect Attempts */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-300">
                        <RefreshCw className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm">Reconnect Attempts</span>
                      </div>
                      <span className="text-white font-medium">
                        {reconnectAttempts}/{maxReconnectAttempts}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Message */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                  <p className="text-blue-200 text-sm leading-relaxed">
                    <strong className="text-blue-100">Don't worry!</strong> Your conversation history 
                    and progress have been automatically saved. You can safely reconnect or end your 
                    session without losing any data.
                  </p>
                </div>

                {/* Reconnect Progress */}
                {reconnectAttempts > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                      <span>Reconnection Progress</span>
                      <span>{Math.round((reconnectAttempts / maxReconnectAttempts) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(reconnectAttempts / maxReconnectAttempts) * 100}%` }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onEndSession}
                    disabled={isReconnecting}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Home className="w-5 h-5" />
                    End Session
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: isReconnecting ? 1 : 1.02, y: isReconnecting ? 0 : -2 }}
                    whileTap={{ scale: isReconnecting ? 1 : 0.98 }}
                    onClick={handleReconnect}
                    disabled={isReconnecting || reconnectAttempts >= maxReconnectAttempts}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-xl text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                  >
                    {isReconnecting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <RefreshCw className="w-5 h-5" />
                        </motion.div>
                        Reconnecting...
                      </>
                    ) : (
                      <>
                        <Wifi className="w-5 h-5" />
                        Reconnect
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Max Attempts Warning */}
                {reconnectAttempts >= maxReconnectAttempts && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3"
                  >
                    <p className="text-red-200 text-sm text-center">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      Maximum reconnection attempts reached. Please end session and try again later.
                    </p>
                  </motion.div>
                )}

                {/* Help Text */}
                <p className="text-center text-gray-500 text-xs mt-6">
                  If you continue to experience issues, please check your internet connection
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

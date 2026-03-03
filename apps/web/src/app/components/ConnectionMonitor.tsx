import { motion, AnimatePresence } from "motion/react";
import { Wifi, WifiOff, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { useState, useEffect } from "react";

interface ConnectionMonitorProps {
  onConnectionLost?: () => void;
  onConnectionRestored?: () => void;
}

type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "disconnected";

export function ConnectionMonitor({ onConnectionLost, onConnectionRestored }: ConnectionMonitorProps) {
  const [latency, setLatency] = useState(45);
  const [quality, setQuality] = useState<ConnectionQuality>("excellent");
  const [isRecovering, setIsRecovering] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  // Simulate latency fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate realistic network latency with occasional spikes
      const baseLatency = 30 + Math.random() * 40; // 30-70ms base
      const spike = Math.random() > 0.9 ? Math.random() * 200 : 0; // Occasional spikes
      const newLatency = Math.round(baseLatency + spike);
      
      setLatency(newLatency);

      // Determine connection quality based on latency
      if (newLatency < 50) {
        setQuality("excellent");
        setShowWarning(false);
      } else if (newLatency < 100) {
        setQuality("good");
        setShowWarning(false);
      } else if (newLatency < 200) {
        setQuality("fair");
        setShowWarning(true);
      } else if (newLatency < 500) {
        setQuality("poor");
        setShowWarning(true);
        // Attempt auto-recovery
        if (!isRecovering) {
          handleAutoRecover();
        }
      } else {
        setQuality("disconnected");
        setShowWarning(true);
        if (onConnectionLost) {
          onConnectionLost();
        }
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [isRecovering]);

  const handleAutoRecover = async () => {
    setIsRecovering(true);
    setRecoveryAttempts(prev => prev + 1);

    // Simulate recovery process
    setTimeout(() => {
      // Simulate successful recovery
      setLatency(Math.round(30 + Math.random() * 30)); // Back to good latency
      setQuality("good");
      setIsRecovering(false);
      setShowWarning(false);
      
      if (onConnectionRestored) {
        onConnectionRestored();
      }
    }, 3000);
  };

  const getQualityConfig = () => {
    switch (quality) {
      case "excellent":
        return {
          color: "from-green-500 to-emerald-500",
          bgColor: "bg-green-500/20",
          borderColor: "border-green-500/30",
          textColor: "text-green-400",
          label: "Excellent",
          icon: CheckCircle2,
        };
      case "good":
        return {
          color: "from-blue-500 to-cyan-500",
          bgColor: "bg-blue-500/20",
          borderColor: "border-blue-500/30",
          textColor: "text-blue-400",
          label: "Good",
          icon: Wifi,
        };
      case "fair":
        return {
          color: "from-yellow-500 to-orange-500",
          bgColor: "bg-yellow-500/20",
          borderColor: "border-yellow-500/30",
          textColor: "text-yellow-400",
          label: "Fair",
          icon: AlertTriangle,
        };
      case "poor":
        return {
          color: "from-orange-500 to-red-500",
          bgColor: "bg-orange-500/20",
          borderColor: "border-orange-500/30",
          textColor: "text-orange-400",
          label: "Poor",
          icon: AlertTriangle,
        };
      case "disconnected":
        return {
          color: "from-red-500 to-red-700",
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/30",
          textColor: "text-red-400",
          label: "Disconnected",
          icon: WifiOff,
        };
    }
  };

  const config = getQualityConfig();
  const Icon = config.icon;

  return (
    <>
      {/* Compact Connection Indicator */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed top-20 right-6 z-30"
      >
        <motion.div
          whileHover={{ scale: 1.05 }}
          className={`${config.bgColor} backdrop-blur-xl border ${config.borderColor} rounded-xl px-4 py-2 shadow-lg cursor-pointer`}
        >
          <div className="flex items-center gap-3">
            {/* Animated Icon */}
            <motion.div
              animate={
                isRecovering
                  ? { rotate: 360 }
                  : quality === "poor" || quality === "fair"
                  ? { scale: [1, 1.2, 1] }
                  : {}
              }
              transition={
                isRecovering
                  ? { duration: 1, repeat: Infinity, ease: "linear" }
                  : { duration: 1.5, repeat: Infinity }
              }
            >
              <Icon className={`w-5 h-5 ${config.textColor}`} />
            </motion.div>

            {/* Status */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${config.textColor}`}>
                  {isRecovering ? "Recovering..." : config.label}
                </span>
                {recoveryAttempts > 0 && (
                  <span className="text-xs text-gray-400">
                    ({recoveryAttempts} recovered)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-300 font-mono">{latency}ms</span>
              </div>
            </div>

            {/* Signal Strength Bars */}
            <div className="flex items-end gap-0.5 h-5">
              {[1, 2, 3, 4].map((bar) => (
                <motion.div
                  key={bar}
                  animate={{
                    opacity: latency < bar * 100 ? 1 : 0.2,
                  }}
                  className={`w-1 rounded-full ${config.bgColor.replace('/20', '')}`}
                  style={{
                    height: `${bar * 25}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Connection Warning Toast */}
      <AnimatePresence>
        {showWarning && !isRecovering && quality !== "disconnected" && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 50 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 50 }}
            className="fixed top-36 right-6 z-30"
          >
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 backdrop-blur-xl border border-yellow-500/30 rounded-xl p-4 shadow-xl max-w-xs">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-yellow-200 mb-1">
                    Connection Quality Low
                  </h4>
                  <p className="text-xs text-yellow-100/80 leading-relaxed">
                    Your connection is unstable. Auto-recovery is active. Your session data is protected.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Recovery Notification */}
      <AnimatePresence>
        {isRecovering && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-36 right-6 z-30"
          >
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-4 shadow-xl max-w-xs">
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Activity className="w-5 h-5 text-cyan-400 mt-0.5" />
                </motion.div>
                <div>
                  <h4 className="text-sm font-semibold text-cyan-200 mb-1">
                    Auto-Recovery Active
                  </h4>
                  <p className="text-xs text-cyan-100/80 leading-relaxed">
                    Optimizing connection... Your session continues uninterrupted.
                  </p>
                  {/* Progress dots */}
                  <div className="flex gap-1 mt-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.3, 1, 0.3],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                        className="w-1.5 h-1.5 bg-cyan-400 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Recovery Toast */}
      <AnimatePresence>
        {!isRecovering && recoveryAttempts > 0 && quality === "good" && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="fixed bottom-24 right-6 z-30"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-500/30 rounded-xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <h4 className="text-sm font-semibold text-green-200">
                    Connection Restored
                  </h4>
                  <p className="text-xs text-green-100/80">
                    Session quality is back to normal
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

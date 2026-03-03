import { motion, AnimatePresence } from "motion/react";
import { X, Volume2, VolumeX, Sparkles, Heart, CheckCircle2, Star, MessageCircle, Mic } from "lucide-react";
import { useState, useEffect } from "react";

interface EzriGuidedModeProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseTitle: string;
  exerciseDescription: string;
  exerciseColor: string;
  exerciseIcon: React.ComponentType<{ className?: string }>;
  duration: string;
}

export function EzriGuidedMode({
  isOpen,
  onClose,
  exerciseTitle,
  exerciseDescription,
  exerciseColor,
  exerciseIcon: Icon,
  duration
}: EzriGuidedModeProps) {
  const [stage, setStage] = useState<"intro" | "active" | "complete">("intro");
  const [timer, setTimer] = useState(0);
  const [isEzriSpeaking, setIsEzriSpeaking] = useState(false);
  const [currentGuidance, setCurrentGuidance] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const guidanceMessages = [
    "Welcome! I'm here to guide you through this exercise. Let's begin by finding a comfortable position.",
    "Take a moment to settle in. Close your eyes if you'd like, or keep a soft gaze downward.",
    "Now, let's focus on your breath. Notice the natural rhythm of your breathing.",
    "Breathe in slowly through your nose... and out through your mouth.",
    "You're doing beautifully. Stay present with each breath.",
    "If your mind wanders, that's perfectly okay. Gently bring your attention back.",
    "Feel the tension leaving your body with each exhale.",
    "You're making wonderful progress. Just a little more time.",
    "Take three more deep, intentional breaths with me.",
    "Excellent work! When you're ready, slowly open your eyes."
  ];

  const durationMinutes = parseInt(duration.replace(" min", "")) || 5;
  const totalSeconds = durationMinutes * 60;

  useEffect(() => {
    if (stage === "active") {
      const interval = setInterval(() => {
        setTimer(prev => {
          const newTime = prev + 1;
          setProgress((newTime / totalSeconds) * 100);
          
          // Trigger guidance messages at intervals
          const messageInterval = totalSeconds / guidanceMessages.length;
          const messageIndex = Math.floor(newTime / messageInterval);
          
          if (newTime % messageInterval === 0 && messageIndex < guidanceMessages.length) {
            setIsEzriSpeaking(true);
            setCurrentGuidance(guidanceMessages[messageIndex]);
            
            setTimeout(() => {
              setIsEzriSpeaking(false);
            }, 4000);
          }
          
          // Complete exercise
          if (newTime >= totalSeconds) {
            setStage("complete");
            return newTime;
          }
          
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [stage, totalSeconds]);

  const handleStart = () => {
    setStage("active");
    setIsEzriSpeaking(true);
    setCurrentGuidance(guidanceMessages[0]);
    setTimeout(() => setIsEzriSpeaking(false), 4000);
  };

  const handleComplete = () => {
    setStage("intro");
    setTimer(0);
    setProgress(0);
    setCurrentGuidance("");
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`bg-gradient-to-br ${exerciseColor} rounded-3xl shadow-2xl max-w-2xl w-full pointer-events-auto overflow-hidden relative`}
            >
              {/* Animated Background Blobs */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 5, repeat: Infinity }}
                className="absolute -top-40 -right-40 w-96 h-96 bg-white/20 rounded-full blur-3xl"
              />
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 6, repeat: Infinity }}
                className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/20 rounded-full blur-3xl"
              />

              {/* Content */}
              <div className="relative z-10 p-8 text-white">
                {/* Close Button */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="absolute top-6 right-6 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="w-5 h-5" />
                </motion.button>

                {/* Intro Stage */}
                {stage === "intro" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center"
                  >
                    {/* Ezri Avatar */}
                    <motion.div
                      animate={{ 
                        scale: [1, 1.05, 1],
                        rotate: [0, -2, 2, 0]
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-32 h-32 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-2xl relative"
                    >
                      <Icon className="w-16 h-16" />
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <Sparkles className="w-5 h-5 text-white" />
                      </motion.div>
                    </motion.div>

                    <h2 className="text-3xl font-bold mb-4">Guided by Ezri</h2>
                    <h3 className="text-2xl font-bold mb-3 opacity-90">{exerciseTitle}</h3>
                    <p className="text-lg text-white/80 mb-6 max-w-md mx-auto">
                      {exerciseDescription}
                    </p>

                    {/* Duration & Benefits */}
                    <div className="grid grid-cols-2 gap-4 mb-8 max-w-md mx-auto">
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-1">Duration</p>
                        <p className="text-2xl font-bold">{duration}</p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-1">Type</p>
                        <p className="text-2xl font-bold">Guided</p>
                      </div>
                    </div>

                    {/* What to Expect */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 text-left max-w-md mx-auto">
                      <h4 className="font-bold mb-3 flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        What to Expect
                      </h4>
                      <ul className="space-y-2 text-sm text-white/90">
                        <li className="flex items-start gap-2">
                          <span className="text-white/50">•</span>
                          <span>I'll guide you through each step with my voice</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-white/50">•</span>
                          <span>Gentle prompts to help you stay present</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-white/50">•</span>
                          <span>Real-time support and encouragement</span>
                        </li>
                      </ul>
                    </div>

                    {/* Start Button */}
                    <motion.button
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleStart}
                      className="px-8 py-4 bg-white text-gray-900 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-3 mx-auto"
                    >
                      <Sparkles className="w-5 h-5" />
                      Begin Guided Session
                    </motion.button>
                  </motion.div>
                )}

                {/* Active Stage */}
                {stage === "active" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center"
                  >
                    {/* Ezri Avatar with Speaking Animation */}
                    <motion.div
                      animate={{ 
                        scale: isEzriSpeaking ? [1, 1.1, 1] : 1,
                      }}
                      transition={{ duration: 1, repeat: isEzriSpeaking ? Infinity : 0 }}
                      className="w-40 h-40 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm shadow-2xl relative"
                    >
                      <Icon className="w-20 h-20" />
                      {isEzriSpeaking && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [0.8, 1.2, 0.8] }}
                          transition={{ duration: 0.8, repeat: Infinity }}
                          className="absolute inset-0 border-4 border-white/50 rounded-full"
                        />
                      )}
                      <motion.div
                        animate={{ 
                          scale: isEzriSpeaking ? [1, 1.2, 1] : 1,
                        }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <Mic className={`w-6 h-6 text-white ${isEzriSpeaking ? 'animate-pulse' : ''}`} />
                      </motion.div>
                    </motion.div>

                    {/* Current Guidance */}
                    <AnimatePresence mode="wait">
                      {currentGuidance && (
                        <motion.div
                          key={currentGuidance}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mb-8"
                        >
                          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-xl mx-auto">
                            <p className="text-lg text-white/90 leading-relaxed">
                              "{currentGuidance}"
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Timer */}
                    <div className="mb-8">
                      <div className="text-5xl font-bold mb-2">{formatTime(timer)}</div>
                      <p className="text-white/70">Stay present and focused</p>
                    </div>

                    {/* Progress Bar */}
                    <div className="max-w-md mx-auto mb-8">
                      <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: `${progress}%` }}
                          className="h-full bg-white rounded-full"
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <p className="text-sm text-white/60 mt-2">{Math.round(progress)}% Complete</p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                      >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setStage("complete")}
                        className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors"
                      >
                        Skip to End
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Complete Stage */}
                {stage === "complete" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                  >
                    {/* Success Icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", duration: 0.6 }}
                      className="w-32 h-32 mx-auto mb-6 bg-white rounded-full flex items-center justify-center shadow-2xl"
                    >
                      <CheckCircle2 className="w-16 h-16 text-green-500" />
                    </motion.div>

                    <h2 className="text-3xl font-bold mb-4">Excellent Work!</h2>
                    <p className="text-lg text-white/90 mb-8 max-w-md mx-auto">
                      You completed the {exerciseTitle.toLowerCase()} session. 
                      I'm so proud of your commitment to your wellbeing!
                    </p>

                    {/* Session Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <div className="text-3xl font-bold mb-1">{formatTime(timer)}</div>
                        <p className="text-sm text-white/70">Time</p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <div className="text-3xl font-bold mb-1">100%</div>
                        <p className="text-sm text-white/70">Complete</p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <Star className="w-8 h-8 text-yellow-300 mx-auto mb-1" />
                        <p className="text-sm text-white/70">Earned</p>
                      </div>
                    </div>

                    {/* Encouragement */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8 max-w-md mx-auto">
                      <Heart className="w-8 h-8 text-red-300 mx-auto mb-3" />
                      <p className="text-white/90 text-sm leading-relaxed">
                        "Regular practice builds resilience and inner peace. 
                        I encourage you to return tomorrow and continue your journey."
                      </p>
                      <p className="text-white/60 text-xs mt-2">— Ezri</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-center">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setStage("intro");
                          setTimer(0);
                          setProgress(0);
                        }}
                        className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-medium transition-colors"
                      >
                        Practice Again
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleComplete}
                        className="px-8 py-3 bg-white text-gray-900 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                      >
                        Done
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

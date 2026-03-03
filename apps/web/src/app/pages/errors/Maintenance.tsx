import { motion } from "motion/react";
import { Wrench, Clock, Mail, Twitter, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";

export function Maintenance() {
  const [timeRemaining, setTimeRemaining] = useState({
    hours: 2,
    minutes: 30,
    seconds: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Animated Maintenance Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{ 
              rotate: [0, 10, -10, 10, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-2xl mb-6"
          >
            <Wrench className="w-16 h-16 text-white" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-gray-900 mb-4"
          >
            We'll Be Right Back
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-600 mb-8"
          >
            Ezri is currently undergoing scheduled maintenance to improve your experience. 
            We'll be back online shortly!
          </motion.p>
        </motion.div>

        {/* Countdown Timer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-6"
        >
          <div className="flex items-center justify-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-900">Estimated Time Remaining</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <motion.div
                key={timeRemaining.hours}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 mb-2"
              >
                <span className="text-4xl font-bold text-white">
                  {String(timeRemaining.hours).padStart(2, '0')}
                </span>
              </motion.div>
              <p className="text-sm text-gray-600 font-medium">Hours</p>
            </div>
            
            <div className="text-center">
              <motion.div
                key={timeRemaining.minutes}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 mb-2"
              >
                <span className="text-4xl font-bold text-white">
                  {String(timeRemaining.minutes).padStart(2, '0')}
                </span>
              </motion.div>
              <p className="text-sm text-gray-600 font-medium">Minutes</p>
            </div>
            
            <div className="text-center">
              <motion.div
                key={timeRemaining.seconds}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 mb-2"
              >
                <span className="text-4xl font-bold text-white">
                  {String(timeRemaining.seconds).padStart(2, '0')}
                </span>
              </motion.div>
              <p className="text-sm text-gray-600 font-medium">Seconds</p>
            </div>
          </div>
        </motion.div>

        {/* What's Being Improved */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6"
        >
          <h3 className="font-bold text-gray-900 mb-4">What We're Working On</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">AI Performance Improvements</p>
                <p className="text-xs text-gray-600 mt-1">Faster response times and better conversation quality</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Enhanced Security</p>
                <p className="text-xs text-gray-600 mt-1">Additional encryption and privacy protections</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">New Features</p>
                <p className="text-xs text-gray-600 mt-1">Adding requested community features and tools</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">✓</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Database Optimization</p>
                <p className="text-xs text-gray-600 mt-1">Improving data sync and storage performance</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stay Updated */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-6"
        >
          <h3 className="font-bold text-purple-900 mb-4">Stay Updated</h3>
          
          <p className="text-sm text-purple-700 mb-4">
            Get real-time updates about the maintenance progress and when we're back online.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                <Twitter className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-900">Twitter</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-900">Discord</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-900">Email</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Progress Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6"
        >
          <div className="bg-white rounded-full h-3 overflow-hidden shadow-inner">
            <motion.div
              animate={{ 
                width: ["0%", "65%"],
                background: [
                  "linear-gradient(90deg, #8b5cf6, #6366f1)",
                  "linear-gradient(90deg, #6366f1, #8b5cf6)"
                ]
              }}
              transition={{ 
                width: { duration: 5, ease: "easeInOut" },
                background: { duration: 2, repeat: Infinity, repeatType: "reverse" }
              }}
              className="h-full rounded-full"
            />
          </div>
          <p className="text-center text-xs text-gray-500 mt-2">Maintenance progress: 65%</p>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-600">
            Thank you for your patience! 💜
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Questions? Email us at{" "}
            <a href="mailto:support@ezri.app" className="text-purple-600 hover:text-purple-700 underline">
              support@ezri.app
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

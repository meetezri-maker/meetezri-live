import { motion } from "motion/react";
import { Home, Search, ArrowLeft, HelpCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function Error404() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Animated 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-9xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4"
          >
            404
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-gray-900 mb-4"
          >
            Page Not Found
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-600 mb-8"
          >
            Oops! The page you're looking for seems to have wandered off. 
            Let's get you back on track.
          </motion.p>
        </motion.div>

        {/* Floating Elements */}
        <div className="relative h-40 mb-8">
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 10, 0]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute left-1/4 top-0 w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-lg opacity-80"
          />
          
          <motion.div
            animate={{ 
              y: [0, -30, 0],
              rotate: [0, -10, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5
            }}
            className="absolute right-1/4 top-8 w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-600 rounded-full shadow-lg opacity-80"
          />
          
          <motion.div
            animate={{ 
              y: [0, -15, 0],
              x: [0, 10, 0]
            }}
            transition={{ 
              duration: 3.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute left-1/2 -translate-x-1/2 bottom-0 w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg opacity-80"
          />
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium shadow-md hover:shadow-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </motion.button>

          <Link to="/app/dashboard">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg hover:shadow-xl transition-all"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </motion.button>
          </Link>
        </motion.div>

        {/* Helpful Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
        >
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            Quick Links
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <Link 
              to="/app/session-lobby"
              className="p-3 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">Start Session</p>
            </Link>
            
            <Link 
              to="/app/mood-checkin"
              className="p-3 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">Mood Check-in</p>
            </Link>
            
            <Link 
              to="/app/journal"
              className="p-3 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">Journal</p>
            </Link>
            
            <Link 
              to="/app/settings"
              className="p-3 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900">Settings</p>
            </Link>
          </div>
        </motion.div>

        {/* Support */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-600">
            Still having trouble?{" "}
            <Link to="/app/settings/help-support" className="text-blue-600 hover:text-blue-700 font-medium underline">
              Contact Support
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
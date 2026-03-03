import { motion } from "motion/react";
import { ShieldOff, Camera, Mic, MapPin, Settings, RefreshCw, Home, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

interface PermissionDeniedProps {
  type?: "camera" | "microphone" | "location" | "all";
  onRetry?: () => void;
}

export function PermissionDenied({ type = "all", onRetry }: PermissionDeniedProps) {
  const [showInstructions, setShowInstructions] = useState(false);

  const permissionInfo = {
    camera: {
      icon: Camera,
      title: "Camera Access Denied",
      description: "Ezri needs camera access to provide face-to-face therapy sessions with your AI companion.",
      required: "Camera access is required for video sessions with Ezri."
    },
    microphone: {
      icon: Mic,
      title: "Microphone Access Denied",
      description: "Ezri needs microphone access to hear you during therapy sessions.",
      required: "Microphone access is required for audio communication with Ezri."
    },
    location: {
      icon: MapPin,
      title: "Location Access Denied",
      description: "Ezri uses location to provide local crisis resources and emergency contacts.",
      required: "Location access helps us provide you with nearby support resources."
    },
    all: {
      icon: ShieldOff,
      title: "Permissions Required",
      description: "Ezri needs certain permissions to provide you with the best mental health support experience.",
      required: "Multiple permissions are required to use all features."
    }
  };

  const info = permissionInfo[type];
  const Icon = info.icon;

  const handleOpenSettings = () => {
    setShowInstructions(true);
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Animated Permission Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, -5, 5, 0]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-red-500 to-orange-600 rounded-full shadow-2xl mb-6 relative"
          >
            <Icon className="w-16 h-16 text-white" />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center"
            >
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </motion.div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-gray-900 mb-4"
          >
            {info.title}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-600 mb-2"
          >
            {info.description}
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-orange-600 font-medium"
          >
            {info.required}
          </motion.p>
        </motion.div>

        {/* Permission Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6"
        >
          <h3 className="font-bold text-gray-900 mb-4">Why We Need This Permission</h3>
          
          <div className="space-y-3">
            {type === "all" || type === "camera" ? (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <Camera className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">Camera Access</p>
                  <p className="text-xs text-gray-600">
                    For face-to-face video sessions with Ezri, your AI mental health companion
                  </p>
                </div>
              </div>
            ) : null}
            
            {type === "all" || type === "microphone" ? (
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl">
                <Mic className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">Microphone Access</p>
                  <p className="text-xs text-gray-600">
                    To hear and understand you during therapy sessions and mood check-ins
                  </p>
                </div>
              </div>
            ) : null}

            {type === "all" || type === "location" ? (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
                <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-1">Location Access</p>
                  <p className="text-xs text-gray-600">
                    To provide local crisis resources and emergency services when needed
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>

        {/* How to Enable */}
        {showInstructions ? (
          <motion.div
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 mb-6 overflow-hidden"
          >
            <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              How to Enable Permissions
            </h3>
            
            <div className="space-y-3 text-sm text-blue-900">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white font-bold text-xs">1</span>
                </div>
                <p>Click the lock icon or site settings in your browser's address bar</p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white font-bold text-xs">2</span>
                </div>
                <p>Find the permissions section (Camera, Microphone, Location)</p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white font-bold text-xs">3</span>
                </div>
                <p>Change the setting from "Block" to "Allow"</p>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white font-bold text-xs">4</span>
                </div>
                <p>Refresh the page or click "Try Again" below</p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-white rounded-xl">
              <p className="text-xs text-gray-600">
                <strong>Note:</strong> The exact steps may vary depending on your browser (Chrome, Safari, Firefox, etc.)
              </p>
            </div>
          </motion.div>
        ) : null}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
        >
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRetry}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg hover:shadow-xl transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleOpenSettings}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white border-2 border-blue-200 hover:border-blue-300 text-gray-700 font-medium shadow-md hover:shadow-lg transition-all"
          >
            <Settings className="w-5 h-5" />
            {showInstructions ? "Hide Instructions" : "Show Instructions"}
          </motion.button>
        </motion.div>

        {/* Alternative Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex justify-center"
        >
          <Link to="/app/dashboard">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white transition-all"
            >
              <Home className="w-4 h-4" />
              Return to Dashboard
            </motion.button>
          </Link>
        </motion.div>

        {/* Privacy Assurance */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-6 mt-6"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-xl shadow-md">
              <ShieldOff className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-green-900 mb-2">Your Privacy Matters</h3>
              <p className="text-sm text-green-700 mb-3">
                We only access these permissions when you're actively using features that require them. 
                Your camera and microphone are never accessed without your knowledge.
              </p>
              <Link to="/privacy" className="text-sm font-medium text-green-600 hover:text-green-800 underline">
                Read our Privacy Policy
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

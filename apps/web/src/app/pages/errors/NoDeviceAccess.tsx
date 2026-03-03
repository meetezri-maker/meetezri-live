import { motion } from "motion/react";
import { Camera, Mic, VideoOff, MicOff, AlertCircle, RefreshCw, Home, HelpCircle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

interface NoDeviceAccessProps {
  type?: "camera" | "microphone" | "both";
  onRetry?: () => void;
}

export function NoDeviceAccess({ type = "both", onRetry }: NoDeviceAccessProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    camera: false,
    microphone: false
  });

  useEffect(() => {
    checkDevices();
  }, []);

  const checkDevices = async () => {
    setIsChecking(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDeviceStatus({
        camera: devices.some(device => device.kind === 'videoinput'),
        microphone: devices.some(device => device.kind === 'audioinput')
      });
    } catch (error) {
      console.error('Error checking devices:', error);
    }
    setIsChecking(false);
  };

  const handleRetry = async () => {
    await checkDevices();
    if (onRetry) {
      onRetry();
    }
  };

  const getTitle = () => {
    if (type === "camera") return "No Camera Detected";
    if (type === "microphone") return "No Microphone Detected";
    return "No Camera or Microphone Detected";
  };

  const getDescription = () => {
    if (type === "camera") {
      return "We couldn't find a camera on your device. Video sessions with Ezri require a working camera.";
    }
    if (type === "microphone") {
      return "We couldn't find a microphone on your device. Audio communication with Ezri requires a working microphone.";
    }
    return "We couldn't detect a camera or microphone on your device. These are required for sessions with Ezri.";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Animated Device Error Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-gray-500 to-slate-600 rounded-full shadow-2xl mb-6 relative"
          >
            {type === "camera" && <VideoOff className="w-16 h-16 text-white" />}
            {type === "microphone" && <MicOff className="w-16 h-16 text-white" />}
            {type === "both" && (
              <div className="relative">
                <VideoOff className="w-12 h-12 text-white absolute -left-4 -top-2" />
                <MicOff className="w-12 h-12 text-white absolute left-2 top-2" />
              </div>
            )}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
            >
              <AlertCircle className="w-4 h-4 text-white" />
            </motion.div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-gray-900 mb-4"
          >
            {getTitle()}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg text-gray-600 mb-2"
          >
            {getDescription()}
          </motion.p>
        </motion.div>

        {/* Device Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Device Status</h3>
            {isChecking && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="w-4 h-4 text-blue-600" />
              </motion.div>
            )}
          </div>
          
          <div className="space-y-3">
            <div className={`p-4 rounded-xl ${deviceStatus.camera ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${deviceStatus.camera ? 'bg-green-100' : 'bg-red-100'}`}>
                    {deviceStatus.camera ? (
                      <Camera className="w-5 h-5 text-green-600" />
                    ) : (
                      <VideoOff className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Camera</p>
                    <p className="text-xs text-gray-600">
                      {deviceStatus.camera ? 'Detected' : 'Not detected'}
                    </p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${deviceStatus.camera ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </div>
            
            <div className={`p-4 rounded-xl ${deviceStatus.microphone ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${deviceStatus.microphone ? 'bg-green-100' : 'bg-red-100'}`}>
                    {deviceStatus.microphone ? (
                      <Mic className="w-5 h-5 text-green-600" />
                    ) : (
                      <MicOff className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Microphone</p>
                    <p className="text-xs text-gray-600">
                      {deviceStatus.microphone ? 'Detected' : 'Not detected'}
                    </p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${deviceStatus.microphone ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Troubleshooting Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 mb-6"
        >
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            Troubleshooting Steps
          </h3>
          
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">1</span>
              </div>
              <p>Check if your camera/microphone is properly connected to your device</p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">2</span>
              </div>
              <p>Try unplugging and reconnecting your external camera or microphone</p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">3</span>
              </div>
              <p>Make sure no other application is currently using your camera/microphone</p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">4</span>
              </div>
              <p>Check your system settings to ensure the device is enabled</p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">5</span>
              </div>
              <p>Restart your browser or device if the issue persists</p>
            </div>
          </div>
        </motion.div>

        {/* Alternative Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 mb-6"
        >
          <h3 className="font-bold text-blue-900 mb-3">Alternative Features Available</h3>
          <p className="text-sm text-blue-700 mb-4">
            While video sessions aren't available, you can still use these features:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded-lg p-3">
              <p className="text-gray-900 font-medium">📝 Journal</p>
              <p className="text-gray-600">Write and reflect</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-gray-900 font-medium">😊 Mood Tracking</p>
              <p className="text-gray-600">Log your emotions</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-gray-900 font-medium">🧘 Wellness Tools</p>
              <p className="text-gray-600">Guided exercises</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-gray-900 font-medium">📊 Progress</p>
              <p className="text-gray-600">View insights</p>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6"
        >
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRetry}
            disabled={isChecking}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Checking...' : 'Check Again'}
          </motion.button>

          <Link to="/app/dashboard">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium shadow-md hover:shadow-lg transition-all"
            >
              <Home className="w-5 h-5" />
              Go to Dashboard
            </motion.button>
          </Link>
        </motion.div>

        {/* Help Resources */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <p className="text-sm text-gray-600 mb-2">Need more help?</p>
          <div className="flex items-center justify-center gap-4">
            <a 
              href="https://support.ezri.app/device-setup" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              Device Setup Guide
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-gray-400">•</span>
            <Link to="/app/settings" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Settings
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

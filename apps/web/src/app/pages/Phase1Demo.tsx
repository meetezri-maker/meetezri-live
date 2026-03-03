import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Shield, Camera, Clock, AlertTriangle, Key, CheckCircle } from "lucide-react";
import { useState } from "react";
import { LowMinutesWarning } from "../components/modals/LowMinutesWarning";

export function Phase1Demo() {
  const [showLowMinutesModal, setShowLowMinutesModal] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState(3);

  const screens = [
    {
      id: 1,
      name: "Permission Denied",
      description: "Handles denied camera/mic/location permissions",
      route: "/error/permission-denied",
      icon: Shield,
      gradient: "from-red-500 to-orange-600",
      status: "complete"
    },
    {
      id: 2,
      name: "No Device Access",
      description: "Shows when no camera/microphone is detected",
      route: "/error/no-device-access",
      icon: Camera,
      gradient: "from-slate-500 to-gray-600",
      status: "complete"
    },
    {
      id: 3,
      name: "Low Minutes Warning",
      description: "Modal warning when session time is running low",
      route: null,
      icon: Clock,
      gradient: "from-orange-500 to-amber-600",
      status: "complete",
      isModal: true
    },
    {
      id: 4,
      name: "Trial Expired",
      description: "Full-screen upgrade CTA when trial ends",
      route: "/error/trial-expired",
      icon: AlertTriangle,
      gradient: "from-purple-500 to-pink-600",
      status: "complete"
    },
    {
      id: 5,
      name: "Two-Factor Auth (Admin)",
      description: "Admin 2FA setup with authenticator apps",
      route: "/admin/two-factor-auth",
      icon: Key,
      gradient: "from-blue-500 to-indigo-600",
      status: "complete"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
            }}
            className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-2xl mb-6"
          >
            <CheckCircle className="w-12 h-12 text-white" />
          </motion.div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Phase 1: Critical User Edge States
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            5 Essential Screens for Error Handling & Security
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 border-2 border-green-500 rounded-full">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="font-bold text-green-900">100% Complete</span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-4 gap-4 mb-12"
        >
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">5/5</div>
            <p className="text-sm text-gray-600">Screens Built</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-1">100%</div>
            <p className="text-sm text-gray-600">Phase Complete</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">~3hrs</div>
            <p className="text-sm text-gray-600">Development Time</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-center">
            <div className="text-3xl font-bold text-orange-600 mb-1">91/104</div>
            <p className="text-sm text-gray-600">Total Progress</p>
          </div>
        </motion.div>

        {/* Screen Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {screens.map((screen, index) => (
            <motion.div
              key={screen.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="group"
            >
              <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100 hover:border-blue-300 transition-all h-full flex flex-col">
                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-br ${screen.gradient} rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <screen.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {screen.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4 flex-1">
                  {screen.description}
                </p>

                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-100 rounded-full">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-bold text-green-900">Complete</span>
                  </div>
                  {screen.isModal && (
                    <div className="px-3 py-1 bg-purple-100 rounded-full">
                      <span className="text-xs font-bold text-purple-900">Modal</span>
                    </div>
                  )}
                </div>

                {/* View Button */}
                {screen.isModal ? (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowLowMinutesModal(true)}
                    className={`w-full py-3 rounded-xl bg-gradient-to-r ${screen.gradient} text-white font-bold shadow-md hover:shadow-xl transition-all`}
                  >
                    Open Modal
                  </motion.button>
                ) : (
                  <Link to={screen.route!}>
                    <motion.button
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-3 rounded-xl bg-gradient-to-r ${screen.gradient} text-white font-bold shadow-md hover:shadow-xl transition-all`}
                    >
                      View Screen
                    </motion.button>
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Low Minutes Modal Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6 mb-12"
        >
          <h3 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Low Minutes Warning Demo Controls
          </h3>
          
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <button
              onClick={() => { setMinutesRemaining(1); setShowLowMinutesModal(true); }}
              className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
            >
              Critical (1 min)
            </button>
            <button
              onClick={() => { setMinutesRemaining(2); setShowLowMinutesModal(true); }}
              className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
            >
              High (2 min)
            </button>
            <button
              onClick={() => { setMinutesRemaining(4); setShowLowMinutesModal(true); }}
              className="px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl transition-colors"
            >
              Medium (4 min)
            </button>
            <button
              onClick={() => { setMinutesRemaining(5); setShowLowMinutesModal(true); }}
              className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
            >
              Normal (5 min)
            </button>
          </div>

          <p className="text-sm text-orange-700">
            Click any button above to test different urgency levels in the Low Minutes Warning modal.
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-12"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Phase 1 Features</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-bold text-gray-900 mb-3">User Experience</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Graceful permission handling</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Device detection & troubleshooting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Session time warnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Trial expiration handling</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-900 mb-3">Technical</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Motion animations throughout</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Responsive mobile design</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Admin 2FA security</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>Professional error states</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-center gap-4">
          <Link to="/">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-all"
            >
              Back to Home
            </motion.button>
          </Link>
          
          <Link to="/app/dashboard">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
            >
              Go to Dashboard
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Low Minutes Warning Modal */}
      <LowMinutesWarning
        isOpen={showLowMinutesModal}
        onClose={() => setShowLowMinutesModal(false)}
        minutesRemaining={minutesRemaining}
      />
    </div>
  );
}

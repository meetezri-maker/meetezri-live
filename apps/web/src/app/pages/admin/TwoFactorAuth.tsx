import { motion } from "motion/react";
import { AdminLayoutNew } from "../../components/AdminLayoutNew";
import { ArrowLeft, ArrowRight, Shield, Key, CheckCircle2, Check, Copy, AlertCircle, Smartphone, QrCode } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export function TwoFactorAuth() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"intro" | "setup" | "verify" | "complete">("intro");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);

  // Mock data
  const secretKey = "JBSWY3DPEHPK3PXP";
  const backupCodes = [
    "A1B2-C3D4-E5F6",
    "G7H8-I9J0-K1L2",
    "M3N4-O5P6-Q7R8",
    "S9T0-U1V2-W3X4",
    "Y5Z6-A7B8-C9D0"
  ];

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsVerifying(false);
    setStep("complete");
  };

  const copyToClipboard = async (text: string, type: "secret" | "backup") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "secret") {
        setSecretCopied(true);
        setTimeout(() => setSecretCopied(false), 2000);
      } else {
        setBackupCodesCopied(true);
        setTimeout(() => setBackupCodesCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const isCodeComplete = code.every(digit => digit !== "");

  return (
    <AdminLayoutNew>
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [0, -2, 2, 0]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-2xl mb-6 relative"
          >
            <Shield className="w-12 h-12 text-white" />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full"
              style={{ filter: 'blur(15px)', zIndex: -1 }}
            />
          </motion.div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Two-Factor Authentication
          </h1>
          <p className="text-gray-600">
            Add an extra layer of security to your admin account
          </p>
        </motion.div>

        {/* Progress Indicator */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between">
            {["intro", "setup", "verify", "complete"].map((s, index) => (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold transition-all ${
                  step === s 
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg scale-110" 
                    : ["intro", "setup", "verify", "complete"].indexOf(step) > index
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}>
                  {["intro", "setup", "verify", "complete"].indexOf(step) > index ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-1 mx-2 transition-all ${
                    ["intro", "setup", "verify", "complete"].indexOf(step) > index
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Intro</span>
            <span>Setup</span>
            <span>Verify</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-2xl mx-auto">
          {/* Intro Step */}
          {step === "intro" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Why Enable 2FA?</h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-xl">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Enhanced Security</h3>
                    <p className="text-sm text-gray-600">
                      Protect your admin account from unauthorized access, even if your password is compromised.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-xl">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Smartphone className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Mobile Verification</h3>
                    <p className="text-sm text-gray-600">
                      Use an authenticator app on your phone to generate time-based verification codes.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-green-50 rounded-xl">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Key className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Backup Codes</h3>
                    <p className="text-sm text-gray-600">
                      Receive backup codes to access your account if you lose your phone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">What You'll Need</p>
                    <p className="text-sm text-yellow-700">
                      An authenticator app like Google Authenticator, Authy, or Microsoft Authenticator installed on your phone.
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStep("setup")}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
              >
                Get Started
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}

          {/* Setup Step */}
          {step === "setup" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Scan QR Code</h2>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* QR Code */}
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl p-6 border-2 border-gray-200">
                  <div className="bg-white p-4 rounded-xl shadow-inner mb-4">
                    {/* Mock QR Code */}
                    <div className="aspect-square bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <QrCode className="w-32 h-32 text-white opacity-50" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    Scan this with your authenticator app
                  </p>
                </div>

                {/* Instructions */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Setup Instructions</h3>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-xs">1</span>
                      </div>
                      <p>Open your authenticator app</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-xs">2</span>
                      </div>
                      <p>Tap "Add Account" or "+"</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-xs">3</span>
                      </div>
                      <p>Scan the QR code with your camera</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-bold text-xs">4</span>
                      </div>
                      <p>Or manually enter the key below</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Key */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">Can't scan? Enter this key manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-4 py-3 bg-white rounded-lg font-mono text-lg font-bold text-gray-900 border border-gray-200">
                    {secretKey}
                  </code>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(secretKey, "secret")}
                    className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                  >
                    {secretCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </motion.button>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("intro")}
                  className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("verify")}
                  className="flex-1 flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Verify Step */}
          {step === "verify" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Setup</h2>
              <p className="text-gray-600 mb-8">
                Enter the 6-digit code from your authenticator app
              </p>

              {/* Code Input */}
              <div className="flex justify-center gap-2 mb-8">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  />
                ))}
              </div>

              {/* Backup Codes Preview */}
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-900 mb-1">Backup Codes</p>
                    <p className="text-sm text-yellow-700">
                      After verification, you'll receive backup codes to save in a secure location.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setStep("setup")}
                  className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: isCodeComplete ? 1.02 : 1, y: isCodeComplete ? -2 : 0 }}
                  whileTap={{ scale: isCodeComplete ? 0.98 : 1 }}
                  onClick={handleVerify}
                  disabled={!isCodeComplete || isVerifying}
                  className="flex-1 flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Shield className="w-5 h-5" />
                      </motion.div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Enable
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Complete Step */}
          {step === "complete" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100"
            >
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="text-center mb-6"
              >
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full shadow-2xl mb-4">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">2FA Enabled Successfully!</h2>
                <p className="text-gray-600">Your account is now more secure</p>
              </motion.div>

              {/* Backup Codes */}
              <div className="bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-gray-200 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-blue-600" />
                  Your Backup Codes
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Save these codes in a secure location. Each code can be used once if you lose access to your authenticator app.
                </p>
                
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="px-4 py-3 bg-white rounded-lg font-mono font-bold text-gray-900 border border-gray-200">
                      {code}
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => copyToClipboard(backupCodes.join('\n'), "backup")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                >
                  {backupCodesCopied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy All Codes
                    </>
                  )}
                </motion.button>
              </div>

              {/* Warning */}
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-900 mb-1">Important!</p>
                    <p className="text-sm text-red-700">
                      Keep your backup codes safe. You won't be able to see them again after leaving this page.
                    </p>
                  </div>
                </div>
              </div>

              <Link to="/admin/super-admin-dashboard">
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Go to Dashboard
                </motion.button>
              </Link>
            </motion.div>
          )}
        </div>

        {/* Footer Help */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-600 mb-2">Need help?</p>
          <Link to="/admin/security-settings" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View Security Settings
          </Link>
        </motion.div>
      </div>
    </AdminLayoutNew>
  );
}
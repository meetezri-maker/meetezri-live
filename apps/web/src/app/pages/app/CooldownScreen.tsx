/**
 * EZRI — COOLDOWN SCREEN
 * Post-session recovery for users after HIGH_RISK or SAFETY_MODE
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { AppLayout } from '@/app/components/AppLayout';
import { GroundingExercises } from '@/app/components/safety/GroundingExercises';
import { BreathingExercises } from '@/app/components/safety/BreathingExercises';
import { useSafety } from '@/app/contexts/SafetyContext';
import {
  Heart,
  Wind,
  Eye,
  Shield,
  Coffee,
  CheckCircle,
  ChevronRight,
  Clock,
  AlertCircle,
  Home,
  ArrowLeft
} from 'lucide-react';

type Activity = 'breathing' | 'grounding' | 'rest' | null;

interface CooldownScreenProps {
  sessionId?: string;
  safetyLevel?: 'HIGH_RISK' | 'SAFETY_MODE';
}

export function CooldownScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentState, resetToNormal } = useSafety();
  
  // Get session data from navigation state
  const sessionId = (location.state as any)?.sessionId || 'unknown';
  const safetyLevel = (location.state as any)?.safetyLevel || currentState;
  const sessionDuration = (location.state as any)?.sessionDuration || 0;
  
  const [currentActivity, setCurrentActivity] = useState<Activity>(null);
  const [completedActivities, setCompletedActivities] = useState<Activity[]>([]);
  const [cooldownStartTime] = useState(Date.now());
  const [timeInCooldown, setTimeInCooldown] = useState(0);
  const [canProceed, setCanProceed] = useState(false);

  // Minimum cooldown time (in seconds)
  const minCooldownTime = safetyLevel === 'SAFETY_MODE' ? 180 : 120; // 3 min or 2 min

  // Track time in cooldown
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - cooldownStartTime) / 1000);
      setTimeInCooldown(elapsed);
      
      // Allow proceeding after minimum time AND at least one activity
      if (elapsed >= minCooldownTime && completedActivities.length > 0) {
        setCanProceed(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownStartTime, minCooldownTime, completedActivities.length]);

  // Log cooldown session
  useEffect(() => {
    console.log('🧘 Cooldown session started', {
      sessionId,
      safetyLevel,
      timestamp: new Date().toISOString()
    });

    // Save to localStorage
    const cooldownData = {
      sessionId,
      safetyLevel,
      startTime: new Date().toISOString(),
      activities: []
    };
    localStorage.setItem('ezri_current_cooldown', JSON.stringify(cooldownData));
  }, [sessionId, safetyLevel]);

  const handleActivityComplete = () => {
    if (currentActivity && !completedActivities.includes(currentActivity)) {
      setCompletedActivities([...completedActivities, currentActivity]);
      
      // Update localStorage
      const stored = localStorage.getItem('ezri_current_cooldown');
      if (stored) {
        const data = JSON.parse(stored);
        data.activities.push({
          type: currentActivity,
          completedAt: new Date().toISOString()
        });
        localStorage.setItem('ezri_current_cooldown', JSON.stringify(data));
      }
    }
    setCurrentActivity(null);
  };

  const handleSkipActivity = () => {
    setCurrentActivity(null);
  };

  const handleProceed = () => {
    // Log completion
    const stored = localStorage.getItem('ezri_current_cooldown');
    if (stored) {
      const data = JSON.parse(stored);
      data.endTime = new Date().toISOString();
      data.duration = timeInCooldown;
      
      // Save to history
      const history = JSON.parse(localStorage.getItem('ezri_cooldown_history') || '[]');
      history.unshift(data);
      localStorage.setItem('ezri_cooldown_history', JSON.stringify(history.slice(0, 50)));
      
      // Clear current
      localStorage.removeItem('ezri_current_cooldown');
    }

    // Reset safety state to NORMAL
    resetToNormal();

    // Navigate to session lobby with check-in prompt
    navigate('/app/session-lobby', {
      state: {
        showReEntryCheckin: true,
        previousSessionId: sessionId,
        cooldownDuration: timeInCooldown
      }
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Activity Selection View
  if (!currentActivity) {
    const timeRemaining = Math.max(0, minCooldownTime - timeInCooldown);
    const hasMinTime = timeInCooldown >= minCooldownTime;
    const hasActivity = completedActivities.length > 0;

    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Back to Settings Button */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Link 
              to="/app/settings" 
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Take a Moment to Reset</h1>
            <p className="text-lg text-muted-foreground">
              Your session involved some intense moments. Let's help you feel grounded before continuing.
            </p>
          </motion.div>

          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <Card className={`p-6 border-2 ${
              safetyLevel === 'SAFETY_MODE' 
                ? 'border-red-200 bg-red-50' 
                : 'border-orange-200 bg-orange-50'
            }`}>
              <div className="flex items-start gap-4">
                <AlertCircle className={`w-6 h-6 flex-shrink-0 ${
                  safetyLevel === 'SAFETY_MODE' ? 'text-red-600' : 'text-orange-600'
                }`} />
                <div className="flex-1">
                  <h3 className={`font-bold mb-1 ${
                    safetyLevel === 'SAFETY_MODE' ? 'text-red-900' : 'text-orange-900'
                  }`}>
                    {safetyLevel === 'SAFETY_MODE' ? 'Safety Mode Activated' : 'High Risk Detected'}
                  </h3>
                  <p className={`text-sm mb-3 ${
                    safetyLevel === 'SAFETY_MODE' ? 'text-red-800' : 'text-orange-800'
                  }`}>
                    Our safety system detected concerning patterns during your session. This cooldown period helps ensure you're feeling stable before you continue.
                  </p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Time in cooldown: {formatTime(timeInCooldown)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>{completedActivities.length} activities completed</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-xl font-bold mb-4">Recovery Activities</h2>
            <p className="text-muted-foreground mb-6">
              Choose at least one activity to help you feel centered and calm.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              {/* Breathing */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentActivity('breathing')}
                className="cursor-pointer"
              >
                <Card className={`p-6 border-2 transition-all ${
                  completedActivities.includes('breathing')
                    ? 'border-green-300 bg-green-50'
                    : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                }`}>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full mb-3">
                      <Wind className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold mb-2">Breathing Exercise</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Calm your nervous system with guided breathing
                    </p>
                    {completedActivities.includes('breathing') ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                    ) : (
                      <div className="text-blue-600 font-medium text-sm flex items-center justify-center gap-1">
                        <span>Start Exercise</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Grounding */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentActivity('grounding')}
                className="cursor-pointer"
              >
                <Card className={`p-6 border-2 transition-all ${
                  completedActivities.includes('grounding')
                    ? 'border-green-300 bg-green-50'
                    : 'border-purple-200 bg-purple-50 hover:bg-purple-100'
                }`}>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500 rounded-full mb-3">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold mb-2">Grounding Exercise</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Reconnect with the present moment
                    </p>
                    {completedActivities.includes('grounding') ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                    ) : (
                      <div className="text-purple-600 font-medium text-sm flex items-center justify-center gap-1">
                        <span>Start Exercise</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Rest */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentActivity('rest')}
                className="cursor-pointer"
              >
                <Card className={`p-6 border-2 transition-all ${
                  completedActivities.includes('rest')
                    ? 'border-green-300 bg-green-50'
                    : 'border-pink-200 bg-pink-50 hover:bg-pink-100'
                }`}>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-pink-500 rounded-full mb-3">
                      <Coffee className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold mb-2">Quiet Rest</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Take a few minutes to simply be still
                    </p>
                    {completedActivities.includes('rest') ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                    ) : (
                      <div className="text-pink-600 font-medium text-sm flex items-center justify-center gap-1">
                        <span>Start Rest</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            </div>
          </motion.div>

          {/* Proceed Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {!canProceed && (
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    {!hasActivity && !hasMinTime && (
                      <p>Complete at least one activity and wait {formatTime(timeRemaining)} more before continuing.</p>
                    )}
                    {!hasActivity && hasMinTime && (
                      <p>Please complete at least one recovery activity before continuing.</p>
                    )}
                    {hasActivity && !hasMinTime && (
                      <p>Good job! Please wait {formatTime(timeRemaining)} more to ensure you're feeling stable.</p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <div className="flex gap-4">
              <Button
                onClick={handleProceed}
                disabled={!canProceed}
                size="lg"
                className="flex-1"
              >
                <Heart className="w-5 h-5 mr-2" />
                I'm Feeling Better - Continue
              </Button>
              <Button
                onClick={() => navigate('/app/dashboard')}
                size="lg"
                variant="outline"
              >
                <Home className="w-5 h-5 mr-2" />
                Go Home
              </Button>
            </div>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  // Activity Views
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            onClick={handleSkipActivity}
            variant="outline"
            className="mb-6"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Activities
          </Button>

          <AnimatePresence mode="wait">
            {currentActivity === 'breathing' && (
              <motion.div
                key="breathing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <BreathingExercises onComplete={handleActivityComplete} />
              </motion.div>
            )}

            {currentActivity === 'grounding' && (
              <motion.div
                key="grounding"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <GroundingExercises onComplete={handleActivityComplete} />
              </motion.div>
            )}

            {currentActivity === 'rest' && (
              <motion.div
                key="rest"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="p-8 text-center bg-gradient-to-br from-pink-50 to-purple-50">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-pink-500 rounded-full mb-6">
                    <Coffee className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Quiet Rest</h3>
                  <p className="text-lg text-gray-700 mb-8 max-w-md mx-auto">
                    Take the next few minutes to simply sit quietly. You don't need to do anything. 
                    Just breathe naturally and let yourself be.
                  </p>
                  <div className="text-sm text-gray-600 mb-8">
                    Take your time. When you're ready, click the button below.
                  </div>
                  <Button onClick={handleActivityComplete} size="lg">
                    I Feel More Settled
                  </Button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AppLayout>
  );
}
/**
 * EZRI — BREATHING EXERCISES COMPONENT
 * Guided breathing techniques for calming and centering
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  Wind,
  Heart,
  Circle,
  Square,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Check,
  Volume2,
  VolumeX
} from 'lucide-react';

type Technique = 'box' | '4-7-8' | 'calm';

interface BreathingExercisesProps {
  onComplete?: () => void;
  selectedTechnique?: Technique;
}

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

interface BreathingPattern {
  name: string;
  description: string;
  icon: typeof Wind;
  color: string;
  pattern: Record<Phase, number>; // in seconds
  totalCycles: number;
  benefits: string[];
}

const techniques: Record<Technique, BreathingPattern> = {
  box: {
    name: 'Box Breathing',
    description: 'Equal parts inhale, hold, exhale, hold',
    icon: Square,
    color: 'blue',
    pattern: {
      inhale: 4,
      hold1: 4,
      exhale: 4,
      hold2: 4
    },
    totalCycles: 4,
    benefits: ['Reduces stress', 'Improves focus', 'Calms nervous system']
  },
  '4-7-8': {
    name: '4-7-8 Breathing',
    description: 'Deep relaxation technique',
    icon: Wind,
    color: 'purple',
    pattern: {
      inhale: 4,
      hold1: 7,
      exhale: 8,
      hold2: 0
    },
    totalCycles: 4,
    benefits: ['Promotes sleep', 'Reduces anxiety', 'Lowers blood pressure']
  },
  calm: {
    name: 'Calm Breathing',
    description: 'Simple, soothing rhythm',
    icon: Heart,
    color: 'green',
    pattern: {
      inhale: 4,
      hold1: 0,
      exhale: 6,
      hold2: 0
    },
    totalCycles: 5,
    benefits: ['Easy to follow', 'Quick relaxation', 'Gentle on body']
  }
};

export function BreathingExercises({ onComplete, selectedTechnique }: BreathingExercisesProps) {
  const [currentTechnique, setCurrentTechnique] = useState<Technique | null>(selectedTechnique || null);
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<Phase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const technique = currentTechnique ? techniques[currentTechnique] : null;

  // Reset function
  const resetExercise = () => {
    setIsActive(false);
    setCurrentPhase('inhale');
    setSecondsLeft(0);
    setCycleCount(0);
    setIsComplete(false);
  };

  // Start/Resume exercise
  const startExercise = () => {
    if (!technique) return;
    setIsActive(true);
    if (secondsLeft === 0) {
      setSecondsLeft(technique.pattern.inhale);
    }
  };

  // Pause exercise
  const pauseExercise = () => {
    setIsActive(false);
  };

  // Choose different technique
  const chooseTechnique = () => {
    setCurrentTechnique(null);
    resetExercise();
  };

  // Timer effect
  useEffect(() => {
    if (!isActive || !technique) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Move to next phase
          const phases: Phase[] = ['inhale', 'hold1', 'exhale', 'hold2'];
          const currentIndex = phases.indexOf(currentPhase);
          const nextIndex = (currentIndex + 1) % phases.length;
          const nextPhase = phases[nextIndex];

          // Check if we've completed a full cycle
          if (nextPhase === 'inhale') {
            const newCycleCount = cycleCount + 1;
            setCycleCount(newCycleCount);

            // Check if we've completed all cycles
            if (newCycleCount >= technique.totalCycles) {
              setIsActive(false);
              setIsComplete(true);
              
              // Play completion sound (if enabled)
              if (soundEnabled) {
                playSound('complete');
              }
              
              // Call onComplete after a delay
              setTimeout(() => {
                if (onComplete) {
                  onComplete();
                }
              }, 2000);
              
              return 0;
            }
          }

          // Set next phase
          setCurrentPhase(nextPhase);
          
          // Play transition sound
          if (soundEnabled && nextPhase === 'inhale') {
            playSound('inhale');
          } else if (soundEnabled && nextPhase === 'exhale') {
            playSound('exhale');
          }
          
          return technique.pattern[nextPhase];
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, currentPhase, cycleCount, technique, soundEnabled, onComplete]);

  // Mock sound function (in production, use Web Audio API or audio files)
  const playSound = (type: 'inhale' | 'exhale' | 'complete') => {
    console.log(`🔊 Playing ${type} sound`);
    // In production: new Audio(`/sounds/${type}.mp3`).play();
  };

  // Get phase instructions
  const getPhaseInstruction = () => {
    switch (currentPhase) {
      case 'inhale':
        return 'Breathe In';
      case 'hold1':
        return 'Hold';
      case 'exhale':
        return 'Breathe Out';
      case 'hold2':
        return 'Hold';
    }
  };

  // Get phase color
  const getPhaseColor = () => {
    switch (currentPhase) {
      case 'inhale':
        return 'from-blue-400 to-blue-600';
      case 'hold1':
        return 'from-purple-400 to-purple-600';
      case 'exhale':
        return 'from-green-400 to-green-600';
      case 'hold2':
        return 'from-yellow-400 to-yellow-600';
    }
  };

  // Technique Selection Screen
  if (!currentTechnique) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2">Breathing Exercises</h3>
          <p className="text-muted-foreground">
            Choose a technique to calm your mind and body
          </p>
        </div>

        {Object.entries(techniques).map(([key, tech]) => {
          const Icon = tech.icon;
          return (
            <motion.div
              key={key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentTechnique(key as Technique)}
              className="cursor-pointer"
            >
              <Card className={`p-6 border-2 border-${tech.color}-200 bg-${tech.color}-50 hover:bg-${tech.color}-100 transition-colors`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 bg-${tech.color}-500 rounded-xl`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg mb-1">{tech.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{tech.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {tech.benefits.map((benefit, idx) => (
                        <span
                          key={idx}
                          className={`text-xs px-2 py-1 bg-${tech.color}-100 text-${tech.color}-700 rounded-full`}
                        >
                          {benefit}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-${tech.color}-600`} />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // Completion Screen
  if (isComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4"
        >
          <Check className="w-10 h-10 text-green-600" />
        </motion.div>
        <h3 className="text-2xl font-bold mb-2">Breathing Complete!</h3>
        <p className="text-muted-foreground mb-4">
          You've completed {technique?.totalCycles} cycles of {technique?.name}
        </p>
        <div className="flex items-center justify-center gap-2 text-green-600 mb-6">
          <Heart className="w-5 h-5" />
          <span className="font-medium">Well done. You should feel more centered now.</span>
        </div>
        <Button onClick={chooseTechnique} variant="outline">
          Try Another Technique
        </Button>
      </motion.div>
    );
  }

  // Active Breathing Exercise
  if (!technique) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">{technique.name}</h3>
          <p className="text-sm text-muted-foreground">
            Cycle {cycleCount + 1} of {technique.totalCycles}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-600" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <button
            onClick={chooseTechnique}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Change
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${getPhaseColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${((cycleCount / technique.totalCycles) * 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Breathing Animation */}
      <Card className="p-8 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="flex flex-col items-center">
          {/* Animated Circle */}
          <div className="relative w-64 h-64 mb-8">
            <motion.div
              className={`absolute inset-0 rounded-full bg-gradient-to-r ${getPhaseColor()} opacity-20`}
              animate={{
                scale: currentPhase === 'inhale' ? 1.5 : currentPhase === 'exhale' ? 0.8 : 1,
              }}
              transition={{
                duration: technique.pattern[currentPhase],
                ease: 'easeInOut'
              }}
            />
            <motion.div
              className={`absolute inset-8 rounded-full bg-gradient-to-r ${getPhaseColor()} flex items-center justify-center`}
              animate={{
                scale: currentPhase === 'inhale' ? 1.3 : currentPhase === 'exhale' ? 0.7 : 1,
              }}
              transition={{
                duration: technique.pattern[currentPhase],
                ease: 'easeInOut'
              }}
            >
              <div className="text-center text-white">
                <motion.div
                  key={secondsLeft}
                  initial={{ scale: 1.2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-6xl font-bold mb-2"
                >
                  {secondsLeft}
                </motion.div>
                <div className="text-xl font-medium">
                  {getPhaseInstruction()}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {!isActive ? (
              <Button
                onClick={startExercise}
                size="lg"
                className="px-8"
              >
                <Play className="w-5 h-5 mr-2" />
                {cycleCount === 0 ? 'Start' : 'Resume'}
              </Button>
            ) : (
              <Button
                onClick={pauseExercise}
                size="lg"
                variant="outline"
                className="px-8"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pause
              </Button>
            )}
            <Button
              onClick={resetExercise}
              size="lg"
              variant="outline"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Instructions */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Wind className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">How it works</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Follow the breathing circle and timer</li>
              <li>• Breathe naturally through your nose</li>
              <li>• Let your belly expand as you inhale</li>
              <li>• Relax completely as you exhale</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

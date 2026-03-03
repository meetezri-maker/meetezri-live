/**
 * EZRI — GROUNDING EXERCISES COMPONENT
 * Helps users reconnect with the present moment during/after safety concerns
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  Eye,
  Ear,
  Hand,
  Wind,
  Apple,
  Circle,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowRight,
  Heart,
  Sparkles
} from 'lucide-react';

type Exercise = '5-4-3-2-1' | 'body-scan' | 'category-game';

interface GroundingExercisesProps {
  onComplete?: () => void;
  selectedExercise?: Exercise;
}

export function GroundingExercises({ onComplete, selectedExercise }: GroundingExercisesProps) {
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(selectedExercise || null);
  const [step, setStep] = useState(0);
  const [userInputs, setUserInputs] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');

  // 5-4-3-2-1 Exercise Steps
  const fiveSteps = [
    {
      title: '5 Things You Can See',
      icon: Eye,
      prompt: 'Look around and name 5 things you can see right now',
      color: 'blue',
      count: 5
    },
    {
      title: '4 Things You Can Touch',
      icon: Hand,
      prompt: 'Notice 4 things you can physically touch or feel',
      color: 'purple',
      count: 4
    },
    {
      title: '3 Things You Can Hear',
      icon: Ear,
      prompt: 'Listen carefully for 3 sounds around you',
      color: 'green',
      count: 3
    },
    {
      title: '2 Things You Can Smell',
      icon: Wind,
      prompt: 'Identify 2 scents in your environment',
      color: 'orange',
      count: 2
    },
    {
      title: '1 Thing You Can Taste',
      icon: Apple,
      prompt: 'Notice 1 thing you can taste right now',
      color: 'red',
      count: 1
    }
  ];

  // Body Scan Steps
  const bodyScanSteps = [
    { area: 'Feet & Toes', instruction: 'Notice your feet on the floor. Wiggle your toes. Feel the surface beneath them.' },
    { area: 'Legs', instruction: 'Bring awareness to your legs. Notice any tension or relaxation in your calves and thighs.' },
    { area: 'Hips & Lower Back', instruction: 'Focus on your hips and lower back. Feel the weight of your body where you\'re sitting or standing.' },
    { area: 'Stomach & Chest', instruction: 'Notice your breath moving in your belly and chest. No need to change it, just observe.' },
    { area: 'Hands & Arms', instruction: 'Bring attention to your hands and arms. Feel the temperature of your skin. Notice any sensations.' },
    { area: 'Shoulders & Neck', instruction: 'Check in with your shoulders and neck. See if you can release any tension you find there.' },
    { area: 'Face & Head', instruction: 'Notice your facial muscles. Your jaw, your forehead, your eyes. Let everything soften.' },
    { area: 'Whole Body', instruction: 'Feel your entire body as one connected whole. Take a deep breath and return to the present moment.' }
  ];

  const handleAddInput = () => {
    if (currentInput.trim()) {
      setUserInputs([...userInputs, currentInput.trim()]);
      setCurrentInput('');
    }
  };

  const handleNextStep = () => {
    if (currentExercise === '5-4-3-2-1') {
      if (step < fiveSteps.length - 1) {
        setStep(step + 1);
        setUserInputs([]);
      } else {
        handleExerciseComplete();
      }
    } else if (currentExercise === 'body-scan') {
      if (step < bodyScanSteps.length - 1) {
        setStep(step + 1);
      } else {
        handleExerciseComplete();
      }
    }
  };

  const handlePrevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleExerciseComplete = () => {
    // Log completion
    console.log('✅ Grounding exercise completed:', currentExercise);
    
    // Show completion state
    setStep(-1);
    
    // Call onComplete callback after a delay
    setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, 2000);
  };

  const startExercise = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setStep(0);
    setUserInputs([]);
  };

  const resetExercise = () => {
    setCurrentExercise(null);
    setStep(0);
    setUserInputs([]);
    setCurrentInput('');
  };

  // Exercise Selection Screen
  if (!currentExercise) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold mb-2">Grounding Exercises</h3>
          <p className="text-muted-foreground">
            Choose an exercise to help you reconnect with the present moment
          </p>
        </div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => startExercise('5-4-3-2-1')}
          className="cursor-pointer"
        >
          <Card className="p-6 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500 rounded-xl">
                <Eye className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg mb-1">5-4-3-2-1 Technique</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Use your five senses to anchor yourself in the present moment
                </p>
                <div className="flex items-center gap-2 text-xs text-blue-700">
                  <Circle className="w-3 h-3 fill-current" />
                  <span>5 minutes • Interactive</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-600" />
            </div>
          </Card>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => startExercise('body-scan')}
          className="cursor-pointer"
        >
          <Card className="p-6 border-2 border-purple-200 bg-purple-50 hover:bg-purple-100 transition-colors">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-500 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg mb-1">Body Scan</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Systematically relax your body from head to toe
                </p>
                <div className="flex items-center gap-2 text-xs text-purple-700">
                  <Circle className="w-3 h-3 fill-current" />
                  <span>8 minutes • Guided</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-purple-600" />
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Completion Screen
  if (step === -1) {
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
        <h3 className="text-2xl font-bold mb-2">Exercise Complete!</h3>
        <p className="text-muted-foreground mb-4">
          You've successfully completed the grounding exercise
        </p>
        <div className="flex items-center justify-center gap-2 text-green-600">
          <Heart className="w-5 h-5" />
          <span className="font-medium">Great job reconnecting with the present</span>
        </div>
      </motion.div>
    );
  }

  // 5-4-3-2-1 Exercise
  if (currentExercise === '5-4-3-2-1') {
    const currentStep = fiveSteps[step];
    const Icon = currentStep.icon;
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      green: 'bg-green-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500'
    };

    return (
      <div className="space-y-6">
        {/* Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Step {step + 1} of {fiveSteps.length}</span>
            <button
              onClick={resetExercise}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Choose Different Exercise
            </button>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / fiveSteps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Current Step */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card className={`p-6 border-2 border-${currentStep.color}-200 bg-${currentStep.color}-50`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 ${colorMap[currentStep.color]} rounded-xl`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold">{currentStep.title}</h3>
              </div>
              <p className="text-gray-700 mb-4">{currentStep.prompt}</p>

              {/* User Inputs */}
              <div className="space-y-2 mb-4">
                {userInputs.map((input, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200"
                  >
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{input}</span>
                  </motion.div>
                ))}
              </div>

              {/* Input Field */}
              {userInputs.length < currentStep.count && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddInput()}
                    placeholder={`${userInputs.length + 1}. Type here...`}
                    className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  <Button onClick={handleAddInput} disabled={!currentInput.trim()}>
                    Add
                  </Button>
                </div>
              )}

              {/* Counter */}
              <div className="mt-4 text-center">
                <span className="text-sm font-medium text-gray-600">
                  {userInputs.length} of {currentStep.count} completed
                </span>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button
            onClick={handleNextStep}
            disabled={currentExercise === '5-4-3-2-1' && userInputs.length < currentStep.count}
          >
            {step === fiveSteps.length - 1 ? 'Complete' : 'Next'}
            {step !== fiveSteps.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    );
  }

  // Body Scan Exercise
  if (currentExercise === 'body-scan') {
    const currentStep = bodyScanSteps[step];

    return (
      <div className="space-y-6">
        {/* Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Step {step + 1} of {bodyScanSteps.length}</span>
            <button
              onClick={resetExercise}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Choose Different Exercise
            </button>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${((step + 1) / bodyScanSteps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Current Step */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="p-8 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500 rounded-full mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{currentStep.area}</h3>
              </div>

              <div className="bg-white rounded-xl p-6 mb-6">
                <p className="text-lg text-gray-700 text-center leading-relaxed">
                  {currentStep.instruction}
                </p>
              </div>

              <div className="text-center text-sm text-purple-600 font-medium">
                Take 30-60 seconds to focus on this area
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <Button onClick={handleNextStep}>
            {step === bodyScanSteps.length - 1 ? 'Complete' : 'Next'}
            {step !== bodyScanSteps.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
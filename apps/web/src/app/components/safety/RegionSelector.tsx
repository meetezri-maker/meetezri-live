/**
 * EZRI — REGION SELECTOR
 * Allow users to set their region for appropriate safety resources
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { 
  Globe, 
  Check, 
  MapPin, 
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { 
  Region, 
  getCurrentRegion, 
  setUserRegion, 
  detectUserRegion,
  getRegionInfo 
} from '@/app/utils/safetyResources';

interface RegionSelectorProps {
  onRegionChange?: (region: Region) => void;
  showDetectedRegion?: boolean;
}

export function RegionSelector({ onRegionChange, showDetectedRegion = true }: RegionSelectorProps) {
  const [currentRegion, setCurrentRegion] = useState<Region>(getCurrentRegion());
  const [detectedRegion, setDetectedRegion] = useState<Region | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  // Detect region on mount if showDetectedRegion is true
  useEffect(() => {
    if (showDetectedRegion) {
      detectRegion();
    }
  }, [showDetectedRegion]);

  const detectRegion = async () => {
    setIsDetecting(true);
    try {
      const detected = await detectUserRegion();
      setDetectedRegion(detected);
    } catch (error) {
      console.error('Error detecting region:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleRegionSelect = (region: Region) => {
    setCurrentRegion(region);
    setUserRegion(region);
    setIsOpen(false);
    
    if (onRegionChange) {
      onRegionChange(region);
    }
  };

  const regions: Array<{
    code: Region;
    name: string;
    flag: string;
    description: string;
  }> = [
    {
      code: 'US',
      name: 'United States',
      flag: '🇺🇸',
      description: '988, Crisis Text Line, NAMI'
    },
    {
      code: 'CA',
      name: 'Canada',
      flag: '🇨🇦',
      description: '988, Kids Help Phone, Wellness Together'
    },
    {
      code: 'UK',
      name: 'United Kingdom',
      flag: '🇬🇧',
      description: 'Samaritans, Shout, PAPYRUS'
    },
    {
      code: 'AU',
      name: 'Australia',
      flag: '🇦🇺',
      description: 'Lifeline, Beyond Blue, Kids Helpline'
    },
    {
      code: 'EU',
      name: 'European Union',
      flag: '🇪🇺',
      description: '112, European Support Lines'
    },
    {
      code: 'GLOBAL',
      name: 'Global / Other',
      flag: '🌍',
      description: 'International crisis resources'
    }
  ];

  const currentRegionInfo = regions.find(r => r.code === currentRegion);
  const regionInfo = getRegionInfo(currentRegion);

  return (
    <div className="relative">
      {/* Current Region Display */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full"
      >
        <Card className="p-4 cursor-pointer hover:shadow-lg transition-all border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs text-purple-600 font-medium">Your Region</div>
                <div className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">{currentRegionInfo?.flag}</span>
                  <span>{currentRegionInfo?.name}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Emergency: {regionInfo.emergencyNumber}
                </div>
              </div>
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-5 h-5 text-purple-600" />
            </motion.div>
          </div>
        </Card>
      </motion.button>

      {/* Auto-detection notice */}
      {showDetectedRegion && detectedRegion && detectedRegion !== currentRegion && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          <Card className="p-3 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <p className="text-blue-900 font-medium mb-1">
                  Detected: {regions.find(r => r.code === detectedRegion)?.name}
                </p>
                <button
                  onClick={() => handleRegionSelect(detectedRegion)}
                  className="text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  Switch to {regions.find(r => r.code === detectedRegion)?.name}
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Region Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <Card className="p-2 shadow-2xl border-2 border-purple-200 max-h-96 overflow-y-auto">
              <div className="space-y-1">
                {regions.map((region) => (
                  <motion.button
                    key={region.code}
                    onClick={() => handleRegionSelect(region.code)}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      currentRegion === region.code
                        ? 'bg-purple-100 border-2 border-purple-500'
                        : 'hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{region.flag}</span>
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-2">
                            {region.name}
                            {detectedRegion === region.code && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                Detected
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">{region.description}</div>
                        </div>
                      </div>
                      {currentRegion === region.code && (
                        <Check className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Auto-detect button */}
              {showDetectedRegion && (
                <div className="mt-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={detectRegion}
                    disabled={isDetecting}
                    className="w-full"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {isDetecting ? 'Detecting...' : 'Auto-Detect My Region'}
                  </Button>
                </div>
              )}

              {/* Info */}
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-gray-600 text-center">
                  <Globe className="w-3 h-3 inline mr-1" />
                  Resources are tailored to your selected region
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40"
        />
      )}
    </div>
  );
}

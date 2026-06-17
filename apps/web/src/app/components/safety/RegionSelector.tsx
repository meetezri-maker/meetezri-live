/**
 * EZRI — REGION SELECTOR
 * Allow users to set their region for appropriate safety resources
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import {
  Globe,
  Check,
  MapPin,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import {
  Region,
  getCurrentRegion,
  setUserRegion,
  fetchUserGeo,
  getRegionInfo,
  getStoredGeoDetection,
  type GeoDetection,
} from '@/app/utils/safetyResources';
import { cn } from '@/lib/utils';

interface RegionSelectorProps {
  onRegionChange?: (region: Region) => void;
  showDetectedRegion?: boolean;
}

const REGIONS: Array<{
  code: Region;
  name: string;
  flag: string;
  description: string;
}> = [
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    description: '988, Crisis Text Line, NAMI',
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    description: '988, Kids Help Phone, Wellness Together',
  },
  {
    code: 'UK',
    name: 'United Kingdom',
    flag: '🇬🇧',
    description: 'Samaritans, Shout, PAPYRUS',
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    description: 'Lifeline, Beyond Blue, Kids Helpline',
  },
  {
    code: 'EU',
    name: 'European Union',
    flag: '🇪🇺',
    description: '112, European Support Lines',
  },
  {
    code: 'GLOBAL',
    name: 'Global / Other',
    flag: '🌍',
    description: 'International crisis resources',
  },
];

function regionLabel(region: Region): string {
  return REGIONS.find((r) => r.code === region)?.name ?? region;
}

function formatGeoSource(source: GeoDetection['source']): string {
  if (source === 'ip') return 'IP address';
  if (source === 'timezone') return 'device timezone';
  return 'fallback';
}

export function RegionSelector({ onRegionChange, showDetectedRegion = true }: RegionSelectorProps) {
  const [currentRegion, setCurrentRegion] = useState<Region>(getCurrentRegion());
  const [geoDetection, setGeoDetection] = useState<GeoDetection | null>(() => getStoredGeoDetection());
  const [isOpen, setIsOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (showDetectedRegion) {
      void detectRegion();
    }
  }, [showDetectedRegion]);

  const detectRegion = async () => {
    setIsDetecting(true);
    try {
      const detection = await fetchUserGeo();
      setGeoDetection(detection);
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
    onRegionChange?.(region);
  };

  const currentRegionInfo = REGIONS.find((r) => r.code === currentRegion);
  const regionInfo = getRegionInfo(currentRegion);
  const detectedRegion = geoDetection?.region ?? null;
  const detectedRegionInfo = detectedRegion ? REGIONS.find((r) => r.code === detectedRegion) : null;

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full text-left"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          >
            <Card
              className={cn(
                'cursor-pointer p-4 transition-all',
                'border border-white/10 bg-white/[0.04] backdrop-blur-sm',
                'hover:bg-white/[0.06] hover:shadow-[0_18px_60px_-28px_rgba(168,85,247,0.55)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/30">
                    <MapPin className="h-5 w-5 text-violet-100" aria-hidden />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white/60">Your Region</div>
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <span className="text-2xl" aria-hidden>
                        {currentRegionInfo?.flag}
                      </span>
                      <span>{currentRegionInfo?.name}</span>
                    </div>
                    <div className="text-xs text-white/50">
                      Emergency: {regionInfo.emergencyNumber}
                    </div>
                    {showDetectedRegion && geoDetection ? (
                      <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-xs text-white/55">
                        <p>
                          <span className="text-white/45">Detected IP:</span>{' '}
                          <span className="font-mono text-white/80">
                            {geoDetection.ip ?? 'Unavailable'}
                          </span>
                        </p>
                        <p>
                          <span className="text-white/45">Country:</span>{' '}
                          <span className="text-white/80">
                            {geoDetection.countryCode
                              ? `${geoDetection.countryCode}${geoDetection.countryName ? ` (${geoDetection.countryName})` : ''}`
                              : 'Unknown'}
                          </span>
                        </p>
                        <p>
                          <span className="text-white/45">Detected region:</span>{' '}
                          <span className="text-white/80">
                            {detectedRegionInfo
                              ? `${detectedRegionInfo.flag} ${detectedRegionInfo.name}`
                              : regionLabel(geoDetection.region)}
                          </span>
                          <span className="text-white/40"> · via {formatGeoSource(geoDetection.source)}</span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  aria-hidden
                >
                  <ChevronDown className="h-5 w-5 text-white/70" />
                </motion.div>
              </div>
            </Card>
          </motion.button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className={cn(
            'z-[250] w-[var(--radix-popover-trigger-width)] max-h-96 overflow-y-auto p-2',
            'border border-white/10 bg-[#0B0613]/98 text-white shadow-2xl backdrop-blur-xl',
          )}
        >
          <div className="space-y-1" role="listbox" aria-label="Select your region">
            {REGIONS.map((region) => (
              <button
                type="button"
                key={region.code}
                role="option"
                aria-selected={currentRegion === region.code}
                onClick={() => handleRegionSelect(region.code)}
                className={cn(
                  'w-full rounded-lg p-3 text-left transition-colors',
                  currentRegion === region.code
                    ? 'border border-violet-300/30 bg-violet-500/10'
                    : 'border border-transparent hover:bg-white/[0.06]',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-3xl shrink-0" aria-hidden>
                      {region.flag}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 font-semibold text-white">
                        <span>{region.name}</span>
                        {detectedRegion === region.code ? (
                          <span className="rounded-full border border-cyan-300/20 bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-100">
                            Detected
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-white/55">{region.description}</div>
                    </div>
                  </div>
                  {currentRegion === region.code ? (
                    <Check className="h-5 w-5 shrink-0 text-violet-200" aria-hidden />
                  ) : null}
                </div>
              </button>
            ))}
          </div>

          {showDetectedRegion ? (
            <div className="mt-2 border-t border-white/10 pt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void detectRegion()}
                disabled={isDetecting}
                className="w-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.06]"
              >
                <Globe className="mr-2 h-4 w-4" aria-hidden />
                {isDetecting ? 'Detecting...' : 'Auto-Detect My Region'}
              </Button>
            </div>
          ) : null}

          <p className="mt-2 border-t border-white/10 pt-2 text-center text-xs text-white/50">
            <Globe className="mr-1 inline h-3 w-3 text-white/50" aria-hidden />
            Resources are tailored to your selected region
          </p>
        </PopoverContent>
      </Popover>

      {showDetectedRegion && geoDetection && detectedRegion && detectedRegion !== currentRegion ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          <Card className="border border-cyan-300/20 bg-cyan-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
              <div className="flex-1 text-sm">
                <p className="mb-1 font-medium text-white/90">
                  Detected {regionLabel(detectedRegion)}
                  {geoDetection.countryCode ? ` (${geoDetection.countryCode})` : ''}
                  {geoDetection.ip ? ` from ${geoDetection.ip}` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => handleRegionSelect(detectedRegion)}
                  className="font-medium text-cyan-200 underline underline-offset-2 hover:text-cyan-100"
                >
                  Switch to {regionLabel(detectedRegion)}
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}
    </div>
  );
}

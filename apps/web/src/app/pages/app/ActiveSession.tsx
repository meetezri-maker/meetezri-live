import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Sparkles,
  Circle,
  AlertCircle,
  Maximize,
  Volume2,
  VolumeX,
  Settings,
  Camera,
  Check,
  X,
  Clock,
  Zap,
  Crown,
  ArrowRight,
  Heart,
  Pause,
  Play,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/app/components/ui/button";
import { useSafety } from "@/app/contexts/SafetyContext";
import { useAuth } from "@/app/contexts/AuthContext";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { analyzeTextForSafety } from "@/app/utils/safetyDetection";
import { SafetyStateIndicator } from "@/app/components/safety/SafetyStateIndicator";
import { SafetyBoundaryMessage } from "@/app/components/safety/SafetyBoundaryMessage";
import { SafetyResourceCard } from "@/app/components/safety/SafetyResourceCard";
import { getSafetyResources } from "@/app/utils/safetyResources";
import { LowMinutesWarning } from "@/app/components/modals/LowMinutesWarning";

import * as THREE from "three"; 
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const AVATAR_MODEL_PATH = "/C1v4.glb";

function ThreeAvatar({ isSpeaking, audioLevel }: { isSpeaking: boolean; audioLevel: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const baseScaleRef = useRef<number>(1);
  const morphMeshesRef = useRef<THREE.Mesh[]>([]);
  const morphTargetIndexRef = useRef<number>(0);
  const jawBoneRef = useRef<THREE.Bone | null>(null);
  const mouthOpenRef = useRef<number>(0);
  const mouthSmoothedRef = useRef<number>(0);
  const blinkTargetsRef = useRef<{ mesh: THREE.Mesh; index: number }[]>([]);
  const eyelidBonesRef = useRef<THREE.Bone[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(3, 5, 5);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(-3, 2, 4);
    scene.add(fillLight);

    const loader = new GLTFLoader();

    loader.load(
      AVATAR_MODEL_PATH,
      (gltf) => {
        const model = gltf.scene;

        morphMeshesRef.current = [];
        jawBoneRef.current = null;
        blinkTargetsRef.current = [];
        eyelidBonesRef.current = [];
        mouthSmoothedRef.current = 0;
        mouthOpenRef.current = 0;

        model.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.morphTargetInfluences && child.morphTargetInfluences.length > 0) {
              morphMeshesRef.current.push(child);

              const dict = child.morphTargetDictionary || {};
              const entries = Object.entries(dict) as [string, number][];

              const mouthEntry =
                entries.find(([name]) =>
                  /mouth|jaw|viseme|aa|ah|oh|ee|ih|uh/i.test(name)
                ) || entries[0];

              if (mouthEntry) {
                morphTargetIndexRef.current = mouthEntry[1];
                console.log("[Avatar] Using mouth morph target:", mouthEntry[0], "on mesh", child.name);
              }

              entries.forEach(([name, index]) => {
                if (/(blink|eyeBlink|eyelid|lid)/i.test(name)) {
                  blinkTargetsRef.current.push({ mesh: child, index });
                  console.log("[Avatar] Found blink morph target:", name, "on mesh", child.name);
                }
              });
            }
          }

          if ((child as any).isBone) {
            const name = child.name || "";

            if (/jaw|mouth|chin/i.test(name)) {
              jawBoneRef.current = child as THREE.Bone;
              console.log("[Avatar] Found jaw bone:", name);
            }

            if (/(eyelid|upperlid|lowerlid|eyeLid|EyeLid|Lid)/i.test(name)) {
              eyelidBonesRef.current.push(child as THREE.Bone);
              console.log("[Avatar] Found eyelid bone:", name);
            }
          }
        });

        console.log("morphMeshesRef", morphMeshesRef.current);
        console.log("jawBoneRef", jawBoneRef.current);
        console.log("blinkTargetsRef", blinkTargetsRef.current);
        console.log("eyelidBonesRef", eyelidBonesRef.current);

        if (morphMeshesRef.current.length === 0 && !jawBoneRef.current) {
          console.warn(
            "[Avatar] No morph targets or jaw/mouth bones detected on C1.glb. Lip sync will not animate."
          );
        }

        if (blinkTargetsRef.current.length === 0 && eyelidBonesRef.current.length === 0) {
          console.warn(
            "[Avatar] No blink morph targets or eyelid bones detected on C1.glb. Blinking will not animate."
          );
        }

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        model.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetViewHeight = 2.5;
        const baseScale = targetViewHeight / maxDim;
        baseScaleRef.current = baseScale;
        model.scale.setScalar(baseScale);

        modelRef.current = model;
        scene.add(model);

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledSize = new THREE.Vector3();
        const scaledCenter = new THREE.Vector3();
        scaledBox.getSize(scaledSize);
        scaledBox.getCenter(scaledCenter);

        const portraitHeight = scaledSize.y * 0.38;
        const fovRad = (camera.fov * Math.PI) / 180;
        const distance = (portraitHeight / 2) / Math.tan(fovRad / 2);

        const lookAtY = scaledCenter.y + scaledSize.y * 0.34;

        camera.position.set(scaledCenter.x, lookAtY, distance * 1.25);
        camera.lookAt(new THREE.Vector3(scaledCenter.x, lookAtY, scaledCenter.z));
        camera.updateProjectionMatrix();
      },
      undefined,
      (error) => {
        console.error("Failed to load avatar model:", error);
      }
    );

    const handleResize = () => {
      if (!container || !rendererRef.current) return;

      const newWidth = container.clientWidth || 800;
      const newHeight = container.clientHeight || 600;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);

      const target = mouthOpenRef.current;
      const previous = mouthSmoothedRef.current;
      const smoothed = previous + (target - previous) * 0.6;
      mouthSmoothedRef.current = smoothed;
      const mouth = smoothed;

      if (morphMeshesRef.current.length > 0) {
        const index = morphTargetIndexRef.current;
        const amplifiedMouth = Math.min(1, Math.max(0, mouth * 1.9));

        morphMeshesRef.current.forEach((mesh) => {
          if (mesh.morphTargetInfluences && index < mesh.morphTargetInfluences.length) {
            mesh.morphTargetInfluences[index] = amplifiedMouth;
          }
        });
      } else if (jawBoneRef.current) {
        jawBoneRef.current.rotation.x = -1.15 * mouth;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }

      window.removeEventListener("resize", handleResize);

      if (modelRef.current) {
        scene.remove(modelRef.current);
        modelRef.current.traverse((child: any) => {
          if (child.isMesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m: any) => m.dispose?.());
            } else {
              child.material?.dispose?.();
            }
          }
        });
      }

      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!modelRef.current) return;
    const multiplier = isSpeaking ? 1.03 : 1;
    modelRef.current.scale.setScalar(baseScaleRef.current * multiplier);
  }, [isSpeaking]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const scheduleBlink = () => {
      if (cancelled) return;

      const delay = 2500 + Math.random() * 2500;
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;

        if (blinkTargetsRef.current.length === 0 && eyelidBonesRef.current.length === 0) {
          scheduleBlink();
          return;
        }

        const start = performance.now();
        const duration = 180;

        const animateBlink = (time: number) => {
          if (cancelled) return;

          const t = Math.min(1, (time - start) / duration);
          const phase = t < 0.5 ? t * 2 : (1 - t) * 2;
          const blinkAmount = phase;

          blinkTargetsRef.current.forEach(({ mesh, index }) => {
            if (mesh.morphTargetInfluences && index < mesh.morphTargetInfluences.length) {
              mesh.morphTargetInfluences[index] = blinkAmount;
            }
          });

          eyelidBonesRef.current.forEach((bone) => {
            bone.rotation.x = 0.35 * blinkAmount;
          });

          if (t < 1) {
            requestAnimationFrame(animateBlink);
          } else {
            scheduleBlink();
          }
        };

        requestAnimationFrame(animateBlink);
      }, delay);
    };

    scheduleBlink();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSpeaking) {
      mouthOpenRef.current = 0;
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;

      const base =
        Math.sin(elapsed * 12) * 0.55 +
        Math.sin(elapsed * 19) * 0.3 +
        0.8;

      const target = Math.min(1, Math.max(0.22, base));
      mouthOpenRef.current = target;
    }, 1000 / 30);

    return () => {
      clearInterval(interval);
      mouthOpenRef.current = 0;
    };
  }, [isSpeaking]);

  return <div ref={containerRef} className="w-full h-full min-h-[500px]" />;
}

export default ThreeAvatar;

export function ActiveSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { sessionId: stateSessionId, duration, config } = location.state || {};

  const permissionStorageKey = useMemo(() => {
    if (typeof window === "undefined") return "ezri_media_permissions";
    if (!user?.id) return "ezri_media_permissions";
    return `ezri_media_permissions_${user.id}`;
  }, [user?.id]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { currentState, updateState } = useSafety();
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSoundOff, setIsSoundOff] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [isEzriSpeaking, setIsEzriSpeaking] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<"excellent" | "good" | "poor">("excellent");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionStateInitialized, setPermissionStateInitialized] = useState(false);
  const [transcript, setTranscript] = useState<{role: string, content: string, timestamp: number}[]>([]);
  const speechTimeoutRef = useRef<number | null>(null);
  const isMutedRef = useRef(isMuted);
  const isSessionPausedRef = useRef(false);
  const scriptStepRef = useRef(0);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isEzriSpeakingRef = useRef(false);
  const speechEndTimeoutRef = useRef<number | null>(null);
  const transcriptRef = useRef<{role: string, content: string, timestamp: number}[]>([]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const lastSpeechStartRef = useRef(0);
  const isRecognitionActiveRef = useRef(false);
  const isSessionEndingRef = useRef(false);

  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);

  // Audio Visualizer
  useEffect(() => {
    if (!stream) return;
    
    let animationFrameId: number;
    let audioContext: AudioContext;

    try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const updateAudioLevel = () => {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            // Normalize for visualization (0-50 range roughly)
            setAudioLevel(average); 
            animationFrameId = requestAnimationFrame(updateAudioLevel);
        };
        
        updateAudioLevel();
    } catch (e) {
        console.error("Audio visualizer error:", e);
    }
    
    return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
    };
  }, [stream]);

  const speakAvatar = (text: string) => {
    // Debug toast
    console.log("speakAvatar called with:", text);
    setCurrentSubtitle(text);
    
    if (isSoundOff) return;
    if (typeof window === "undefined") return;
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) {
        toast.error("Speech synthesis not supported");
        return;
    }
    try {
      // Cancel any ongoing speech first
      if (synth.speaking || synth.pending) {
        // Prevent old onend from clearing our new subtitle
        currentUtteranceRef.current = null;
        synth.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      // Keep reference to prevent garbage collection
      currentUtteranceRef.current = utterance;
      
      utterance.rate = 1;
      utterance.pitch = 1;
      
      // Select voice if available
      const voices = synth.getVoices();
      const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || 
                             voices.find(v => v.lang.startsWith('en'));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      // Calculate estimated duration for safety timeout (avg 2.5 words/sec + buffer)
      const wordCount = text.split(/\s+/).length;
      const estimatedDurationMs = Math.max(3000, (wordCount / 2.5) * 1000 + 2000);

      utterance.onstart = () => {
        console.log("Speech started");
        setIsEzriSpeaking(true);
        isEzriSpeakingRef.current = true;
        
        // Stop recognition while speaking to prevent self-triggering
        if (recognitionRef.current && isListening) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore stop errors
          }
        }
        
        if (speechEndTimeoutRef.current) {
            window.clearTimeout(speechEndTimeoutRef.current);
        }
        // Safety timeout to reset state if onend never fires
        speechEndTimeoutRef.current = window.setTimeout(() => {
            console.warn(`Speech synthesis timed out after ${estimatedDurationMs}ms, forcing reset`);
            if (isEzriSpeakingRef.current) {
                setIsEzriSpeaking(false);
                isEzriSpeakingRef.current = false;
                if (currentUtteranceRef.current === utterance) {
                    currentUtteranceRef.current = null;
                    setCurrentSubtitle(null);
                }
                // Force cancel to be safe
                synth.cancel();
                // Restart recognition
                if (recognitionRef.current && !isListening) {
                    try { recognitionRef.current.start(); } catch(e) {}
                }
            }
        }, estimatedDurationMs);
      };
      
      utterance.onend = () => {
        if (speechEndTimeoutRef.current) {
            window.clearTimeout(speechEndTimeoutRef.current);
        }
        setIsEzriSpeaking(false);
        isEzriSpeakingRef.current = false;
        
        if (currentUtteranceRef.current === utterance) {
            currentUtteranceRef.current = null;
            setCurrentSubtitle(null);
        }
        
        // Restart recognition after speaking
        if (recognitionRef.current && !isListening) {
             try {
               recognitionRef.current.start();
             } catch (e) {
               console.error("Failed to restart recognition after speech:", e);
             }
        }
      };
      
      utterance.onerror = (e) => {
        console.error("Speech synthesis error:", e);
        if (speechEndTimeoutRef.current) {
            window.clearTimeout(speechEndTimeoutRef.current);
        }
        setIsEzriSpeaking(false);
        isEzriSpeakingRef.current = false;
        
        if (currentUtteranceRef.current === utterance) {
            currentUtteranceRef.current = null;
            setCurrentSubtitle(null);
        }
        
        // Restart recognition after error
        if (recognitionRef.current && !isListening) {
             try {
               recognitionRef.current.start();
             } catch (e) {
               console.error("Failed to restart recognition after error:", e);
             }
        }
      };

      synth.speak(utterance);
      
      // Force resume in case it was paused/stuck (Chrome bug workaround)
      if (synth.paused) {
        synth.resume();
      }
    } catch (error) {
      console.error("Failed to play avatar audio:", error);
      setIsEzriSpeaking(false);
      isEzriSpeakingRef.current = false;
      // Ensure recognition is running
      if (recognitionRef.current && !isListening) {
          try { recognitionRef.current.start(); } catch(e) {}
      }
    }
  };

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return;
    if (isSoundOff) {
      try {
        synth.cancel();
      } catch {
      }
    }
  }, [isSoundOff]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return;
    if (!isMuted && !isSoundOff) {
      try {
        synth.resume();
      } catch {
      }
    }
  }, [isMuted, isSoundOff]);

  useEffect(() => {
    if (permissionStateInitialized) return;

    if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
      setShowPermissionRequest(true);
      setPermissionStateInitialized(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(permissionStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed === true || parsed === "granted") {
          setPermissionsGranted(true);
          setShowPermissionRequest(false);
          setPermissionStateInitialized(true);
          return;
        }
      }
      setShowPermissionRequest(true);
    } catch (error) {
      console.error("Failed to load media permission setting:", error);
      setShowPermissionRequest(true);
    } finally {
      setPermissionStateInitialized(true);
    }
  }, [permissionStorageKey, permissionStateInitialized]);

  useEffect(() => {
    if (!permissionsGranted) return;

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("Speech recognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log("Speech recognition started");
      lastSpeechStartRef.current = Date.now();
      setIsListening(true);
      isRecognitionActiveRef.current = true;
      toast.info("Microphone Active");
    };

    recognition.onsoundstart = () => {
        console.log("SpeechRecognition: Sound detected");
    };
    
    recognition.onsoundend = () => {
        console.log("SpeechRecognition: Sound ended");
    };

    recognition.onresult = (event: any) => {
      if (isMutedRef.current || isSessionPausedRef.current || isEzriSpeakingRef.current) {
        if (isEzriSpeakingRef.current) console.log("Ignored speech: Ezri is speaking");
        return;
      }
      
      const current = event.resultIndex;
      const result = event.results[current];
      const transcriptText = result[0].transcript;
      const isFinal = result.isFinal;
      
      if (transcriptText.trim()) {
        const trimmed = transcriptText.trim();
        
        // Show interim results for feedback
          if (!isFinal) {
               console.log("Interim:", trimmed);
               toast(`Listening: "${trimmed}"`, { id: 'speech-interim' });
               return;
          }
 
         const lowerTrimmed = trimmed.toLowerCase();
         
         console.log("Heard (Final):", lowerTrimmed, "Current Step:", scriptStepRef.current);
         // Visual feedback
         toast.success(`Heard: "${trimmed}"`, { id: 'speech-interim', duration: 2000 });

        setTranscript(prev => {
          const lastEntry = prev[prev.length - 1];
          if (lastEntry && lastEntry.content === trimmed && (Date.now() - lastEntry.timestamp < 1000)) {
            return prev;
          }
          
          return [
            ...prev,
            {
              role: "user",
              content: trimmed,
              timestamp: Date.now(),
            },
          ];
        });
        
        // Don't set isEzriSpeaking(true) here immediately, wait for speakAvatar
        if (speechTimeoutRef.current) {
          window.clearTimeout(speechTimeoutRef.current);
        }
        
        // Script logic with Fallbacks
        let assistantText = "";
        const currentStep = scriptStepRef.current;
        let nextStep = currentStep;

        // COMMAND: Echo/Repeat/Test (User requested feature for testing)
        if (lowerTrimmed === "repeat question" || lowerTrimmed === "what did you say" || lowerTrimmed === "say that again") {
             // Find last assistant message
             const lastAssistant = transcriptRef.current.slice().reverse().find(t => t.role === "assistant");
             if (lastAssistant) {
                 assistantText = lastAssistant.content;
             } else {
                 assistantText = "I haven't said anything yet.";
             }
             nextStep = currentStep;
        }
        else if (lowerTrimmed.includes("repeat") || lowerTrimmed.startsWith("say ")) {
             assistantText = trimmed;
             nextStep = currentStep; // Stay on current step
        }
        else if (lowerTrimmed.includes("hear me") || lowerTrimmed.includes("listening")) {
             assistantText = `Yes, I can hear you. I heard: "${trimmed}".`;
             nextStep = currentStep;
        }
        else if (lowerTrimmed === "test" || lowerTrimmed.includes("testing")) {
             assistantText = "Test received. I am listening and ready.";
             nextStep = currentStep;
        }
        // "Draining Day" Script
        else if (currentStep === 0) {
            assistantText = "Hey. How’s today treating you?";
            nextStep = 1;
        } else if (currentStep === 1) {
            // Context: "How's today treating you?"
            if (lowerTrimmed.match(/(long|busy|draining|tough|hard|bad|terrible|awful|stress|tired|exhausted|shitty|crap|sad|rough|difficult)/)) {
                assistantText = "Long as in busy… or long as in draining?";
                nextStep = 2;
            } else if (lowerTrimmed.match(/(good|great|fine|okay|ok|well|nice|awesome|amazing|happy|calm|peaceful|alright|not bad)/)) {
                assistantText = "I'm glad to hear that. Even on good days, it helps to pause. What's been the best part?";
                nextStep = 10; // Branch for positive day
            } else {
                // Fallback: Assume it might be complex or negative if not explicitly good
                assistantText = `I hear you saying "${trimmed}". Sometimes days just blur together. Would you say it's been more draining, or just busy?`;
                nextStep = 2; // Advance to next step anyway to keep conversation moving
            }
        } else if (currentStep === 2) {
            // Context: "Long as in busy... or draining?"
            if (lowerTrimmed.match(/(draining|exhausting|tired|both|heavy|mental|emotional|soul|spirit)/)) {
                assistantText = "That kind of day sticks to you. What took most of your energy?";
                nextStep = 3;
            } else if (lowerTrimmed.match(/(busy|work|lot|time|rushed|hurried|chaos|crazy|hectic)/)) {
                assistantText = "Busyness can be its own kind of heavy. What took up most of your time?";
                nextStep = 3;
            } else {
                assistantText = `Yeah, "${trimmed}" adds up. What took the most energy out of you today?`;
                nextStep = 3;
            }
        } else if (currentStep === 3) {
            // Context: "What took most of your energy?"
            if (lowerTrimmed.match(/(work|meeting|job|boss|colleague|email|deadline|project|client|customer)/)) {
                assistantText = "Too many conversations and not enough breathing space?";
                nextStep = 4;
            } else {
                assistantText = "That sounds heavy. Does it feel like you didn't have enough breathing space?";
                nextStep = 4;
            }
        } else if (currentStep === 4) {
            // Context: "Not enough breathing space?"
            if (lowerTrimmed.match(/(exactly|yes|yeah|yep|right|totally|definitely|sure|absolutely|maybe|sort of|kind of)/)) {
                assistantText = "Yeah. That builds up. Did anything today feel even slightly good?";
                nextStep = 5;
            } else {
                assistantText = "I understand. Amidst all that, did anything today feel even slightly good?";
                nextStep = 5;
            }
        } else if (currentStep === 5) {
            // Context: "Did anything feel good?"
            if (lowerTrimmed.match(/(coffee|friend|lunch|break|walk|tea|sun|weather|music|song|food|meal|dinner|sleep|nap|cat|dog|pet|kids|child|partner|spouse)/)) {
                assistantText = "There it is. What about it felt different from the rest of the day?";
                nextStep = 6;
            } else if (lowerTrimmed.match(/(no|nothing|not really|nope|none|nada)/)) {
                 assistantText = "That's honest. Sometimes we just need to get through it. If you could have 20 minutes of calm tonight, what would you do?";
                 nextStep = 7;
            } else {
                assistantText = "It's important to notice those moments. What about it felt different?";
                nextStep = 6;
            }
        } else if (currentStep === 6) {
            // Context: "What felt different?"
            if (lowerTrimmed.match(/(calm|peace|quiet|relax|pressure|slow|happy|joy|smile|laugh|fun|safe|warm)/)) {
                assistantText = "So calm exists in your day. It just gets crowded out. If tonight had even 20 minutes of that same calm… what would you do?";
                nextStep = 7;
            } else {
                 assistantText = "That feeling is worth holding onto. If tonight had even 20 minutes of that... what would you do?";
                 nextStep = 7;
            }
        } else if (currentStep === 7) {
            // Context: "What would you do with 20 mins?"
            if (lowerTrimmed.match(/(sit|quiet|phone|nothing|read|sleep|rest|bath|shower|meditate|tv|watch|movie|game|play|music|listen)/)) {
                assistantText = "That sounds like your nervous system asking for a reset. You don’t need to solve your whole life tonight. Just protect those 20 minutes.";
                nextStep = 8;
            } else {
                assistantText = "That sounds exactly like what you need. A reset. You don’t need to solve everything tonight. Just protect those 20 minutes.";
                nextStep = 8;
            }
        } else if (currentStep === 8) {
             // Context: "Protect those 20 mins."
             assistantText = "Good. Then let’s make that the goal for today. Nothing dramatic. Just quiet.";
             nextStep = 9; // End of script
        } else if (currentStep === 10) {
             // Positive branch: "What's been the best part?"
             assistantText = "That sounds lovely. Holding onto that feeling can help carry you through the rest of the week.";
             nextStep = 9;
        }

        // If no assistant text generated (e.g. unexpected step), use a generic prompt
        if (!assistantText) {
             if (trimmed.endsWith("?")) {
                 assistantText = `I heard you ask: "${trimmed}". Let's focus on your day for now.`;
             } else {
                 assistantText = `I heard: "${trimmed}". Please go on.`;
             }
        }

        // Update step ref
        scriptStepRef.current = nextStep;

        speechTimeoutRef.current = window.setTimeout(() => {
          setTranscript(prev => [
            ...prev,
            {
              role: "assistant",
              content: assistantText,
              timestamp: Date.now(),
            },
          ]);
          speakAvatar(assistantText);
        }, 1500);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      // Auto-restart if permissions are still granted, NOT speaking, and session is active
      if (permissionsGranted && !isEzriSpeakingRef.current && !isSessionEndingRef.current) {
        // Prevent rapid loops: if session started < 1s ago, add longer delay
        const sessionDuration = Date.now() - lastSpeechStartRef.current;
        const restartDelay = sessionDuration < 1000 ? 2000 : 500;
        
        console.log(`Speech recognition ended (ran for ${sessionDuration}ms), restarting in ${restartDelay}ms...`);
        
        setTimeout(() => {
          if (isSessionEndingRef.current) return;
          try {
            if (!isEzriSpeakingRef.current && recognitionRef.current && !isRecognitionActiveRef.current) {
              recognitionRef.current.start();
            }
          } catch (e) {
            console.error("Failed to restart speech recognition", e);
          }
        }, restartDelay);
      }
    };

    try {
      console.log("Starting speech recognition...");
      if (!isSessionEndingRef.current && !isRecognitionActiveRef.current) {
        recognition.start();
      }
    } catch (e) {
      console.error("Failed to start speech recognition", e);
    }

    return () => {
      recognition.onend = null; 
      try {
        recognition.stop();
      } catch (e) {
      }
      setIsListening(false);
      isRecognitionActiveRef.current = false;
      recognitionRef.current = null;
    };
  }, [permissionsGranted]);

  // Watchdog to ensure recognition stays alive and check audio input
  useEffect(() => {
    if (!permissionsGranted) return;
    
    const watchdog = setInterval(() => {
        // Recognition Restart Logic
        if (!isSessionEndingRef.current && !isListening && !isEzriSpeakingRef.current && recognitionRef.current && !isRecognitionActiveRef.current) {
            console.log("Watchdog: Recognition stopped unexpectedly, restarting...");
            try {
                recognitionRef.current.start();
            } catch (e) {
                // Ignore errors like "already started"
            }
        }
        
        // Audio Level Check (if "Listening" but silent for too long)
        if (isListening && audioLevel < 2 && !isEzriSpeakingRef.current) {
            // Only warn occasionally or just log for now
            console.warn("Watchdog: Microphone seems silent despite 'Listening' state.");
        }
    }, 5000);
    
    return () => clearInterval(watchdog);
  }, [permissionsGranted, isListening, audioLevel]);

  // Initial Greeting - Start conversation automatically
  useEffect(() => {
    if (permissionsGranted && scriptStepRef.current === 0 && transcript.length === 0) {
      const initialText = "Hey. How’s today treating you?";
      
      // Delay slightly to ensure audio context is ready and user is settled
      const timer = setTimeout(() => {
        // Update script step to expect answer about day
        scriptStepRef.current = 1;
        
        // Update transcript
        setTranscript(prev => [
          ...prev,
          {
            role: "assistant",
            content: initialText,
            timestamp: Date.now(),
          },
        ]);
        
        // Speak
        speakAvatar(initialText);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [permissionsGranted, transcript.length]);
  
  // Media Stream Initialization
  useEffect(() => {
    if (permissionsGranted && !stream) {
      const initMedia = async () => {
        try {
          const userStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
          setStream(userStream);
          if (videoRef.current) {
            videoRef.current.srcObject = userStream;
          }

        } catch (err) {
          console.error("Failed to access media devices:", err);
          toast.error("Failed to access camera/microphone");
          setPermissionsGranted(false);
          setShowPermissionRequest(true);
          try {
            if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
              window.localStorage.removeItem(permissionStorageKey);
            }
          } catch (error) {
            console.error("Failed to clear media permission setting:", error);
          }
        }
      };
      initMedia();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [permissionsGranted, stream]);

  // Handle toggling tracks when state changes
  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });
    }
  }, [isMuted, isCameraOff, stream]);

  // Safety-related state
  const [showSafetyBoundary, setShowSafetyBoundary] = useState(false);
  const [showSafetyResources, setShowSafetyResources] = useState(false);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  const [lastSafetyState, setLastSafetyState] = useState(currentState);

  useEffect(() => {
    isSessionPausedRef.current = isSessionPaused;
  }, [isSessionPaused]);

  // Credits tracking
  const [creditsRemaining, setCreditsRemaining] = useState(duration || 0);
  const [showLowCreditsWarning, setShowLowCreditsWarning] = useState(false);
  const [showOutOfCredits, setShowOutOfCredits] = useState(false);
  const [showLowMinutesModal, setShowLowMinutesModal] = useState(false);
  const [hasShownLowMinutesModal, setHasShownLowMinutesModal] = useState(false);
  const previousConnectionQuality = useRef(connectionQuality);

  useEffect(() => {
    const loadCredits = async () => {
      try {
        const { credits } = await api.getCredits();
        if (credits !== undefined) {
          setCreditsRemaining(credits);
        }
      } catch (err) {
        console.error("Failed to load credits:", err);
      }
    };
    loadCredits();
  }, []);

  // Session tracking
  const [sessionId] = useState(() => stateSessionId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [sessionStartTime] = useState(Date.now());

  // Current AI Avatar Info (would come from user preferences)
  const currentAvatar = {
    name: config?.avatar || "Maya Chen",
    status: "listening"
  };

  // Safety resources
  const safetyResources = getSafetyResources();

  // Detect safety state changes
  useEffect(() => {
    if (currentState !== lastSafetyState) {
      // State changed - show boundary message
      if (currentState !== 'NORMAL') {
        setShowSafetyBoundary(true);
      }
      
      // Auto-show resources for critical states
      if (currentState === 'HIGH_RISK' || currentState === 'SAFETY_MODE') {
        setShowSafetyResources(true);
      }
      
      setLastSafetyState(currentState);
    }
  }, [currentState, lastSafetyState]);

  // Mock voice analysis - simulates analyzing user speech
  // In production, this would be connected to real-time voice transcription
  useEffect(() => {
    // Simulate periodic safety analysis during conversation
    const analysisInterval = setInterval(() => {
      // Mock phrases that might be spoken (for testing)
      const mockPhrases = [
        "I'm feeling okay today",
        "Things have been really hard lately",
        "I'm struggling with everything",
        "I don't know if I can keep going",
      ];
      
      // Randomly analyze a phrase (30% chance every 10 seconds)
      if (Math.random() < 0.3 && !isSessionPaused) {
        const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
        const analysis = analyzeTextForSafety(randomPhrase, currentState);
        
        if (analysis.confidence > 0.6 && analysis.suggestedState !== currentState) {
          updateState(
            analysis.suggestedState,
            'conversation_analysis',
            analysis.detectedSignals
          );
        }
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(analysisInterval);
  }, [currentState, isSessionPaused, updateState]);

  // Session timer & credit deduction
  useEffect(() => {
    if (isSessionPaused) return; // Don't count time when paused
    
    const timer = setInterval(() => {
      setSessionTime((prev) => {
        const newTime = prev + 1;
        
        // Deduct 1 credit every 60 seconds (1 minute)
        if (newTime > 0 && newTime % 60 === 0) {
          setCreditsRemaining((prevCredits: number) => Math.max(0, prevCredits - 1));
        }
        
        return newTime;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isSessionPaused]);

  // Handle low credits warnings
  useEffect(() => {
    // Show low credits warning at 10 minutes
    if (creditsRemaining === 10 && !showLowCreditsWarning) {
      setShowLowCreditsWarning(true);
    }
    
    // Show out of credits modal at 0
    if (creditsRemaining === 0 && !showOutOfCredits) {
      setShowOutOfCredits(true);
    }

    if (creditsRemaining > 0 && creditsRemaining <= 3 && !hasShownLowMinutesModal) {
      setShowLowMinutesModal(true);
      setHasShownLowMinutesModal(true);
    }
  }, [creditsRemaining, showLowCreditsWarning, showOutOfCredits, hasShownLowMinutesModal]);

  useEffect(() => {
    const previous = previousConnectionQuality.current;
    if (previous === connectionQuality) {
      return;
    }

    if ((previous === "excellent" || previous === "good") && connectionQuality === "poor") {
      toast.info("Your connection seems unstable. Video quality may be affected.");
    }

    if (previous === "poor" && (connectionQuality === "good" || connectionQuality === "excellent")) {
      toast.success("Connection improved. You are back to a stable connection.");
    }

    previousConnectionQuality.current = connectionQuality;
  }, [connectionQuality]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEndSession = async () => {
    isSessionEndingRef.current = true;
    // Stop recognition and prevent any further restarts
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {
      }
      isRecognitionActiveRef.current = false;
      setIsListening(false);
    }

    setIsUploading(true);
    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - sessionStartTime) / 1000);
    
    try {
      await api.sessions.end(sessionId, durationSeconds, undefined, transcript);
      
      toast.success("Session ended successfully");
      
    } catch (error) {
      console.error("Failed to end session:", error);
      toast.error("Failed to save session data");
    } finally {
      setIsUploading(false);
    }

    // Check if cooldown is needed based on safety state
    const needsCooldown = currentState === 'HIGH_RISK' || currentState === 'SAFETY_MODE';
    
    if (needsCooldown) {
      // Navigate to cooldown screen
      navigate('/app/settings/cooldown-screen', {
        state: {
          sessionId,
          safetyLevel: currentState,
          sessionDuration: durationSeconds
        }
      });
    } else {
      // Normal session end - go to dashboard
      navigate("/app/dashboard");
    }
  };

  const getConnectionColor = () => {
    switch(connectionQuality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-black/30 backdrop-blur-xl border-b border-white/10 px-6 py-4 z-20"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(139, 92, 246, 0.5)",
                  "0 0 40px rgba(139, 92, 246, 0.8)",
                  "0 0 20px rgba(139, 92, 246, 0.5)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center"
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h2 className="font-bold text-white text-lg">Video Session with {currentAvatar.name}</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-green-400 rounded-full"
                  />
                  <span className="text-sm text-gray-300">Live</span>
                </div>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-300 font-mono">{formatTime(sessionTime)}</span>
                <span className="text-sm text-gray-400">•</span>
                <div className="flex items-center gap-1">
                  <Circle className={`w-3 h-3 ${getConnectionColor()} fill-current`} />
                  <span className={`text-xs ${getConnectionColor()}`}>
                    {connectionQuality.charAt(0).toUpperCase() + connectionQuality.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => {
                const step = scriptStepRef.current;
                const last = transcript.length > 0 ? transcript[transcript.length - 1].content : "none";
                const speaking = isEzriSpeakingRef.current;
                
                // Force Reset Logic
                setIsEzriSpeaking(false);
                isEzriSpeakingRef.current = false;
                if (currentUtteranceRef.current) {
                    window.speechSynthesis.cancel();
                    currentUtteranceRef.current = null;
                }
                
                // Restart Media and Recognition
                if (stream) {
                    stream.getTracks().forEach(t => t.stop());
                    setStream(null);
                }
                
                // Allow a brief moment for cleanup before restarting
                setTimeout(() => {
                    if (recognitionRef.current) {
                        try { recognitionRef.current.abort(); } catch(e) {}
                    }
                    // Re-trigger media permission flow if needed, or just let useEffect handle it
                    setPermissionsGranted(true); 
                    window.location.reload(); // Hard reset might be safer for stuck audio context
                }, 100);

                toast.info("Resetting Session...");
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Video Session Area */}
      <div className="flex-1 relative overflow-hidden p-6">
        {/* Main AI Avatar Video Feed */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full h-full rounded-3xl overflow-hidden relative bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-purple-900/30 backdrop-blur-xl border-2 border-white/10 shadow-2xl"
        >
          {/* Realistic AI Avatar with Animations */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            {/* Animated Glow Effect when speaking */}
            <AnimatePresence>
              {isEzriSpeaking && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gradient-to-b from-purple-500/20 via-transparent to-transparent pointer-events-none"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-gradient-radial from-purple-500/30 to-transparent blur-3xl"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 3D Avatar */}
            <motion.div
              className="relative z-10 w-full h-full"
              animate={{
                y: isEzriSpeaking ? [0, -8, 0, -6, 0] : [0, -3, 0],
              }}
              transition={{
                duration: isEzriSpeaking ? 2 : 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ThreeAvatar isSpeaking={isEzriSpeaking} audioLevel={audioLevel} />
            </motion.div>

            {/* Voice Wave Animation Overlay when speaking */}
            {isEzriSpeaking && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/80 to-transparent" />
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-purple-400 rounded-full"
                      animate={{
                        height: [10, 30, 15, 25, 10],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.1,
                        ease: "easeInOut"
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* AI Avatar Name Label */}
          <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <p className="text-sm font-semibold text-white">{currentAvatar.name}</p>
            </div>
          </div>

          {/* Connection Status & Credits Display */}
          <div className="absolute top-6 right-6 flex flex-col gap-2 items-end">
            {/* Connection Quality */}
            <div className="bg-black/60 backdrop-blur-xl px-3 py-2 rounded-lg border border-white/20 flex items-center gap-2">
              <Circle className={`w-2 h-2 ${getConnectionColor()} fill-current animate-pulse`} />
              <span className="text-xs text-white font-medium">
                {connectionQuality === 'excellent' ? 'HD' : connectionQuality === 'good' ? 'SD' : 'Low Quality'}
              </span>
            </div>

            {/* Credits Remaining */}
            <motion.div
              animate={{
                scale: creditsRemaining <= 10 ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 1,
                repeat: creditsRemaining <= 10 ? Infinity : 0
              }}
              className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${
                creditsRemaining <= 10 
                  ? 'bg-red-500/90 border-red-300' 
                  : creditsRemaining <= 30
                  ? 'bg-amber-500/90 border-amber-300'
                  : 'bg-black/60 backdrop-blur-xl border-white/20'
              }`}
            >
              <Clock className={`w-4 h-4 ${
                creditsRemaining <= 10 ? 'text-white' : 'text-blue-300'
              }`} />
              <div>
                <p className={`text-xs ${
                  creditsRemaining <= 10 ? 'text-white' : 'text-gray-300'
                }`}>
                  Minutes Left
                </p>
                <p className={`text-lg font-bold ${
                  creditsRemaining <= 10 ? 'text-white' : 'text-white'
                }`}>
                  {creditsRemaining}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Status Indicator */}
          <div className="absolute bottom-6 left-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/20"
            >
              {isEzriSpeaking ? (
                <div className="flex items-center gap-2 text-purple-300">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <Volume2 className="w-4 h-4" />
                  </motion.div>
                  <span className="text-sm font-medium">Speaking...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-300">
            {/* Audio Visualizer */}
            <div className="flex items-end gap-[2px] h-4">
               {[1, 2, 3].map((bar) => (
                  <motion.div 
                    key={bar}
                    className="w-1 bg-green-400 rounded-t-sm"
                    animate={{ 
                        height: Math.max(4, Math.min(16, (audioLevel / 2) * bar)) 
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  />
               ))}
            </div>
            
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Circle className={`w-3 h-3 ${isListening ? 'fill-current' : 'fill-transparent stroke-current'}`} />
            </motion.div>
            <span className="text-sm font-medium">
                {isListening ? "Listening" : "Connecting..."} 
                {audioLevel > 10 && <span className="text-xs ml-1 text-green-200">({Math.round(audioLevel)})</span>}
            </span>
          </div>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Subtitles Overlay */}
          <AnimatePresence>
            {currentSubtitle && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-8 left-0 right-0 px-8 flex justify-center z-40 pointer-events-none"
              >
                <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 max-w-2xl text-center shadow-xl">
                  <p className="text-white text-lg font-medium leading-relaxed">
                    {currentSubtitle}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* User's Camera Feed (Picture-in-Picture) */}
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-28 right-10 w-64 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-white/20 shadow-2xl"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : 'block'}`}
          />
          
          {isCameraOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="text-center">
                <VideoOff className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Camera Off</p>
              </div>
            </div>
          )}

          {/* Muted Indicator on User Video */}
          {isMuted && !isCameraOff && (
            <div className="absolute bottom-2 left-2 bg-red-500 p-2 rounded-full">
              <MicOff className="w-4 h-4 text-white" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Important Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pb-2"
      >
        <div className="max-w-7xl mx-auto bg-blue-500/10 backdrop-blur-xl border border-blue-500/30 rounded-xl p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-200">
              <span className="font-semibold">Voice-Only Session:</span> This is a video call with voice interaction. 
              There is no chat feature - speak naturally with your AI companion.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-black/30 backdrop-blur-xl border-t border-white/10 px-6 py-6"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
          {/* Microphone Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMuted(!isMuted)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
            }`}
          >
            {isMuted ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : (
              <Mic className="w-7 h-7 text-white" />
            )}
          </motion.button>

          {/* Camera Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCameraOff(!isCameraOff)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isCameraOff
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
            }`}
          >
            {isCameraOff ? (
              <VideoOff className="w-7 h-7 text-white" />
            ) : (
              <Video className="w-7 h-7 text-white" />
            )}
          </motion.button>

          {/* Sound Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsSoundOff(!isSoundOff)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isSoundOff
                ? "bg-red-500 hover:bg-red-600"
                : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
            }`}
          >
            {isSoundOff ? (
              <VolumeX className="w-7 h-7 text-white" />
            ) : (
              <Volume2 className="w-7 h-7 text-white" />
            )}
          </motion.button>

          {/* End Call Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEndConfirm(true)}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 flex items-center justify-center shadow-lg shadow-red-500/50 transition-all"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </motion.button>
        </div>

        {/* Control Labels */}
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 mt-3">
          <span className="text-xs text-gray-400 w-16 text-center">
            {isMuted ? "Unmute" : "Mute"}
          </span>
          <span className="text-xs text-gray-400 w-16 text-center">
            {isCameraOff ? "Camera" : "Camera"}
          </span>
          <span className="text-xs text-gray-400 w-16 text-center">
            {isSoundOff ? "Sound" : "Sound"}
          </span>
          <span className="text-xs text-gray-400 w-16 text-center">
            End
          </span>
        </div>
      </motion.div>

      {/* Camera & Microphone Permission Request Modal */}
      <AnimatePresence>
        {showPermissionRequest && !permissionsGranted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-purple-500/30 shadow-2xl"
            >
              {/* Icon */}
              <div className="text-center mb-6">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/50"
                >
                  <Camera className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Camera & Microphone Access</h3>
                <p className="text-gray-300 leading-relaxed">
                  To have a video session with {currentAvatar.name}, we need permission to access your camera and microphone.
                </p>
              </div>

              {/* Permission Details */}
              <div className="bg-black/30 backdrop-blur-xl rounded-2xl p-5 mb-6 border border-white/10">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Video className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Camera Access</p>
                      <p className="text-sm text-gray-400">So {currentAvatar.name} can see you during the conversation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Mic className="w-4 h-4 text-pink-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Microphone Access</p>
                      <p className="text-sm text-gray-400">So you can speak naturally with your AI companion</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy Note */}
              <div className="bg-blue-500/10 backdrop-blur-xl rounded-xl p-4 mb-6 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-200">
                      <span className="font-semibold">Your privacy matters:</span> Your video is only used during the session and is never recorded or stored. 
                      You can disable your camera at any time.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowPermissionRequest(false);
                    navigate("/app/dashboard");
                  }}
                  className="flex-1 px-6 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center justify-center gap-2 border border-white/10"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setPermissionsGranted(true);
                    setShowPermissionRequest(false);
                    try {
                      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
                        window.localStorage.setItem(permissionStorageKey, JSON.stringify(true));
                      }
                    } catch (error) {
                      console.error("Failed to save media permission setting:", error);
                    }
                  }}
                  className="flex-1 px-6 py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/50"
                >
                  <Check className="w-5 h-5" />
                  Allow Access
                </motion.button>
              </div>

              {/* Help Text */}
              <p className="text-xs text-gray-400 text-center mt-4">
                Your browser may show an additional permission prompt after clicking "Allow Access"
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Low Credits Warning */}
      <AnimatePresence>
        {showLowCreditsWarning && creditsRemaining > 0 && creditsRemaining <= 10 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 max-w-md"
          >
            <div className="bg-amber-500 border-2 border-amber-300 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-white font-bold mb-1">Running Low on Minutes!</h4>
                  <p className="text-sm text-amber-50 mb-3">
                    You have {creditsRemaining} minutes left. Consider purchasing more or your session will end soon.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigate('/app/billing');
                      }}
                      className="px-4 py-2 bg-white text-amber-700 rounded-lg font-semibold text-sm hover:bg-amber-50 transition-colors"
                    >
                      Buy More Minutes
                    </button>
                    <button
                      onClick={() => setShowLowCreditsWarning(false)}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium text-sm hover:bg-amber-700 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Out of Credits Modal */}
      <AnimatePresence>
        {showOutOfCredits && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-red-500/30 shadow-2xl"
            >
              <div className="text-center mb-6">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ 
                    duration: 0.5,
                    repeat: 3
                  }}
                  className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Clock className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-3xl font-bold text-white mb-2">Session Paused</h3>
                <p className="text-gray-300 text-lg">
                  You've used all your included minutes for this month.
                </p>
              </div>

              <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/10">
                <div className="text-center mb-4">
                  <p className="text-gray-300 mb-2">Your session time:</p>
                  <p className="text-4xl font-bold text-white font-mono">{formatTime(sessionTime)}</p>
                </div>
                <div className="flex items-center justify-center gap-2 text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">0 minutes remaining</span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <h4 className="text-white font-semibold text-center mb-3">Continue Your Wellness Journey:</h4>
                
                {/* Pay-as-you-go option */}
                <button
                  onClick={() => navigate('/app/billing')}
                  className="w-full p-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl text-white font-semibold flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Buy More Minutes</p>
                      <p className="text-xs text-green-100">Pay-as-you-go available</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Upgrade option */}
                <button
                  onClick={() => navigate('/app/billing')}
                  className="w-full p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-white font-semibold flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold">Upgrade Your Plan</p>
                      <p className="text-xs text-purple-100">Get more minutes & better rates</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* End session option */}
              <button
                onClick={() => navigate('/app/dashboard')}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                End Session & Return to Dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LowMinutesWarning
        isOpen={showLowMinutesModal}
        onClose={() => setShowLowMinutesModal(false)}
        minutesRemaining={creditsRemaining}
      />

      {/* End Session Confirmation Modal */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEndConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border-2 border-red-500/30"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PhoneOff className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">End Session?</h3>
                <p className="text-gray-300">
                  Are you sure you want to end your video session with {currentAvatar.name}?
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Session duration: {formatTime(sessionTime)}
                </p>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEndConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium"
                >
                  Continue Session
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleEndSession}
                  disabled={isUploading}
                  className={`flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium flex items-center justify-center gap-2 ${isUploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {isUploading ? "Ending..." : "End Session"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Boundary Message */}
      <AnimatePresence>
        {showSafetyBoundary && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-40 max-w-md"
          >
            <div className="bg-red-500 border-2 border-red-300 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-white flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-white font-bold mb-1">Safety Alert!</h4>
                  <p className="text-sm text-red-50 mb-3">
                    We've detected a potential safety concern in your conversation. Please take a moment to review the following resources.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowSafetyResources(true)}
                      className="px-4 py-2 bg-white text-red-700 rounded-lg font-semibold text-sm hover:bg-red-50 transition-colors"
                    >
                      View Resources
                    </button>
                    <button
                      onClick={() => setShowSafetyBoundary(false)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Resources Modal */}
      <AnimatePresence>
        {showSafetyResources && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-3xl p-8 max-w-lg w-full border-2 border-red-500/30 shadow-2xl"
            >
              <div className="text-center mb-6">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ 
                    duration: 0.5,
                    repeat: 3
                  }}
                  className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Heart className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-3xl font-bold text-white mb-2">Safety Resources</h3>
                <p className="text-gray-300 text-lg">
                  We've detected a potential safety concern in your conversation. Here are some resources to help you.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <h4 className="text-white font-semibold text-center mb-3">Helpful Resources:</h4>
                
                {/* Resource cards */}
                {safetyResources.map(resource => (
                  <SafetyResourceCard key={resource.id} resource={resource} />
                ))}
              </div>

              {/* End session option */}
              <button
                onClick={() => navigate('/app/dashboard')}
                className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                End Session & Return to Dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety State Indicator */}
      <SafetyStateIndicator />

      {/* Pause Session Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsSessionPaused(!isSessionPaused)}
        className={`absolute bottom-16 left-16 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
          isSessionPaused
            ? "bg-green-500 hover:bg-green-600"
            : "bg-white/10 hover:bg-white/20 border-2 border-white/20"
        }`}
      >
        {isSessionPaused ? (
          <Play className="w-7 h-7 text-white" />
        ) : (
          <Pause className="w-7 h-7 text-white" />
        )}
      </motion.button>
    </div>
  );
}

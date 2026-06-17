import { ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { FloatingElement } from "./FloatingElement";
import { cn } from "@/lib/utils";

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  title: ReactNode;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  title,
  subtitle,
  showBack,
  onBack,
}: OnboardingLayoutProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050612] text-[#f4f4f8]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <FloatingElement delay={0} duration={4}>
          <div className="absolute left-10 top-20 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
        </FloatingElement>
        <FloatingElement delay={1.5} duration={5}>
          <div className="absolute bottom-40 right-20 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
        </FloatingElement>
      </div>

      <header
        className={cn(
          "relative z-10 border-b border-white/[0.08] bg-[#070815]/72 backdrop-blur-2xl",
          "shadow-[inset_0_-1px_0_rgba(255,78,145,0.12)] supports-[backdrop-filter]:bg-[#070815]/50",
        )}
      >
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showBack && onBack ? (
                <button
                  onClick={onBack}
                  className="-ml-2 rounded-full p-2 text-violet-200/75 transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : null}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="flex items-center gap-2"
              >
                <BrandLogo heightClass="h-8" variant="onDark" />
                <span className="font-semibold text-white/90">Solace</span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-violet-200/65"
            >
              Step {currentStep} of {totalSteps}
            </motion.div>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/[0.04]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#FF4E91] via-[#d946ef] to-[#8A4FFF] shadow-[0_0_16px_-2px_rgba(255,78,145,0.55)]"
            />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <h1 className="mb-2 inline-flex flex-wrap items-center justify-center gap-2 text-3xl font-bold text-[#faf8fc] md:text-4xl">
            {title}
          </h1>
          {subtitle ? <p className="text-lg text-violet-200/75">{subtitle}</p> : null}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          {children}
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-white/[0.08] bg-[#070815]/80 p-4 backdrop-blur-md md:hidden">
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "h-2 rounded-full transition-all",
                index + 1 <= currentStep
                  ? "w-6 bg-gradient-to-r from-[#FF4E91] to-[#8A4FFF]"
                  : "w-2 bg-white/15",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

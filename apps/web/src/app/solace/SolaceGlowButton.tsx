import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SolaceGlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

const MotionButton = motion.button;

/**
 * Pill CTA with violet→pink gradient, soft outer glow, calm hover motion.
 */
export function SolaceGlowButton({ children, className, type = "button", disabled, ...rest }: SolaceGlowButtonProps) {
  return (
    <MotionButton
      type={type}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white",
        "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500",
        "shadow-[0_0_28px_rgba(168,85,247,0.45),0_0_48px_-12px_rgba(236,72,153,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]",
        "border border-white/10",
        "transition-shadow duration-300 hover:shadow-[0_0_36px_rgba(168,85,247,0.55),0_0_56px_-8px_rgba(236,72,153,0.4),inset_0_1px_0_rgba(255,255,255,0.25)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050816]",
        "disabled:pointer-events-none disabled:opacity-45",
        className
      )}
      {...rest}
    >
      {children}
    </MotionButton>
  );
}

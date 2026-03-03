import { motion } from "motion/react";
import { ReactNode } from "react";
import { Button } from "./ui/button";

interface TouchOptimizedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function TouchOptimizedButton({
  children,
  onClick,
  variant = "default",
  size = "default",
  className = "",
  icon,
  fullWidth = false
}: TouchOptimizedButtonProps) {
  const handleClick = () => {
    // Simulate haptic feedback on supported devices
    if ("vibrate" in navigator) {
      navigator.vibrate(10);
    }
    onClick?.();
  };

  return (
    <motion.div
      whileTap={{ scale: 0.95 }}
      className={fullWidth ? "w-full" : ""}
    >
      <Button
        onClick={handleClick}
        variant={variant}
        size={size}
        className={`touch-manipulation min-h-[44px] min-w-[44px] ${
          fullWidth ? "w-full" : ""
        } ${className}`}
      >
        {icon && <span className="mr-2">{icon}</span>}
        {children}
      </Button>
    </motion.div>
  );
}

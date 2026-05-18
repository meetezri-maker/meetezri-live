"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { cn } from "./utils";

const TOASTER_STYLE = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
} as CSSProperties;

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={TOASTER_STYLE}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn(
            "!rounded-[22px] !border-white/[0.08] !bg-[#0c0e18]/92 !text-white/90 !shadow-[0_0_0_1px_rgba(168,85,247,0.12),0_24px_64px_-24px_rgba(0,0,0,0.85),0_0_48px_-16px_rgba(168,85,247,0.28)] !backdrop-blur-xl",
            toastOptions?.classNames?.toast,
          ),
          success: cn("!text-[14px] !leading-snug", toastOptions?.classNames?.success),
          description: cn("!text-white/65", toastOptions?.classNames?.description),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

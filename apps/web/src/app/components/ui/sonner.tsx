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
          // Default toast body is 13px; bump success copy slightly (needs ! vs Sonner’s inline styles).
          success: cn("!text-[15px]", toastOptions?.classNames?.success),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SolaceShellProps {
  children: ReactNode;
  className?: string;
}

/** Wrapper for page-level chrome; member shell typically uses `solace-app` on AppLayout */
export function SolaceShell({ children, className }: SolaceShellProps) {
  return <div className={cn(className)}>{children}</div>;
}

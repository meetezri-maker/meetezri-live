import { cn } from "@/lib/utils";

export const settingsIconChip = (
  tone: "violet" | "pink" | "cyan" | "amber" | "rose" | "emerald" | "blue" | "orange" = "violet"
) => cn("solace-icon-chip", `solace-icon-chip--${tone}`);

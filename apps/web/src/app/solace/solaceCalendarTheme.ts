import { cn } from "@/lib/utils";

export const solaceCalendarPopoverClass = cn(
  "w-auto border border-white/10 bg-[#12141f] p-0",
  "shadow-[0_24px_64px_-24px_rgba(0,0,0,0.85),0_0_40px_-16px_rgba(139,92,246,0.25)]"
);

/** Dark sanctuary styling for react-day-picker (v8). */
export const solaceCalendarClassNames = {
  months: "flex flex-col sm:flex-row gap-2",
  month: "flex flex-col gap-4",
  caption: "flex justify-center pt-1 relative items-center w-full",
  caption_label: "text-sm font-medium text-zinc-100",
  nav: "flex items-center gap-1",
  nav_button: cn(
    "inline-flex size-7 items-center justify-center rounded-lg border border-white/10",
    "bg-white/[0.04] text-zinc-300 transition-colors hover:bg-violet-500/15 hover:text-violet-100"
  ),
  nav_button_previous: "absolute left-1",
  nav_button_next: "absolute right-1",
  table: "w-full border-collapse space-x-1",
  head_row: "flex",
  head_cell: "w-8 rounded-md font-normal text-[0.8rem] text-zinc-500",
  row: "flex w-full mt-2",
  cell: cn(
    "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
    "[&:has([aria-selected])]:rounded-md [&:has([aria-selected])]:bg-violet-500/20"
  ),
  day: cn(
    "inline-flex size-8 items-center justify-center rounded-lg p-0 font-normal text-zinc-200",
    "transition-colors hover:bg-violet-500/15 hover:text-violet-50",
    "aria-selected:opacity-100"
  ),
  day_selected:
    "bg-violet-600 text-white hover:bg-violet-500 hover:text-white focus:bg-violet-600 focus:text-white",
  day_today: "bg-white/[0.08] text-violet-200",
  day_outside: "text-zinc-600 aria-selected:text-zinc-400",
  day_disabled: "text-zinc-600 opacity-40",
  day_hidden: "invisible",
} as const;

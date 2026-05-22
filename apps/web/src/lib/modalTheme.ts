import { cn } from "@/lib/utils";

/** Solace dark glass modal — use on overlay, panel, and form controls inside modals. */
export const modalOverlay = cn(
  "fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md",
);

export const modalPanel = cn(
  "w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d14] shadow-2xl",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
);

export const modalPanelSm = cn(modalPanel, "max-w-md");
export const modalPanelMd = cn(modalPanel, "max-w-lg");
export const modalPanelLg = cn(modalPanel, "max-w-2xl");
export const modalPanelXl = cn(modalPanel, "max-w-4xl");

export const modalTitle = "font-serif text-lg font-semibold text-zinc-50 sm:text-xl";
export const modalCloseButton =
  "rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100";
export const modalBodyText = "text-sm leading-relaxed text-zinc-400";
export const modalLabel = "text-xs font-medium text-zinc-400";
export const modalInput = cn(
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-100",
  "placeholder:text-zinc-600 focus:border-violet-400/35 focus:outline-none focus:ring-1 focus:ring-violet-400/25",
);
export const modalTabActive =
  "rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.55)]";
export const modalTabInactive = cn(
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-zinc-400",
  "transition hover:border-violet-400/25 hover:text-zinc-200",
);
export const modalPrimaryButton = cn(
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2",
  "text-sm font-semibold text-white transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50",
);
export const modalSecondaryButton = cn(
  "inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3",
  "text-sm font-medium text-zinc-300 transition hover:border-violet-400/25 hover:bg-white/[0.07]",
);
export const modalDestructiveButton = cn(
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5",
  "text-sm font-semibold text-white shadow-[0_0_24px_-8px_rgba(244,63,94,0.55)]",
  "transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-rose-500/40",
  "disabled:pointer-events-none disabled:opacity-50",
);
export const modalLink = "font-medium text-violet-400 hover:text-violet-300 hover:underline";
export const modalCheckboxLabel = "flex items-center gap-2 text-sm text-zinc-300";

/** Radix dialog / alert-dialog default content shell */
export const modalDialogContent = cn(
  modalPanel,
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)]",
  "translate-x-[-50%] translate-y-[-50%] gap-4 p-6 text-zinc-100 duration-200 sm:max-w-lg",
);

export const modalDialogOverlay = cn(
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
  "fixed inset-0 z-50 bg-black/75 backdrop-blur-md",
);

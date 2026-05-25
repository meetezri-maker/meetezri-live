import { cn } from "@/lib/utils";

/** Solace modal chrome — dark sanctuary default, pastel lavender in light theme. */
export const modalOverlay = cn(
  "fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md",
  "[html[data-ezri-theme=light]_&]:bg-[rgba(251,248,255,0.78)]",
  "[html[data-theme=light]_&]:bg-[rgba(251,248,255,0.78)]"
);

export const modalPanel = cn(
  "w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0d14] text-zinc-100 shadow-2xl",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_24px_60px_rgba(88,28,135,0.12),0_0_32px_rgba(167,139,250,0.14)]",
  "[html[data-theme=light]_&]:border-[color:var(--border,#e7ddfb)]",
  "[html[data-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary,#101828)]",
  "[html[data-theme=light]_&]:shadow-[0_24px_60px_rgba(88,28,135,0.12),0_0_32px_rgba(167,139,250,0.14)]"
);

export const modalPanelHeader = cn(
  "relative border-b border-white/[0.06] bg-black/35 px-6 py-5",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--surface-soft,#fbf8ff)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--surface-soft,#fbf8ff)]"
);

export const modalPanelBody = cn(
  "space-y-5 p-6",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-theme=light]_&]:bg-[var(--card-solid,#ffffff)]"
);

export const modalPanelSm = cn(modalPanel, "max-w-md");
export const modalPanelMd = cn(modalPanel, "max-w-lg");
export const modalPanelLg = cn(modalPanel, "max-w-2xl");
export const modalPanelXl = cn(modalPanel, "max-w-4xl");

export const modalTitle = cn(
  "font-serif text-lg font-semibold text-zinc-50 sm:text-xl",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]"
);

export const modalSubtitle = cn(
  "mt-1 text-sm text-zinc-500",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted)]"
);

export const modalCloseButton = cn(
  "rounded-lg px-2 py-1 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-ezri-theme=light]_&]:hover:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-ezri-theme=light]_&]:hover:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:hover:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-theme=light]_&]:hover:text-[var(--text-primary)]"
);

export const modalBodyText = cn(
  "text-sm leading-relaxed text-zinc-400",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
);

export const modalMutedText = cn(
  "text-zinc-500",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted)]"
);

export const modalEmphasisText = cn(
  "font-semibold text-zinc-200",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]"
);

export const modalLabel = cn(
  "text-xs font-medium text-zinc-400",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted)]"
);

export const modalSectionTitle = cn(
  "text-sm font-medium text-zinc-100",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]"
);

export const modalInsetPanel = cn(
  "rounded-2xl border border-white/[0.06] bg-black/25 p-4",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--card-muted,#f8f3ff)]"
);

export const modalBadge = cn(
  "rounded-full border border-violet-400/35 bg-violet-500/[0.12] px-3 py-1 text-xs font-medium text-violet-100",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border-strong)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-ezri-theme=light]_&]:text-[#5b21b6]",
  "[html[data-theme=light]_&]:border-[color:var(--border-strong)]",
  "[html[data-theme=light]_&]:bg-[var(--surface-lavender,#f5eeff)]",
  "[html[data-theme=light]_&]:text-[#5b21b6]"
);

export const modalOptionCard = cn(
  "relative rounded-2xl border p-4 text-left transition-all",
  "border-white/[0.08] bg-black/28 text-zinc-100",
  "hover:border-violet-400/25",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_8px_24px_-12px_rgba(88,28,135,0.08)]",
  "[html[data-ezri-theme=light]_&]:hover:border-[color:var(--border-strong)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-theme=light]_&]:text-[var(--text-primary)]",
  "[html[data-theme=light]_&]:hover:border-[color:var(--border-strong)]"
);

export const modalOptionCardSelected = cn(
  modalOptionCard,
  "border-violet-400/45 bg-violet-500/[0.12] shadow-[0_0_24px_rgba(139,92,246,0.2)]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border-strong,#d8c7f7)]",
  "[html[data-ezri-theme=light]_&]:bg-[color-mix(in_srgb,#a78bfa_16%,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:text-[#5b21b6]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_0_24px_rgba(167,139,250,0.18)]",
  "[html[data-theme=light]_&]:border-[color:var(--border-strong,#d8c7f7)]",
  "[html[data-theme=light]_&]:bg-[color-mix(in_srgb,#a78bfa_16%,#ffffff)]",
  "[html[data-theme=light]_&]:text-[#5b21b6]"
);

export const modalOptionCardDisabled = cn(
  modalOptionCard,
  "cursor-not-allowed border-white/[0.06] opacity-40",
  "[html[data-ezri-theme=light]_&]:opacity-45",
  "[html[data-theme=light]_&]:opacity-45"
);

export const modalOptionCardMeta = cn(
  "mt-1 text-xs text-zinc-500",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:text-[var(--text-muted)]"
);

export const modalFreeFlowCard = cn(
  "w-full rounded-2xl border px-4 py-3 text-left transition-all",
  "border-white/[0.08] bg-black/28",
  "hover:border-amber-400/25",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-solid,#ffffff)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--card-solid,#ffffff)]"
);

export const modalFreeFlowCardSelected = cn(
  modalFreeFlowCard,
  "border-amber-400/35 bg-amber-500/[0.1] shadow-[0_0_22px_rgba(245,158,11,0.12)]",
  "[html[data-ezri-theme=light]_&]:border-[color:rgba(251,191,36,0.45)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--surface-gold,#fff8dd)]",
  "[html[data-theme=light]_&]:shadow-[0_0_20px_rgba(251,191,36,0.14)]",
  "[html[data-theme=light]_&]:border-[color:rgba(251,191,36,0.45)]",
  "[html[data-theme=light]_&]:bg-[var(--surface-gold,#fff8dd)]"
);

export const modalInput = cn(
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-100",
  "placeholder:text-zinc-600 focus:border-violet-400/35 focus:outline-none focus:ring-1 focus:ring-violet-400/25",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--input-border,#ddd0fa)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--input-bg,#ffffff)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--input-text,#101828)]",
  "[html[data-ezri-theme=light]_&]:placeholder:text-[var(--input-placeholder,#98a2b3)]",
  "[html[data-theme=light]_&]:border-[color:var(--input-border,#ddd0fa)]",
  "[html[data-theme=light]_&]:bg-[var(--input-bg,#ffffff)]",
  "[html[data-theme=light]_&]:text-[var(--input-text,#101828)]"
);

export const modalTabActive =
  "rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.55)]";

export const modalTabInactive = cn(
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-zinc-400",
  "transition hover:border-violet-400/25 hover:text-zinc-200",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--card-muted)]",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-muted)]",
  "[html[data-theme=light]_&]:border-[color:var(--border)]",
  "[html[data-theme=light]_&]:bg-[var(--card-muted)]"
);

export const modalPrimaryButton = cn(
  "solace-cta-gradient inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2",
  "text-sm font-semibold text-white transition hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
);

export const modalSecondaryButton = cn(
  "inline-flex flex-1 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3",
  "text-sm font-medium text-zinc-300 transition hover:border-violet-400/25 hover:bg-white/[0.07]",
  "[html[data-ezri-theme=light]_&]:border-[color:var(--button-secondary-border,#d8c7f7)]",
  "[html[data-ezri-theme=light]_&]:bg-[var(--button-secondary-bg,#f6f0ff)]",
  "[html[data-ezri-theme=light]_&]:text-[color:var(--button-secondary-text,#5b21b6)]",
  "[html[data-theme=light]_&]:border-[color:var(--button-secondary-border,#d8c7f7)]",
  "[html[data-theme=light]_&]:bg-[var(--button-secondary-bg,#f6f0ff)]",
  "[html[data-theme=light]_&]:text-[color:var(--button-secondary-text,#5b21b6)]"
);

export const modalDestructiveButton = cn(
  "solace-btn-destructive inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5",
  "text-sm font-semibold text-white shadow-[0_0_24px_-8px_rgba(244,63,94,0.55)]",
  "transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-rose-500/40",
  "disabled:pointer-events-none disabled:opacity-50",
  "[html[data-ezri-theme=light]_&]:text-white",
  "[html[data-theme=light]_&]:text-white"
);

/** End / crisis modals — red accent border on pastel panel in light theme */
export const modalAlertPanel = cn(
  modalPanel,
  "border-2 border-red-500/30",
  "[html[data-ezri-theme=light]_&]:border-[#fecaca]",
  "[html[data-theme=light]_&]:border-[#fecaca]"
);

export const modalAlertIconWrap = cn(
  "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full",
  "bg-red-500/20",
  "[html[data-ezri-theme=light]_&]:bg-[#fef2f2]",
  "[html[data-theme=light]_&]:bg-[#fef2f2]"
);

export const modalLink = cn(
  "font-medium text-violet-400 hover:text-violet-300 hover:underline",
  "[html[data-ezri-theme=light]_&]:text-[#7c3aed]",
  "[html[data-theme=light]_&]:text-[#7c3aed]"
);

export const modalCheckboxLabel = cn(
  "flex items-center gap-2 text-sm text-zinc-300",
  "[html[data-ezri-theme=light]_&]:text-[var(--text-secondary)]",
  "[html[data-theme=light]_&]:text-[var(--text-secondary)]"
);

/** Radix dialog / alert-dialog default content shell */
export const modalDialogContent = cn(
  modalPanel,
  "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)]",
  "translate-x-[-50%] translate-y-[-50%] gap-4 p-6 transition-none sm:max-w-lg"
);

export const modalDialogOverlay = cn(
  "fixed inset-0 z-50 bg-black/75 backdrop-blur-md transition-none",
  "[html[data-ezri-theme=light]_&]:bg-[rgba(251,248,255,0.78)]",
  "[html[data-theme=light]_&]:bg-[rgba(251,248,255,0.78)]"
);

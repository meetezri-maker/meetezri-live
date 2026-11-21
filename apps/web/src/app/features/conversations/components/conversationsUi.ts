import { cn } from "@/lib/utils";

/**
 * Conversations Module styling — composed from the existing Solace tokens
 * (`solace-tokens.css`) with light-theme variants in the same
 * `[html[data-ezri-theme=light]_&]:` form used by `solacePageChrome.ts`.
 *
 * Every class is written out literally: Tailwind only generates classes it can find verbatim in
 * source, so variants must never be assembled at runtime.
 */

/** Rounded glass panel with a soft violet edge glow (list column, chat panel). */
export const conversationsPanel = cn(
  "relative overflow-hidden rounded-[1.5rem] border border-[color:var(--solace-border)]",
  "bg-[color:var(--solace-panel)] backdrop-blur-xl",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_48px_-18px_rgba(168,85,247,0.35),0_40px_100px_-48px_rgba(0,0,0,0.85)]",
  "[html[data-ezri-theme=light]_&]:shadow-[0_18px_45px_rgba(88,28,135,0.08),0_0_32px_rgba(167,139,250,0.16)]"
);

/** Lilac pill CTA from the references ("Start a New Conversation"). */
export const conversationsPrimaryPill = cn(
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
  "bg-gradient-to-r from-violet-300 via-fuchsia-200 to-violet-300 text-[#24113f]",
  "border border-white/40 shadow-[0_0_26px_rgba(192,132,252,0.45),inset_0_1px_0_rgba(255,255,255,0.6)]",
  "transition-[box-shadow,transform] duration-300 hover:-translate-y-px hover:shadow-[0_0_34px_rgba(192,132,252,0.6),inset_0_1px_0_rgba(255,255,255,0.6)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70",
  "disabled:pointer-events-none disabled:opacity-55",
  "[html[data-ezri-theme=light]_&]:border-violet-200 [html[data-ezri-theme=light]_&]:from-violet-200 [html[data-ezri-theme=light]_&]:via-fuchsia-100 [html[data-ezri-theme=light]_&]:to-violet-200"
);

/** Search / composer field shell. */
export const conversationsField = cn(
  "flex items-center gap-2.5 rounded-2xl border border-[color:var(--solace-border)]",
  "bg-[color-mix(in_oklab,var(--solace-bg-elevated)_70%,transparent)] px-3.5 py-2.5",
  "text-sm text-[color:var(--solace-text)] focus-within:border-violet-400/50",
  "focus-within:shadow-[0_0_0_3px_rgba(167,139,250,0.18)]"
);

/** Small "Preview" status pill. */
export const conversationsPreviewBadge = cn(
  "inline-flex items-center rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5",
  "text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200",
  "[html[data-ezri-theme=light]_&]:border-amber-300 [html[data-ezri-theme=light]_&]:bg-amber-50 [html[data-ezri-theme=light]_&]:text-amber-700"
);

/** Sunset-style gradient wash behind the main chat area (deep purple → soft pink horizon). */
export const conversationsStageBackdrop = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_70%_45%_at_50%_100%,rgba(244,114,182,0.28)_0%,transparent_70%),radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(124,58,237,0.32)_0%,transparent_65%),linear-gradient(180deg,rgba(46,16,101,0.55)_0%,rgba(76,29,149,0.35)_55%,rgba(131,24,67,0.28)_100%)]",
  "[html[data-ezri-theme=light]_&]:bg-[radial-gradient(ellipse_70%_45%_at_50%_100%,rgba(244,114,182,0.2)_0%,transparent_70%),radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(167,139,250,0.28)_0%,transparent_65%),linear-gradient(180deg,rgba(245,240,255,0.9)_0%,rgba(237,228,255,0.8)_60%,rgba(252,231,243,0.85)_100%)]"
);

/** User bubble: lilac gradient, right aligned, tail bottom-right. */
export const userBubble = cn(
  "rounded-[1.25rem] rounded-br-md px-4 py-2.5 text-[0.9375rem] leading-relaxed text-[#2a1050]",
  "bg-gradient-to-br from-[#e6d9ff] via-[#d9c6ff] to-[#c9b2fb]",
  "shadow-[0_6px_24px_-10px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.7)]",
  "[html[data-ezri-theme=light]_&]:from-[#e3d4ff] [html[data-ezri-theme=light]_&]:via-[#d4bfff] [html[data-ezri-theme=light]_&]:to-[#c4a8ff]"
);

/** Companion bubble: soft lavender/white, left aligned, tail bottom-left. */
export const companionBubble = cn(
  "rounded-[1.25rem] rounded-bl-md px-4 py-2.5 text-[0.9375rem] leading-relaxed text-[#24163d]",
  "bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(246,240,255,0.92)_100%)]",
  "shadow-[0_6px_24px_-12px_rgba(76,29,149,0.45)] border border-white/70",
  "[html[data-ezri-theme=light]_&]:border-violet-100"
);

/** Suggested-prompt chip (outlined pill). */
export const promptChip = cn(
  "inline-flex max-w-full items-center rounded-full border border-violet-200/45 px-3.5 py-1.5 text-left text-xs font-medium",
  "bg-[rgba(76,29,149,0.28)] text-violet-50 backdrop-blur-sm transition-colors",
  "hover:border-fuchsia-200/70 hover:bg-[rgba(124,58,237,0.38)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70",
  "[html[data-ezri-theme=light]_&]:border-violet-300 [html[data-ezri-theme=light]_&]:bg-white/80 [html[data-ezri-theme=light]_&]:text-violet-800 [html[data-ezri-theme=light]_&]:hover:bg-violet-50"
);

/** Circular gradient send button. */
export const sendButton = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white",
  "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-violet-600",
  "shadow-[0_0_22px_rgba(192,132,252,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/30",
  "transition-[transform,opacity] hover:scale-105 disabled:pointer-events-none disabled:opacity-45",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200"
);

/** Composer field shell (rounded glass pill). */
export const composerShell = cn(
  "flex min-w-0 flex-1 items-end gap-2 rounded-[1.5rem] border border-white/25 px-4 py-2",
  "bg-[rgba(237,228,255,0.92)] text-[#24163d] shadow-[0_8px_30px_-14px_rgba(76,29,149,0.6)]",
  "focus-within:border-fuchsia-300/80 focus-within:shadow-[0_0_0_3px_rgba(217,70,239,0.25)]",
  "[html[data-ezri-theme=light]_&]:border-violet-200 [html[data-ezri-theme=light]_&]:bg-white"
);

/** Active / selected list row. */
export const conversationsRowActive = cn(
  "border-violet-300/35 bg-[linear-gradient(90deg,rgba(139,92,246,0.24)_0%,rgba(217,70,239,0.12)_100%)]",
  "shadow-[0_0_24px_-8px_rgba(192,132,252,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]",
  "[html[data-ezri-theme=light]_&]:border-violet-300 [html[data-ezri-theme=light]_&]:bg-[linear-gradient(90deg,rgba(221,214,254,0.9)_0%,rgba(250,232,255,0.8)_100%)]"
);

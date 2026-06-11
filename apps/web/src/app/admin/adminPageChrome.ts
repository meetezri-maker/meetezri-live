import { cn } from "@/lib/utils";

/** Solace Admin page atmosphere — Deep Cosmos background with environmental lighting. */
export const adminPageRoot = cn(
  "solace-admin admin-page-root relative min-h-screen overflow-x-hidden",
  "bg-[var(--admin-bg)] text-[var(--admin-text)]"
);

export const adminPageGlowTop = cn(
  "admin-page-glow-top pointer-events-none absolute -top-32 right-[-8%] h-[26rem] w-[26rem] rounded-full blur-3xl",
  "bg-[radial-gradient(circle,rgba(167,139,250,0.12)_0%,transparent_68%)]"
);

export const adminPageGlowTeal = cn(
  "admin-page-glow-teal pointer-events-none absolute bottom-[12%] left-[-6%] h-[22rem] w-[22rem] rounded-full blur-3xl",
  "bg-[radial-gradient(circle,rgba(78,205,196,0.08)_0%,transparent_70%)]"
);

export const adminPageVignette = cn(
  "admin-page-vignette pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_42%,rgba(4,8,18,0.5)_100%)]"
);

export const adminPageAtmosphere = "pointer-events-none absolute inset-0 overflow-hidden";

/** Matte premium panel with environmental edge light. */
export const adminCard = cn(
  "admin-card admin-card-hover relative isolate overflow-hidden rounded-[var(--admin-radius-card)] border",
  "border-[color:var(--admin-surface-border-color)]",
  "shadow-[var(--admin-shadow-panel)]",
  "transition-[border-color,box-shadow,background,transform] duration-[180ms] ease-out"
);

export const adminCardStatic = cn(
  "admin-card relative isolate overflow-hidden rounded-[var(--admin-radius-card)] border",
  "border-[color:var(--admin-surface-border-color)]",
  "shadow-[var(--admin-shadow-panel)]"
);

export const adminKpiCard = cn(
  adminCard,
  "admin-kpi-card p-[22px] sm:p-[26px]"
);

/** Uniform KPI tile — fixed height/width in admin-kpi-grid. */
export const adminKpiTile = cn(
  "admin-kpi-tile admin-card-hover h-[7.875rem] w-full p-5",
  "flex flex-row items-start gap-5",
  "transition-[border-color,box-shadow,transform,background] duration-[180ms] ease-out"
);

export const adminChartCard = cn(
  adminCard,
  "admin-chart-card rounded-[var(--admin-radius-card-lg)] p-6"
);

export const adminTableWrap = cn("admin-table-wrap overflow-x-auto");

export const adminSidebar = cn(
  "flex h-full flex-col border-r backdrop-blur-xl",
  "border-[color:rgba(167,139,250,0.12)]",
  "bg-[linear-gradient(180deg,rgba(13,20,40,0.97)_0%,rgba(8,11,20,0.99)_100%)]",
  "shadow-[inset_-1px_0_0_rgba(167,139,250,0.1),4px_0_32px_-12px_rgba(0,0,0,0.5)]"
);

export const adminTopBar = cn(
  "sticky top-0 z-30 border-b backdrop-blur-xl",
  "border-[color:var(--admin-border)]",
  "bg-[color-mix(in_oklab,var(--admin-bg)_88%,transparent)]",
  "shadow-[0_8px_32px_-16px_rgba(0,0,0,0.45)]",
  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px",
  "after:bg-[linear-gradient(90deg,transparent,rgba(167,139,250,0.28),rgba(78,205,196,0.12),transparent)]"
);

/** Top-level sidebar sections — gradient border on every outer tab. */
export const adminNavSection = cn(
  "admin-sidebar-section flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium",
  "border-solid [border-width:1px]",
  "border-[color:rgba(167,139,250,0.22)]",
  "text-[rgba(255,255,255,0.55)]",
  "shadow-[inset_0_0_0_1px_rgba(167,139,250,0.06)]",
  "transition-[background,color,box-shadow,border-color] duration-300 ease-out"
);

/** Active section — violet → teal gradient (outer tabs only). */
export const adminNavSectionActive = cn(
  "admin-sidebar-section--active",
  "bg-[linear-gradient(135deg,rgba(167,139,250,0.42)_0%,rgba(120,100,220,0.28)_42%,rgba(78,205,196,0.32)_100%)]",
  "border-[color:var(--admin-nav-active-border)]",
  "text-[rgba(255,255,255,0.96)]",
  "shadow-[0_0_32px_rgba(139,92,246,0.28),inset_0_0_0_1px_rgba(167,139,250,0.38)]"
);

/** Inactive page links — plain text, no gradient (gradient is outer tabs only). */
export const adminNavLink = cn(
  "admin-sidebar-nav flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs",
  "border border-transparent bg-transparent",
  "text-[rgba(255,255,255,0.55)]",
  "transition-[color,border-color] duration-[180ms] ease-out",
  "hover:text-[rgba(255,255,255,0.82)]"
);

/** Active page link — border + soft shadow, no gradient fill. */
export const adminNavLinkActive = cn(
  "admin-nav-active admin-sidebar-nav--active font-medium",
  "bg-transparent",
  "border-[color:var(--admin-nav-active-border)]",
  "shadow-[0_0_14px_rgba(139,92,246,0.18),inset_0_0_0_1px_rgba(167,139,250,0.22)]",
  "text-[rgba(255,255,255,0.96)]"
);

export const adminSectionLabel = "admin-section-label";

export const adminPageTitle = "admin-page-title";

export const adminStatValue = cn(
  "text-3xl font-semibold tabular-nums tracking-tight text-[var(--admin-text)]"
);

export const adminInput = cn(
  "rounded-xl border border-[color:var(--admin-border)] bg-white/[0.03] px-4 py-2.5",
  "text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)]",
  "focus:border-[color:rgba(78,205,196,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(78,205,196,0.12)]"
);

export const adminSelect = adminInput;

export const adminBtnPrimary = cn(
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#041018]",
  "bg-[linear-gradient(135deg,rgba(167,139,250,0.92)_0%,rgba(78,205,196,0.88)_100%)]",
  "transition-[filter,box-shadow,transform] duration-[180ms] ease-out",
  "shadow-[0_0_28px_-6px_rgba(167,139,250,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]",
  "hover:brightness-110 hover:-translate-y-px",
  "hover:shadow-[0_0_36px_-4px_rgba(167,139,250,0.55),inset_0_1px_0_rgba(255,255,255,0.3)]"
);

export const adminBtnSecondary = cn(
  "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium",
  "border-[color:var(--admin-surface-border-color)]",
  "bg-[color-mix(in_oklab,var(--admin-surface-raised)_90%,transparent)]",
  "text-[var(--admin-text-secondary)]",
  "transition-[border-color,background,color,box-shadow,transform] duration-[180ms] ease-out",
  "hover:border-[color:var(--admin-border-glow-soft)] hover:bg-white/[0.06] hover:text-[var(--admin-text)]",
  "hover:shadow-[0_0_24px_-8px_rgba(167,139,250,0.22)] hover:-translate-y-px"
);

export const adminQuickAction = cn(
  adminBtnSecondary,
  "admin-quick-action w-full justify-start gap-2 rounded-xl py-3"
);

export const adminBtnDanger = cn(
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
  "bg-[color-mix(in_srgb,#dc2626_75%,#0d1428)] text-[#fecaca]",
  "border border-[color:rgba(248,113,113,0.25)]",
  "transition-[filter,box-shadow,transform] duration-[180ms] ease-out",
  "hover:brightness-110 hover:-translate-y-px",
  "hover:shadow-[0_0_24px_-8px_rgba(248,113,113,0.35)]"
);

export const adminBtnGhost = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs",
  "border border-transparent bg-transparent text-[var(--admin-text-muted)]",
  "transition-[background,color,box-shadow,border-color] duration-[180ms] ease-out",
  "hover:border-[color:var(--admin-nav-hover-border)] hover:bg-[var(--admin-nav-hover-bg)]",
  "hover:text-[var(--admin-text)] hover:shadow-[var(--admin-nav-hover-glow)]"
);

export const adminRoleBadge = cn(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
  "border border-[color:var(--admin-border-glow-soft)]",
  "bg-[color-mix(in_srgb,var(--admin-secondary)_14%,transparent)]",
  "text-[var(--admin-secondary)]"
);

/** KPI icon chip — matte, not solid neon block. */
export const adminKpiIcon = cn(
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
  "border border-[color:var(--admin-border-glow-soft)]",
  "bg-[color-mix(in_srgb,var(--admin-secondary)_12%,transparent)]"
);

export const adminKpiIconTeal = cn(
  adminKpiIcon,
  "border-[color:var(--admin-border-glow-teal)]",
  "bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)]"
);

export const adminStatusPill = cn(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
);

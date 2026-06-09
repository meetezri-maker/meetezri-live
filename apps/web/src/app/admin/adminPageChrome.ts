import { cn } from "@/lib/utils";

/** Solace Admin page atmosphere — Deep Cosmos background with environmental lighting. */
export const adminPageRoot = cn(
  "solace-admin relative min-h-screen overflow-x-hidden",
  "bg-[var(--admin-page-bg)] text-[var(--admin-text)]"
);

export const adminPageGlowTop = cn(
  "pointer-events-none absolute -top-32 right-[-8%] h-[26rem] w-[26rem] rounded-full blur-3xl",
  "bg-[radial-gradient(circle,rgba(167,139,250,0.12)_0%,transparent_68%)]"
);

export const adminPageGlowTeal = cn(
  "pointer-events-none absolute bottom-[12%] left-[-6%] h-[22rem] w-[22rem] rounded-full blur-3xl",
  "bg-[radial-gradient(circle,rgba(78,205,196,0.08)_0%,transparent_70%)]"
);

export const adminPageVignette = cn(
  "pointer-events-none absolute inset-0",
  "bg-[radial-gradient(ellipse_90%_70%_at_50%_50%,transparent_42%,rgba(4,8,18,0.5)_100%)]"
);

export const adminPageAtmosphere = "pointer-events-none absolute inset-0 overflow-hidden";

/** Matte premium panel with environmental edge light. */
export const adminCard = cn(
  "admin-card admin-card-hover relative isolate overflow-hidden rounded-2xl border",
  "border-[color:var(--admin-border)] bg-[var(--admin-surface)]",
  "shadow-[var(--admin-shadow-panel)]"
);

export const adminCardStatic = cn(
  "admin-card relative isolate overflow-hidden rounded-2xl border",
  "border-[color:var(--admin-border)] bg-[var(--admin-surface)]",
  "shadow-[var(--admin-shadow-panel)]"
);

export const adminTableWrap = cn("admin-table-wrap overflow-x-auto");

export const adminSidebar = cn(
  "flex h-full flex-col border-r",
  "border-[color:var(--admin-border)] bg-[color-mix(in_oklab,var(--admin-surface)_92%,#0a0f1e)]",
  "shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)]"
);

export const adminTopBar = cn(
  "sticky top-0 z-30 border-b backdrop-blur-xl",
  "border-[color:var(--admin-border)] bg-[color-mix(in_oklab,var(--admin-bg)_75%,transparent)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
);

export const adminNavSection = cn(
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
  "text-[var(--admin-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--admin-text)]"
);

export const adminNavSectionActive = cn(
  "bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)]",
  "text-[var(--admin-primary)]"
);

export const adminNavLink = cn(
  "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
  "text-[var(--admin-text-muted)] hover:bg-white/[0.04] hover:text-[var(--admin-text)]"
);

export const adminNavLinkActive = cn(
  "bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]",
  "font-medium text-[var(--admin-primary)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
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
  "bg-[var(--admin-primary)] transition-all duration-200",
  "hover:brightness-110",
  "shadow-[0_0_24px_-8px_rgba(78,205,196,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]"
);

export const adminBtnSecondary = cn(
  "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium",
  "border-[color:var(--admin-border)] bg-white/[0.03] text-[var(--admin-text-secondary)]",
  "transition-all duration-200 hover:border-[color:var(--admin-border-glow)] hover:bg-white/[0.06] hover:text-[var(--admin-text)]"
);

export const adminBtnGhost = cn(
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs",
  "text-[var(--admin-text-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--admin-text)]"
);

export const adminRoleBadge = cn(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
  "border border-[color:var(--admin-border-glow)] bg-[color-mix(in_srgb,var(--admin-secondary)_14%,transparent)]",
  "text-[var(--admin-secondary)]"
);

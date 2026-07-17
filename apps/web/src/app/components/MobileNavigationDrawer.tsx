import { useMemo } from "react";
import { Link, useLocation } from "react-router";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/app/components/ui/sheet";
import { MEMBER_NAV_ITEMS, findActiveNavPath } from "@/app/solace/memberNav";
import { cn } from "@/lib/utils";

interface MobileNavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tighter rows when Appearance → Compact mode is on */
  compact?: boolean;
}

/**
 * Full member navigation for mobile and tablet, opened from the More tab.
 *
 * The Sheet portals to document.body, which sits outside the `.solace-app`
 * subtree, so the theme variables have to be re-scoped on the portaled content.
 */
export function MobileNavigationDrawer({
  open,
  onOpenChange,
  compact = false,
}: MobileNavigationDrawerProps) {
  const location = useLocation();
  const activePath = useMemo(
    () => findActiveNavPath(location.pathname, MEMBER_NAV_ITEMS),
    [location.pathname]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        overlayClassName="z-[60] lg:hidden"
        className={cn(
          "solace-app z-[60] gap-0 w-[85vw] max-w-[320px] sm:max-w-[320px] lg:hidden",
          "border-r border-[color:var(--solace-border)] bg-[color:var(--solace-bg)]",
          "text-[color:var(--solace-text)] shadow-[var(--solace-ds-shadow-cinematic)]",
          "pl-[env(safe-area-inset-left,0px)]"
        )}
      >
        <div className="border-b border-[color:var(--solace-border)] px-4 pb-3 pt-4">
          <SheetTitle className="text-base font-semibold tracking-tight text-[color:var(--solace-text)]">
            Solace
          </SheetTitle>
          <SheetDescription className="sr-only">
            Browse every section of your Solace member area.
          </SheetDescription>
        </div>

        <nav
          aria-label="Member navigation"
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2",
            compact ? "py-1.5" : "py-2",
            "pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
          )}
        >
          {MEMBER_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onOpenChange(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "solace-sidebar-nav flex items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                  compact ? "py-2" : "py-2.5",
                  active
                    ? "solace-sidebar-nav--active"
                    : "text-[color:var(--solace-muted)] hover:bg-white/[0.04] hover:text-[color:var(--solace-text)]"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "solace-sidebar-nav-icon--active" : "text-[color:var(--solace-muted)]"
                  )}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

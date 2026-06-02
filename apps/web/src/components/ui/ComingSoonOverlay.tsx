import { cn } from "@/lib/utils";

interface ComingSoonOverlayProps {
  className?: string;
  label?: string;
}

export function ComingSoonOverlay({
  className,
  label = "Coming Soon",
}: ComingSoonOverlayProps) {
  return (
    <div
      className={cn(
        "coming-soon-overlay pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]",
        className,
      )}
      aria-hidden
    >
      <span className="coming-soon-overlay-badge rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px]">
        {label}
      </span>
    </div>
  );
}

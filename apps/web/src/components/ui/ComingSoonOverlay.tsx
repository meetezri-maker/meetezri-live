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
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-black/50 backdrop-blur-[1px]",
        className,
      )}
      aria-hidden
    >
      <span className="rounded-full border border-white/25 bg-black/75 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-lg sm:text-[11px]">
        {label}
      </span>
    </div>
  );
}

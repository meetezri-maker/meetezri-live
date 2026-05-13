import { cn } from "@/lib/utils";

export type JourneyAmbiance = "lake" | "mountain" | "forest" | "dusk";

const layers: Record<
  JourneyAmbiance,
  { base: string; hill: string; moon: string; mist: string; warm?: string }
> = {
  lake: {
    base: "bg-[radial-gradient(ellipse_120%_80%_at_50%_100%,#0a1628_0%,#05070d_45%)]",
    hill: "bg-[linear-gradient(180deg,transparent_0%,transparent_35%,rgba(8,12,22,0.85)_42%,rgba(5,8,14,0.98)_100%)]",
    moon: "bg-[radial-gradient(circle_at_72%_18%,rgba(200,210,230,0.14)_0%,transparent_42%)]",
    mist: "bg-[linear-gradient(180deg,rgba(34,211,238,0.06)_0%,transparent_55%)]",
    warm: "bg-[radial-gradient(ellipse_at_20%_90%,rgba(251,191,36,0.07)_0%,transparent_50%)]",
  },
  mountain: {
    base: "bg-[radial-gradient(ellipse_100%_70%_at_50%_0%,#1a1030_0%,#0a0610_55%)]",
    hill: "bg-[linear-gradient(185deg,transparent_30%,rgba(45,20,62,0.5)_48%,rgba(8,4,14,0.95)_100%)]",
    moon: "bg-[radial-gradient(circle_at_28%_12%,rgba(180,160,220,0.12)_0%,transparent_38%)]",
    mist: "bg-[linear-gradient(160deg,rgba(139,92,246,0.09)_0%,transparent_50%)]",
    warm: "bg-[radial-gradient(circle_at_80%_75%,rgba(236,72,153,0.06)_0%,transparent_45%)]",
  },
  forest: {
    base: "bg-[radial-gradient(ellipse_90%_80%_at_50%_110%,#081510_0%,#030806_50%)]",
    hill: "bg-[linear-gradient(178deg,transparent_25%,rgba(6,22,16,0.88)_40%,rgba(3,8,6,0.98)_100%)]",
    moon: "bg-[radial-gradient(circle_at_65%_20%,rgba(160,200,180,0.08)_0%,transparent_40%)]",
    mist: "bg-[linear-gradient(0deg,rgba(34,197,94,0.05)_0%,transparent_45%)]",
    warm: "bg-[radial-gradient(ellipse_at_30%_85%,rgba(251,191,36,0.05)_0%,transparent_50%)]",
  },
  dusk: {
    base: "bg-[radial-gradient(ellipse_100%_90%_at_50%_0%,#251428_0%,#0c0610_60%)]",
    hill: "bg-[linear-gradient(182deg,transparent_32%,rgba(60,20,45,0.55)_50%,rgba(10,5,10,0.96)_100%)]",
    moon: "bg-[radial-gradient(circle_at_50%_22%,rgba(255,200,160,0.1)_0%,transparent_35%)]",
    mist: "bg-[linear-gradient(195deg,rgba(244,114,182,0.07)_0%,transparent_50%)]",
    warm: "bg-[radial-gradient(ellipse_at_70%_80%,rgba(251,146,60,0.08)_0%,transparent_48%)]",
  },
};

interface SolaceJourneyCardVisualProps {
  ambiance: JourneyAmbiance;
  className?: string;
}

/** Layered CSS “landscape” — no stock photos; reads cinematic at small sizes */
export function SolaceJourneyCardVisual({ ambiance, className }: SolaceJourneyCardVisualProps) {
  const L = layers[ambiance];
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}>
      <div className={cn("absolute inset-0", L.base)} />
      <div className={cn("absolute inset-0", L.moon)} />
      {L.warm ? <div className={cn("absolute inset-0", L.warm)} /> : null}
      <div className={cn("absolute inset-0 opacity-90", L.hill)} />
      <div className={cn("absolute inset-0", L.mist)} />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

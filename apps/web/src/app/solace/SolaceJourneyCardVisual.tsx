import { cn } from "@/lib/utils";

export type JourneyAmbiance = "lake" | "mountain" | "forest" | "dusk";

type LayerSet = {
  sky: string;
  horizon: string;
  haze: string;
  moon: string;
  warm: string;
  aurora?: string;
};

/**
 * Richer per-card atmospheres: moonlit lake, dusk mountains, mist forest, sunrise gratitude.
 * Layered gradients + haze — each reads as a distinct place.
 */
const layers: Record<JourneyAmbiance, LayerSet> = {
  lake: {
    sky: "bg-[radial-gradient(ellipse_130%_100%_at_50%_-5%,#1a2744_0%,#0a1528_38%,#040811_65%)]",
    horizon:
      "bg-[linear-gradient(180deg,transparent_0%,transparent_38%,rgba(12,45,62,0.75)_52%,rgba(4,12,22,0.95)_100%)]",
    haze: "bg-[linear-gradient(180deg,rgba(34,211,238,0.09)_0%,transparent_45%,rgba(8,20,35,0.4)_100%)]",
    moon: "bg-[radial-gradient(circle_at_68%_16%,rgba(220,230,255,0.22)_0%,rgba(180,200,230,0.06)_30%,transparent_45%)]",
    warm: "bg-[radial-gradient(ellipse_at_25%_92%,rgba(251,191,36,0.1)_0%,transparent_45%)]",
    aurora: "bg-[linear-gradient(125deg,rgba(59,130,246,0.06)_0%,transparent_40%)]",
  },
  mountain: {
    sky: "bg-[radial-gradient(ellipse_110%_85%_at_50%_0%,#2d1b4e_0%,#140a22_42%,#07040f_70%)]",
    horizon:
      "bg-[linear-gradient(188deg,transparent_28%,rgba(50,25,72,0.55)_46%,rgba(12,6,20,0.96)_100%)]",
    haze: "bg-[linear-gradient(165deg,rgba(139,92,246,0.11)_0%,transparent_48%,rgba(8,4,14,0.35)_100%)]",
    moon: "bg-[radial-gradient(circle_at_30%_14%,rgba(200,180,240,0.16)_0%,transparent_36%)]",
    warm: "bg-[radial-gradient(circle_at_78%_78%,rgba(236,72,153,0.08)_0%,transparent_42%)]",
    aurora: "bg-[linear-gradient(200deg,rgba(124,58,237,0.07)_0%,transparent_50%)]",
  },
  forest: {
    sky: "bg-[radial-gradient(ellipse_100%_90%_at_50%_100%,#061a12_0%,#020806_52%)]",
    horizon:
      "bg-[linear-gradient(178deg,transparent_22%,rgba(5,28,18,0.82)_38%,rgba(2,8,5,0.98)_100%)]",
    haze: "bg-[linear-gradient(0deg,rgba(34,197,94,0.06)_0%,transparent_42%,rgba(0,8,4,0.5)_100%)]",
    moon: "bg-[radial-gradient(circle_at_62%_22%,rgba(190,230,200,0.1)_0%,transparent_38%)]",
    warm: "bg-[radial-gradient(ellipse_at_40%_88%,rgba(100,120,90,0.12)_0%,transparent_48%)]",
    aurora: "bg-[linear-gradient(95deg,rgba(16,185,129,0.05)_0%,transparent_45%)]",
  },
  dusk: {
    sky: "bg-[radial-gradient(ellipse_120%_95%_at_50%_5%,#3b1f2e_0%,#1a0a14_45%,#080410_72%)]",
    horizon:
      "bg-[linear-gradient(182deg,transparent_30%,rgba(80,30,50,0.5)_48%,rgba(14,6,10,0.96)_100%)]",
    haze: "bg-[linear-gradient(195deg,rgba(251,146,60,0.08)_0%,rgba(244,114,182,0.05)_35%,transparent_60%)]",
    moon: "bg-[radial-gradient(circle_at_48%_20%,rgba(255,220,200,0.14)_0%,transparent_32%)]",
    warm: "bg-[radial-gradient(ellipse_at_72%_85%,rgba(251,191,36,0.12)_0%,transparent_50%)]",
    aurora: "bg-[linear-gradient(160deg,rgba(251,146,60,0.06)_0%,transparent_45%)]",
  },
};

interface SolaceJourneyCardVisualProps {
  ambiance: JourneyAmbiance;
  className?: string;
}

export function SolaceJourneyCardVisual({ ambiance, className }: SolaceJourneyCardVisualProps) {
  const L = layers[ambiance];
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
    >
      <div className={cn("absolute inset-0", L.sky)} />
      {L.aurora ? <div className={cn("absolute inset-0", L.aurora)} /> : null}
      <div className={cn("absolute inset-0", L.moon)} />
      <div className={cn("absolute inset-0", L.warm)} />
      <div className={cn("absolute inset-0 opacity-[0.88]", L.horizon)} />
      <div className={cn("absolute inset-0", L.haze)} />
      {/* Depth fog near "camera" */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,14,0.25)_0%,transparent_35%,transparent_60%,rgba(0,0,0,0.4)_95%)]" />
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

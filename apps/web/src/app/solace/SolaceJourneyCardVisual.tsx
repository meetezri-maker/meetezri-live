import { cn } from "@/lib/utils";
import { JOURNEY_AMBIANCE_IMAGE } from "@/lib/solace/dashboardImages";

export type JourneyAmbiance = "lake" | "mountain" | "forest" | "dusk";

const layers: Record<JourneyAmbiance, { mist: string }> = {
  lake: {
    mist: "bg-[linear-gradient(180deg,rgba(34,211,238,0.06)_0%,transparent_55%)]",
  },
  mountain: {
    mist: "bg-[linear-gradient(160deg,rgba(139,92,246,0.09)_0%,transparent_50%)]",
  },
  forest: {
    mist: "bg-[linear-gradient(0deg,rgba(34,197,94,0.05)_0%,transparent_45%)]",
  },
  dusk: {
    mist: "bg-[linear-gradient(195deg,rgba(244,114,182,0.07)_0%,transparent_50%)]",
  },
};

interface SolaceJourneyCardVisualProps {
  ambiance: JourneyAmbiance;
  className?: string;
  imageSrc?: string;
}

/** Journey card landscape — uses `public/dashboard-images` when no override is passed */
export function SolaceJourneyCardVisual({
  ambiance,
  className,
  imageSrc,
}: SolaceJourneyCardVisualProps) {
  const src = imageSrc ?? JOURNEY_AMBIANCE_IMAGE[ambiance];
  const L = layers[ambiance];

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <div className={cn("absolute inset-0 mix-blend-soft-light opacity-35", L.mist)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/15" />
    </div>
  );
}

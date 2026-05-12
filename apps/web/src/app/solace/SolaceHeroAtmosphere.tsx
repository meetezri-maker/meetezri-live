import { cn } from "@/lib/utils";

/** Cinematic night-scene atmosphere: fog, moonlight, vignette, depth — reads as environment, not a flat card */
export function SolaceHeroAtmosphere({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className
      )}
    >
      {/* Deep space + distant bloom */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_95%_at_15%_5%,rgba(88,28,135,0.22)_0%,transparent_52%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_85%_75%,rgba(14,165,233,0.09)_0%,transparent_48%)]" />
      {/* Moonlight wash — soft, diffuse */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_55%_0%,rgba(226,232,255,0.07)_0%,transparent_48%)]" />
      {/* Environmental fog band */}
      <div className="absolute inset-0 bg-[linear-gradient(165deg,rgba(15,23,42,0.35)_0%,transparent_32%,transparent_58%,rgba(15,23,42,0.5)_100%)]" />
      {/* Vertical depth falloff */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,16,0.15)_0%,rgba(4,6,12,0.82)_72%,rgba(2,3,8,0.96)_100%)]" />
      {/* Floor / lake darkness */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_110%_45%_at_50%_100%,rgba(2,6,18,0.88)_0%,transparent_58%)]" />
      {/* Cinematic vignette — corners */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 35%, rgba(0,0,0,0.45) 100%)",
        }}
      />
      {/* Side depth cue (companion blends toward center) */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.35)_0%,transparent_45%,transparent_70%,rgba(15,23,42,0.12)_100%)]" />
      {/* Soft internal "screen" glow */}
      <div className="absolute inset-[1px] rounded-[inherit] shadow-[inset_0_0_80px_rgba(139,92,246,0.06),inset_0_-40px_100px_rgba(0,0,0,0.35)]" />
      {/* Subtle film grain */}
      <div
        className="absolute inset-0 opacity-[0.028] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.62' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

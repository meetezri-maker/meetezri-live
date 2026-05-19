import { cn } from "@/lib/utils";

interface SolaceHeroAtmosphereProps {
  className?: string;
  backgroundSrc?: string;
}

/** Full-bleed night lake atmosphere behind hero content */
export function SolaceHeroAtmosphere({ className, backgroundSrc }: SolaceHeroAtmosphereProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className
      )}
    >
      {backgroundSrc ? (
        <img
          src={backgroundSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-55"
          loading="eager"
          decoding="async"
        />
      ) : null}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_130%_90%_at_20%_10%,rgba(76,29,149,0.25)_0%,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_90%_70%,rgba(14,165,233,0.08)_0%,transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,16,0.2)_0%,rgba(4,6,12,0.92)_78%,rgba(2,3,8,0.98)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_50%_at_50%_100%,rgba(8,15,28,0.9)_0%,transparent_55%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

import type { ReactNode } from "react";
import { LANDING_HERO_BG } from "./landingImagery";

interface LandingHeroSceneProps {
  children: ReactNode;
}

/** Night lake hero backdrop — scoped to hero height only. */
export function LandingHeroScene({ children }: LandingHeroSceneProps) {
  return (
    <section className="relative flex min-h-[min(72vh,760px)] max-h-[760px] items-center justify-center overflow-hidden">
      <img
        src={LANDING_HERO_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_55%]"
        width={2400}
        height={1350}
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.4)_0%,rgba(5,8,22,0.62)_50%,rgba(5,8,22,0.88)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_30%,rgba(88,28,135,0.22)_0%,transparent_58%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(5,8,22,0.8)_0%,transparent_52%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_90%,rgba(251,191,36,0.1)_0%,transparent_40%)]"
        aria-hidden
      />
      <div className="relative z-10 w-full">{children}</div>
    </section>
  );
}

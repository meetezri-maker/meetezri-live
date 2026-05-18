/** Page body atmosphere only — no scenery photo (hero + CTA handle their own). */
export function LandingBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div className="absolute inset-0 bg-[#050816]" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-20%,rgba(88,28,135,0.22)_0%,transparent_55%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_50%,rgba(236,72,153,0.06)_0%,transparent_40%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,#050816_0%,#070a14_50%,#050816_100%)]"
        aria-hidden
      />
    </div>
  );
}

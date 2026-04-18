/**
 * Theme-aware MeetEzri mark: light UI uses `logo white.png`, dark UI uses `logo black.png`
 * (Tailwind `dark` on `document.documentElement`).
 */
export function BrandLogo({
  heightClass = "h-24",
  className = "",
}: {
  heightClass?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="MeetEzri"
      className={`inline-flex shrink-0 items-center justify-center overflow-visible ${heightClass} ${className}`}
    >
      <img
        src="/logos/logo white.png"
        alt=""
        className="h-[130%] w-auto max-h-none object-contain object-center dark:hidden"
      />
      <img
        src="/logos/logo black.png"
        alt=""
        className="hidden h-[130%] w-auto max-h-none object-contain object-center dark:block"
      />
    </span>
  );
}

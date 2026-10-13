import { Link } from "react-router";
import { BrandLogo } from "./BrandLogo";
import {
  SITE_FOOTER_COLUMNS,
  SITE_FOOTER_DISCLAIMER,
  SITE_FOOTER_TAGLINE,
} from "@meetezri/public-content";

export const PUBLIC_FOOTER_COPYRIGHT_YEAR = 2026;

export function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#04060f]/90">
      <div className="pointer-events-none mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-violet-500/35 to-transparent" />
      <div className="landing-section py-10 md:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <BrandLogo heightClass="h-14" themeAware />
            <p className="mt-3 text-sm text-[var(--solace-ds-text-muted)]">
              {SITE_FOOTER_TAGLINE}
            </p>
          </div>
          {SITE_FOOTER_COLUMNS.map((column) => (
          <div key={column.heading}>
            <h2 className="mb-3 text-sm font-semibold text-white">{column.heading}</h2>
            <ul className="space-y-1.5 text-sm text-[var(--solace-ds-text-muted)]">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.href}`}>
                  <Link to={link.href} className="hover:text-white">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          ))}
        </div>

        <div className="mt-8 border-t border-white/[0.06] pt-6 text-center text-xs text-[var(--solace-ds-text-muted)] sm:text-sm">
          <p>&copy; {PUBLIC_FOOTER_COPYRIGHT_YEAR} Solace. All rights reserved.</p>
          <p className="mt-1.5">
            {SITE_FOOTER_DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  );
}

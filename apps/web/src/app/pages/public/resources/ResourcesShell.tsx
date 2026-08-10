/**
 * The SPA side of the shared public-site shell.
 *
 * Renders the SAME `PublicSiteHeader` / `PublicSiteFooter` from `@meetezri/public-content` that
 * the server renderer uses, so the two surfaces cannot drift. Nothing about the shell's markup,
 * labels, link order or footer columns lives here — only the three approved injections:
 *
 *   LinkComponent  a router-aware `Link`, so client navigation stays instant instead of
 *                  triggering a full page load
 *   logo           the real `BrandLogo`, which reads admin branding and the document theme; it is
 *                  used unchanged
 *   mobileMenu     the shared `SsrMobileMenu` disclosure
 *
 * ON THE MOBILE MENU: `PublicNav`'s stateful hamburger is not exported and extracting it would
 * mean editing `PublicNav`, which is off limits — those marketing pages must stay byte-identical.
 * The shared `<details>` disclosure is used instead, which is what the locked decisions already
 * approved for Resources. It is native, keyboard operable, announces its own expanded state, and
 * it means the server and client render exactly the same menu.
 *
 * The shell sits inside `#root` on both surfaces, so a server-rendered page that later boots the
 * SPA ends up with one header and one footer, never two.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  PublicSiteFooter,
  PublicSiteHeader,
  SsrMobileMenu,
  type ShellLink,
} from '@meetezri/public-content';
import { BrandLogo } from '@/app/components/BrandLogo';

/** Router-aware link, matching the shared shell's injection contract. */
const RouterLink: ShellLink = ({ href, className, children, onClick }) => (
  <Link to={href} className={className} onClick={onClick}>
    {children}
  </Link>
);

export function ResourcesShell({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  return (
    <>
      <PublicSiteHeader
        pathname={pathname}
        LinkComponent={RouterLink}
        logo={<BrandLogo heightClass="h-10" variant="onDark" />}
        mobileMenu={<SsrMobileMenu LinkComponent={RouterLink} />}
      />

      {children}

      <PublicSiteFooter
        LinkComponent={RouterLink}
        logo={<BrandLogo heightClass="h-14" themeAware />}
      />
    </>
  );
}

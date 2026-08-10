/**
 * The shared public-site shell — header and footer.
 *
 * ONE SOURCE OF TRUTH for the parts that must never drift between the marketing site and the
 * Resources pages: navigation labels, link order, section structure, logo placement, footer
 * columns and their copy, and the layout scaffolding.
 *
 * SSR-SAFE BY CONSTRUCTION. No react-router, no framer-motion, no lucide, no `window`, no
 * `document`, no `localStorage`. The package tsconfig omits the DOM lib, so a browser global here
 * is a compile error rather than a production crash.
 *
 * WHAT DIFFERS BETWEEN SURFACES IS INJECTED, NOT DUPLICATED:
 *
 *   LinkComponent  the SPA passes a router `Link`; the server renderer gets a plain `<a>`.
 *   logo           the SPA passes the real themeable `BrandLogo` (which reads the DOM and admin
 *                  branding, so it can never live here); the renderer passes a static image.
 *   mobileMenu     the SPA passes its existing stateful hamburger, untouched; the renderer passes
 *                  a `<details>` disclosure that works with no JavaScript at all.
 *
 * Structure is shared, interaction is injected. Nothing is copied.
 */

import type { ReactNode } from 'react';

/**
 * A link renderer. Defaults to a plain anchor, which is what the server renderer wants and what
 * keeps every link crawlable.
 */
export type ShellLink = (props: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) => ReactNode;

const DefaultLink: ShellLink = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

// ─── Configuration — the single source of truth ──────────────────────────────

/** Primary navigation, in the order the marketing site shows it. */
export const SITE_NAV_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/privacy', label: 'Privacy & Safety' },
] as const;

/** Header account actions. */
export const SITE_NAV_ACTIONS = {
  logIn: { href: '/login', label: 'Log In' },
  getStarted: { href: '/#pricing', label: 'Get Started' },
} as const;

/** Footer columns, matching the marketing footer exactly. */
export const SITE_FOOTER_COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/how-it-works', label: 'How It Works' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/privacy', label: 'Privacy & Safety' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/terms', label: 'Terms & Conditions' },
      { href: '/privacy', label: 'Privacy Policy' },
    ],
  },
  {
    heading: 'Get Started',
    links: [
      { href: '/signup', label: 'Sign Up' },
      { href: '/login', label: 'Log In' },
      { href: '/admin/login', label: 'Admin Portal', muted: true },
    ],
  },
] as const;

export const SITE_FOOTER_TAGLINE = 'Your AI-powered wellness companion, available 24/7';
export const SITE_FOOTER_COPYRIGHT_YEAR = 2026;
export const SITE_FOOTER_DISCLAIMER =
  'This is not a replacement for professional medical or mental health services.';

// ─── Header ──────────────────────────────────────────────────────────────────

export interface PublicSiteHeaderProps {
  /** Current path, for the active-link underline. */
  pathname?: string;
  /** Router-aware link on the SPA; plain anchor on the server. */
  LinkComponent?: ShellLink;
  /** The real `BrandLogo` on the SPA; a static image on the server. */
  logo: ReactNode;
  /**
   * The narrow-viewport menu. The SPA passes its existing stateful implementation unchanged; the
   * renderer passes a `<details>` disclosure. Omitted means no menu is rendered at all, which is
   * never what a caller wants — so both callers supply one.
   */
  mobileMenu?: ReactNode;
}

export function PublicSiteHeader({
  pathname,
  LinkComponent = DefaultLink,
  logo,
  mobileMenu,
}: PublicSiteHeaderProps) {
  const Link = LinkComponent;

  return (
    <header className="sol-site-header">
      <div className="sol-site-header-inner">
        <Link href="/" className="sol-site-logo">
          {logo}
        </Link>

        <nav className="sol-site-nav" aria-label="Primary">
          {SITE_NAV_LINKS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <span key={item.href} className="sol-site-nav-item">
                <Link
                  href={item.href}
                  className={isActive ? 'sol-site-nav-link sol-site-nav-link-active' : 'sol-site-nav-link'}
                >
                  {item.label}
                </Link>
                {isActive ? <span className="sol-site-nav-underline" aria-hidden="true" /> : null}
              </span>
            );
          })}
        </nav>

        <div className="sol-site-actions">
          <Link href={SITE_NAV_ACTIONS.logIn.href} className="sol-site-login">
            {SITE_NAV_ACTIONS.logIn.label}
          </Link>
          <Link href={SITE_NAV_ACTIONS.getStarted.href} className="sol-btn sol-btn-primary">
            {SITE_NAV_ACTIONS.getStarted.label}
          </Link>
        </div>

        {mobileMenu ? <div className="sol-site-mobile">{mobileMenu}</div> : null}
      </div>
    </header>
  );
}

/**
 * Zero-JavaScript mobile menu for the server-rendered pages.
 *
 * `<details>`/`<summary>` is a native disclosure: it opens, it is keyboard operable, and it
 * announces its expanded state — all without a line of script. The SPA keeps its own stateful
 * hamburger; this exists so the server-rendered page is not a dead button before hydration.
 */
export function SsrMobileMenu({ LinkComponent = DefaultLink }: { LinkComponent?: ShellLink }) {
  const Link = LinkComponent;

  return (
    <details className="sol-site-disclosure">
      <summary aria-label="Open menu">
        <span aria-hidden="true" className="sol-site-burger">
          <span />
          <span />
          <span />
        </span>
      </summary>
      <nav className="sol-site-disclosure-panel" aria-label="Site">
        {SITE_NAV_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="sol-site-disclosure-link">
            {item.label}
          </Link>
        ))}
        <Link href={SITE_NAV_ACTIONS.logIn.href} className="sol-site-disclosure-link">
          {SITE_NAV_ACTIONS.logIn.label}
        </Link>
        <Link href={SITE_NAV_ACTIONS.getStarted.href} className="sol-btn sol-btn-primary">
          {SITE_NAV_ACTIONS.getStarted.label}
        </Link>
      </nav>
    </details>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

export interface PublicSiteFooterProps {
  LinkComponent?: ShellLink;
  logo: ReactNode;
  /** Social icons, which depend on lucide on the SPA. Omitted on the server. */
  social?: ReactNode;
}

export function PublicSiteFooter({ LinkComponent = DefaultLink, logo, social }: PublicSiteFooterProps) {
  const Link = LinkComponent;

  return (
    <footer className="sol-site-footer">
      <div className="sol-site-footer-rule" aria-hidden="true" />
      <div className="sol-site-footer-inner">
        <div className="sol-site-footer-grid">
          <div className="sol-site-footer-brand">
            {logo}
            <p className="sol-site-footer-tagline">{SITE_FOOTER_TAGLINE}</p>
            {social ? <div className="sol-site-footer-social">{social}</div> : null}
          </div>

          {SITE_FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="sol-site-footer-heading">{column.heading}</h2>
              <ul className="sol-site-footer-links">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <Link
                      href={link.href}
                      className={
                        'muted' in link && link.muted
                          ? 'sol-site-footer-link sol-site-footer-link-accent'
                          : 'sol-site-footer-link'
                      }
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="sol-site-footer-legal">
          <p>&copy; {SITE_FOOTER_COPYRIGHT_YEAR} Solace. All rights reserved.</p>
          <p>{SITE_FOOTER_DISCLAIMER}</p>
        </div>
      </div>
    </footer>
  );
}

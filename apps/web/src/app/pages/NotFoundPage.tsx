import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  page: {
    alignItems: 'center',
    background: 'radial-gradient(circle at top, #24324f 0%, #111827 48%, #090d16 100%)',
    boxSizing: 'border-box',
    color: '#f8fafc',
    display: 'flex',
    fontFamily: '"DM Sans", system-ui, sans-serif',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '32px 20px',
  },
  card: {
    background: 'rgba(15, 23, 42, 0.78)',
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: '28px',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.38)',
    maxWidth: '680px',
    padding: 'clamp(32px, 7vw, 64px)',
    textAlign: 'center',
    width: '100%',
  },
  eyebrow: {
    color: '#a5b4fc',
    fontSize: '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.18em',
    margin: '0 0 18px',
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: '"Cormorant Garamond", Georgia, serif',
    fontSize: 'clamp(2.7rem, 8vw, 5rem)',
    fontWeight: 600,
    lineHeight: 0.95,
    margin: 0,
  },
  copy: {
    color: '#cbd5e1',
    fontSize: '1.08rem',
    lineHeight: 1.7,
    margin: '24px auto 32px',
    maxWidth: '500px',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
  },
  primary: {
    background: '#f8fafc',
    borderRadius: '999px',
    color: '#111827',
    fontWeight: 700,
    padding: '12px 22px',
    textDecoration: 'none',
  },
  secondary: {
    border: '1px solid rgba(203, 213, 225, 0.38)',
    borderRadius: '999px',
    color: '#e2e8f0',
    fontWeight: 600,
    padding: '12px 22px',
    textDecoration: 'none',
  },
};

/** Shared, data-free experience for both Vercel's static 404 and SPA navigation misses. */
export function NotFoundPage() {
  return (
    <main style={styles.page}>
      <section aria-labelledby="not-found-heading" style={styles.card}>
        <p style={styles.eyebrow}>404 · Solace</p>
        <h1 id="not-found-heading" style={styles.heading}>Page not found</h1>
        <p style={styles.copy}>
          The page you were looking for could not be found. It may have moved, or the address may
          be incomplete.
        </p>
        <nav aria-label="Not found actions" style={styles.actions}>
          <a href="/" style={styles.primary}>Return home</a>
          <a href="/resources" style={styles.secondary}>Browse resources</a>
        </nav>
      </section>
    </main>
  );
}

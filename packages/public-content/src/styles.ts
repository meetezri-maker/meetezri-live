/**
 * The public Resources stylesheet, as a string.
 *
 * A string rather than a `.css` file on purpose: the server renderer inlines it into `<head>`
 * and the SPA injects the same string, so both renders are byte-identical without this package
 * depending on a bundler, a Tailwind scan path, or a build step that only one of the two apps
 * runs. It also means the server-rendered page is complete on its own — no render-blocking
 * stylesheet fetch, no flash of unstyled content before hydration.
 *
 * Colours mirror the Solace public site rather than the admin theme.
 */

export const PUBLIC_CONTENT_CSS = `
/* ─── Shared public-site shell ─────────────────────────────────────────────
   Self-contained on purpose. The renderer links the web build's Tailwind when the asset
   manifest resolves, but that lookup is best-effort by design — so the header, footer and
   buttons carry their own styling and stay presentable even when it does not. */
.sol-site-header{position:relative;z-index:50;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(7,8,21,.75);backdrop-filter:blur(24px);box-shadow:inset 0 -1px 0 rgba(233,30,99,.14)}
.sol-site-header-inner{position:relative;margin:0 auto;display:flex;height:4rem;max-width:80rem;align-items:center;justify-content:space-between;gap:1rem;padding:0 1rem}
@media(min-width:640px){.sol-site-header-inner{padding:0 1.5rem}}
@media(min-width:1024px){.sol-site-header-inner{padding:0 2rem}}
.sol-site-logo{position:relative;z-index:10;display:flex;flex-shrink:0;align-items:center;text-decoration:none}
.sol-site-logo img{height:2.5rem;width:auto;display:block}

.sol-site-nav{position:absolute;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:2rem;font-size:.875rem;letter-spacing:.015em;color:rgba(237,233,254,.78)}
@media(min-width:768px){.sol-site-nav{display:flex}}
.sol-site-nav-item{position:relative;padding-bottom:.25rem}
.sol-site-nav-link{color:inherit;text-decoration:none;transition:color .15s}
.sol-site-nav-link:hover{color:rgba(255,255,255,.95)}
.sol-site-nav-link-active{color:#fff}
.sol-site-nav-underline{position:absolute;bottom:-.125rem;left:0;right:0;height:1px;background:linear-gradient(to right,#E91E63,#e879f9,#9C27B0);box-shadow:0 0 14px rgba(233,30,99,.65)}

.sol-site-actions{position:relative;z-index:10;display:none;align-items:center;gap:1.25rem}
@media(min-width:640px){.sol-site-actions{display:flex}}
.sol-site-login{font-size:.875rem;color:rgba(237,233,254,.78);text-decoration:none;transition:color .15s}
.sol-site-login:hover{color:#fff}

.sol-site-mobile{position:relative;z-index:10}
@media(min-width:640px){.sol-site-mobile{display:none}}
.sol-site-disclosure summary{display:flex;height:2.25rem;width:2.25rem;cursor:pointer;align-items:center;justify-content:center;border-radius:.5rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);list-style:none}
.sol-site-disclosure summary::-webkit-details-marker{display:none}
.sol-site-disclosure summary:focus-visible{outline:2px solid var(--sol-accent,#5eead4);outline-offset:2px}
.sol-site-burger{display:flex;flex-direction:column;gap:3px}
.sol-site-burger span{display:block;height:1.5px;width:16px;background:rgba(255,255,255,.9)}
.sol-site-disclosure-panel{position:absolute;right:0;top:calc(100% + .5rem);z-index:60;display:flex;min-width:14rem;flex-direction:column;gap:.75rem;border:1px solid rgba(255,255,255,.08);border-radius:.75rem;background:rgba(7,8,18,.97);padding:1rem;font-size:.875rem}
.sol-site-disclosure-link{color:rgba(237,233,254,.85);text-decoration:none}
.sol-site-disclosure-link:hover{color:#fff}

.sol-site-footer{border-top:1px solid rgba(255,255,255,.08);background:rgba(4,6,15,.9)}
.sol-site-footer-rule{margin:0 auto;height:1px;max-width:80rem;background:linear-gradient(to right,transparent,rgba(139,92,246,.35),transparent)}
.sol-site-footer-inner{margin:0 auto;max-width:80rem;padding:2.5rem 1rem}
@media(min-width:768px){.sol-site-footer-inner{padding:3rem 2rem}}
.sol-site-footer-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2rem}
@media(min-width:768px){.sol-site-footer-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.sol-site-footer-brand{grid-column:span 2}
@media(min-width:768px){.sol-site-footer-brand{grid-column:span 1}}
.sol-site-footer-brand img{height:3.5rem;width:auto;display:block}
.sol-site-footer-tagline{margin:.75rem 0 0;font-size:.875rem;color:rgba(237,233,254,.6)}
.sol-site-footer-social{margin-top:1rem;display:flex;gap:.625rem}
.sol-site-footer-heading{margin:0 0 .75rem;font-size:.875rem;font-weight:600;color:#fff}
.sol-site-footer-links{list-style:none;margin:0;padding:0;font-size:.875rem}
.sol-site-footer-links li{margin-bottom:.375rem}
.sol-site-footer-link{color:rgba(237,233,254,.6);text-decoration:none}
.sol-site-footer-link:hover{color:#fff}
.sol-site-footer-link-accent{color:rgba(196,181,253,.9)}
.sol-site-footer-legal{margin-top:2rem;border-top:1px solid rgba(255,255,255,.06);padding-top:1.5rem;text-align:center;font-size:.75rem;color:rgba(237,233,254,.6)}
.sol-site-footer-legal p{margin:0 0 .375rem}

/* Public button language, matching the marketing site's pill CTA and ghost/outline pair. */
.sol-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;border-radius:999px;padding:.625rem 1.5rem;font-size:.8125rem;font-weight:500;text-decoration:none;cursor:pointer;border:1px solid transparent;transition:transform .15s,background .15s,color .15s;line-height:1.2}
.sol-btn:focus-visible{outline:2px solid var(--sol-accent,#5eead4);outline-offset:2px}
.sol-btn-primary{background:linear-gradient(to right,#E91E63,#9C27B0);color:#fff}
.sol-btn-primary:hover{transform:scale(1.02)}
.sol-btn-primary:active{transform:scale(.98)}
.sol-btn-secondary{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.14);color:#fff}
.sol-btn-secondary:hover{background:rgba(255,255,255,.09)}
.sol-btn-ghost{background:transparent;color:rgba(237,233,254,.78)}
.sol-btn-ghost:hover{color:#fff;background:rgba(255,255,255,.06)}

.sol-page{--sol-bg:#07090f;--sol-fg:#e8ecf4;--sol-muted:#a3adc2;--sol-line:rgba(255,255,255,.12);--sol-accent:#5eead4;--sol-link:#7dd3fc;color:var(--sol-fg);max-width:72rem;margin:0 auto;padding:1.5rem 1.25rem 4rem;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.65}
.sol-page a{color:var(--sol-link)}
.sol-page a:focus-visible,.sol-page button:focus-visible{outline:2px solid var(--sol-accent);outline-offset:2px;border-radius:4px}
.sol-page img{max-width:100%;height:auto}

.sol-breadcrumbs{margin-bottom:1.5rem;font-size:.8125rem;color:var(--sol-muted)}
.sol-breadcrumbs ol{display:flex;flex-wrap:wrap;gap:.5rem;list-style:none;margin:0;padding:0}
.sol-breadcrumbs li+li::before{content:"/";margin-right:.5rem;color:var(--sol-line)}

.sol-label{display:inline-block;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--sol-accent);margin:0 0 .5rem}
.sol-lede{color:var(--sol-muted);font-size:1.0625rem;margin:.75rem 0 0;max-width:44rem}

.sol-library-header h1,.sol-article-header h1{font-size:clamp(1.75rem,4vw,2.5rem);line-height:1.2;margin:0;font-weight:650;letter-spacing:-.01em}
.sol-library-header{margin-bottom:2rem}

.sol-filters ul{display:flex;flex-wrap:wrap;gap:.5rem;list-style:none;margin:0 0 2rem;padding:0}

.sol-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(17rem,1fr));gap:1.25rem;list-style:none;margin:0;padding:0}
.sol-card{border:1px solid var(--sol-line);border-radius:.875rem;overflow:hidden;background:rgba(255,255,255,.025)}
.sol-card-media{display:block}
.sol-card-media img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.sol-card-body{padding:1.125rem}
.sol-card-title{font-size:1.0625rem;line-height:1.35;margin:0 0 .5rem;font-weight:600}
.sol-card-title a{color:var(--sol-fg);text-decoration:none}
.sol-card-title a:hover{text-decoration:underline}
.sol-card-desc{color:var(--sol-muted);font-size:.9375rem;margin:0 0 .75rem}
.sol-card-meta{color:var(--sol-muted);font-size:.8125rem;margin:0}

.sol-empty{color:var(--sol-muted);padding:2rem 0}
.sol-pagination{display:flex;align-items:center;gap:1rem;margin:2rem 0;font-size:.9375rem;color:var(--sol-muted)}

.sol-article{max-width:44rem}
.sol-article-meta{color:var(--sol-muted);font-size:.875rem;margin:1rem 0 0}
.sol-hero{border-radius:.875rem;margin:2rem 0 0;width:100%}

.sol-primary-question{font-size:1.125rem;color:var(--sol-fg);margin:2rem 0 0;font-weight:600}
.sol-citation-summary{border-left:3px solid var(--sol-accent);padding:.25rem 0 .25rem 1rem;margin:2rem 0 0;color:var(--sol-fg)}
.sol-toc{border:1px solid var(--sol-line);border-radius:.75rem;padding:1rem 1.25rem;margin:2rem 0 0}
.sol-toc h2{font-size:.875rem;text-transform:uppercase;letter-spacing:.06em;color:var(--sol-muted);margin:0 0 .5rem}
.sol-toc ol{margin:0;padding-left:1.25rem;font-size:.9375rem}

.sol-prose{margin-top:2rem}
.sol-prose .sol-p{margin:0 0 1.25rem}
.sol-prose .sol-h{margin:2.5rem 0 1rem;font-weight:650;line-height:1.3;scroll-margin-top:2rem}
.sol-prose h2.sol-h{font-size:1.5rem}
.sol-prose h3.sol-h{font-size:1.1875rem}
.sol-prose .sol-list{margin:0 0 1.25rem;padding-left:1.5rem}
.sol-prose .sol-list li{margin-bottom:.375rem}
.sol-prose code{background:rgba(255,255,255,.08);padding:.1rem .3rem;border-radius:.25rem;font-size:.9em}
.sol-quote{border-left:3px solid var(--sol-line);margin:0 0 1.5rem;padding-left:1.25rem;font-style:italic;color:var(--sol-muted)}
.sol-quote cite{display:block;margin-top:.5rem;font-style:normal;font-size:.875rem}

.sol-answer{border:1px solid rgba(94,234,212,.35);background:rgba(94,234,212,.07);border-radius:.75rem;padding:1.25rem;margin:0 0 1.75rem}
.sol-answer p{margin:0;font-size:1.0625rem}
.sol-takeaway{border:1px solid var(--sol-line);background:rgba(255,255,255,.04);border-radius:.75rem;padding:1.25rem;margin:0 0 1.75rem}
.sol-takeaway-title{margin:0 0 .5rem;font-weight:600}
.sol-takeaway ul{margin:0;padding-left:1.25rem}
.sol-notice{border:1px solid rgba(251,191,36,.35);background:rgba(251,191,36,.07);border-radius:.75rem;padding:1.25rem;margin:1.75rem 0}
.sol-notice-crisis{border-color:rgba(248,113,113,.45);background:rgba(248,113,113,.08)}
.sol-notice-heading{margin:0 0 .375rem;font-weight:600}
.sol-notice p{margin:0;font-size:.9375rem}

.sol-cta{border:1px solid rgba(94,234,212,.3);border-radius:.875rem;padding:1.5rem;margin:2rem 0}
.sol-cta h2{margin:0 0 .5rem;font-size:1.25rem}
.sol-cta p{color:var(--sol-muted);margin:0 0 1rem}

.sol-figure{margin:0 0 1.75rem}
.sol-figure figcaption{color:var(--sol-muted);font-size:.8125rem;margin-top:.5rem}
.sol-credit{display:block}
.sol-divider{border:0;border-top:1px solid var(--sol-line);margin:2.5rem 0}

.sol-faq{margin:2.5rem 0}
.sol-faq h2{font-size:1.5rem;margin:0 0 1rem}
.sol-faq dl{margin:0}
.sol-faq-item{border-top:1px solid var(--sol-line);padding:1.125rem 0}
.sol-faq dt{font-weight:600;margin:0 0 .5rem}
.sol-faq dd{margin:0;color:var(--sol-muted)}

.sol-table-scroll{overflow-x:auto;margin:0 0 1.75rem;-webkit-overflow-scrolling:touch}
.sol-table{border-collapse:collapse;width:100%;min-width:32rem;font-size:.9375rem}
.sol-table caption{text-align:left;color:var(--sol-muted);font-size:.8125rem;margin-bottom:.5rem}
.sol-table th,.sol-table td{border-bottom:1px solid var(--sol-line);padding:.625rem .75rem;text-align:left;vertical-align:top}
.sol-table th{font-weight:600;color:var(--sol-muted)}

.sol-statement{margin:0 0 1.75rem;border-left:3px solid rgba(167,139,250,.6);padding-left:1.25rem}
.sol-statement-text{font-size:1.0625rem;margin:0}
.sol-statement-examples{color:var(--sol-muted);font-size:.9375rem;margin:.625rem 0 0;padding-left:1.25rem}
.sol-statement-clarification{color:var(--sol-muted);margin:.625rem 0 0}
.sol-source{color:var(--sol-muted);font-size:.875rem;margin:0 0 .5rem;overflow-wrap:anywhere}

.sol-key-statements{margin:2.5rem 0}
.sol-key-statements h2{font-size:1.25rem;margin:0 0 .75rem}
.sol-inline-related{margin:2.5rem 0}
.sol-inline-related h2{font-size:1.25rem;margin:0 0 .5rem}
.sol-inline-related ul{list-style:none;margin:0;padding:0}
.sol-inline-related li{padding:.375rem 0}
.sol-inline-related .sol-label{margin-left:.5rem}

.sol-authors{display:flex;flex-wrap:wrap;gap:2rem;border-top:1px solid var(--sol-line);margin-top:3rem;padding-top:1.5rem}
.sol-byline{display:flex;gap:.875rem;align-items:flex-start;max-width:22rem}
.sol-avatar{width:2.75rem;height:2.75rem;border-radius:999px;object-fit:cover;flex-shrink:0}
.sol-byline-name{margin:0;font-weight:600}
.sol-byline-role{color:var(--sol-muted);font-weight:400;font-size:.875rem}
.sol-byline-title{margin:.125rem 0 0;color:var(--sol-muted);font-size:.875rem}
.sol-byline-bio{margin:.5rem 0 0;color:var(--sol-muted);font-size:.875rem}

.sol-related{margin-top:3.5rem}
.sol-related h2{font-size:1.5rem;margin:0 0 1.25rem}

@media (max-width:640px){
  .sol-page{padding:1rem 1rem 3rem}
  .sol-authors{gap:1.25rem}
  .sol-card-grid{grid-template-columns:1fr}
}
`.trim();

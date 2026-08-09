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
.sol-filter{display:inline-block;padding:.375rem .875rem;border:1px solid var(--sol-line);border-radius:999px;font-size:.875rem;text-decoration:none;color:var(--sol-fg)}
.sol-filter-active{background:var(--sol-accent);border-color:var(--sol-accent);color:#04211d;font-weight:600}

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
.sol-cta-link{display:inline-block;background:var(--sol-accent);color:#04211d;padding:.625rem 1.25rem;border-radius:999px;font-weight:600;text-decoration:none}
.sol-cta-link.sol-secondary{background:transparent;color:var(--sol-accent);border:1px solid var(--sol-accent)}

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

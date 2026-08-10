/**
 * Public block renderers — the single implementation, used by all three consumers:
 * the admin preview, the public SPA page, and the runtime server renderer.
 *
 * Rules this file must keep:
 *
 *   - PURE and DETERMINISTIC. No `window`, no `document`, no `Date.now()`, no random ids. The
 *     package tsconfig omits the DOM lib, so a browser global is a compile error, not a runtime
 *     surprise in production SSR.
 *   - NO `dangerouslySetInnerHTML`. Every block maps to real elements and all text renders as
 *     escaped React children. That is the whole point of storing structured JSON rather than
 *     HTML: there is no sanitisation step to forget, because there is no HTML.
 *   - Serializer output only. Internal fields are already absent upstream, so there is no code
 *     path here that could display `coreMessage` or `citationGoal` even if they somehow arrived.
 *   - Block order is preserved exactly as given.
 *   - Unknown block types are dropped silently rather than crashing the page.
 *
 * Styling is plain semantic class names (`sol-*`) defined once in `styles.ts`, not utility
 * classes. The server renderer inlines that stylesheet and the SPA injects the same string, so
 * the two renders are byte-identical without coupling this package to a build tool.
 */

import type { ReactNode } from 'react';
import type { PublicBlock, PublicInline } from './types';
import { anchorFromText } from './format';

/** Only these protocols may appear in a rendered href. */
const SAFE_HREF = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

function safeHref(href: unknown): string | null {
  return typeof href === 'string' && SAFE_HREF.test(href) ? href : null;
}

export function Inline({ content }: { content: PublicInline | undefined }) {
  if (!Array.isArray(content)) return null;

  return (
    <>
      {content.map((span, index) => {
        if (!span || typeof span.text !== 'string') return null;
        const marks = span.marks ?? [];

        let node: ReactNode = span.text;
        if (marks.includes('code')) node = <code>{node}</code>;
        if (marks.includes('italic')) node = <em>{node}</em>;
        if (marks.includes('bold')) node = <strong>{node}</strong>;

        const href = span.link ? safeHref(span.link.href) : null;
        if (href) {
          node = span.link!.external ? (
            <a href={href} rel="noopener noreferrer nofollow" target="_blank">
              {node}
            </a>
          ) : (
            <a href={href}>{node}</a>
          );
        }

        return <span key={index}>{node}</span>;
      })}
    </>
  );
}

/** Plain text of an inline run — for anchor ids and JSON-LD, never for markup. */
export function inlineText(content: PublicInline | undefined): string {
  if (!Array.isArray(content)) return '';
  return content.map((span) => (typeof span?.text === 'string' ? span.text : '')).join('');
}

/**
 * The anchor id for a heading block.
 *
 * ONE function, called by both the heading renderer and the table of contents. When these were
 * computed separately the two disagreed — the heading got a slug from its text, the contents list
 * got `section-N` — and every contents link was dead.
 */
export function headingAnchorId(
  block: Extract<PublicBlock, { type: 'heading' }>,
  index: number
): string {
  return block.anchorId ?? anchorFromText(inlineText(block.content), `section-${index + 1}`);
}

function Block({ block, index }: { block: PublicBlock; index: number }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p className="sol-p">
          <Inline content={block.content} />
        </p>
      );

    case 'heading': {
      // Level 2 or 3 only — the page owns the single H1, and the editor never produces another.
      const Tag = block.level === 3 ? 'h3' : 'h2';
      const id = headingAnchorId(block, index);
      return (
        <Tag id={id} className="sol-h">
          <Inline content={block.content} />
        </Tag>
      );
    }

    case 'list': {
      const Tag = block.style === 'number' ? 'ol' : 'ul';
      return (
        <Tag className="sol-list">
          {(block.items ?? []).map((item, i) => (
            <li key={i}>
              <Inline content={item} />
            </li>
          ))}
        </Tag>
      );
    }

    case 'quote':
      return (
        <blockquote className="sol-quote">
          <p>
            <Inline content={block.content} />
          </p>
          {block.attribution ? <cite>{block.attribution}</cite> : null}
        </blockquote>
      );

    case 'direct_answer':
      // Clear, not sensational: a labelled region a reader and an answer engine can both find.
      return (
        <div className="sol-answer" role="region" aria-label="Direct answer">
          <p>
            <Inline content={block.content} />
          </p>
        </div>
      );

    case 'key_takeaway':
      return (
        <aside className="sol-takeaway" aria-label={block.title ?? 'Key takeaway'}>
          <p className="sol-takeaway-title">{block.title ?? 'Key takeaway'}</p>
          <ul>
            {(block.points ?? []).map((point, i) => (
              <li key={i}>
                <Inline content={point} />
              </li>
            ))}
          </ul>
        </aside>
      );

    case 'safety_notice':
      return (
        <aside
          role="note"
          className={block.variant === 'crisis' ? 'sol-notice sol-notice-crisis' : 'sol-notice'}
        >
          {block.heading ? <p className="sol-notice-heading">{block.heading}</p> : null}
          <p>
            <Inline content={block.content} />
          </p>
        </aside>
      );

    case 'cta': {
      // Targets are already resolved by the serializer to a managed-content slug or a registry
      // route. Anything that failed to resolve arrives without a usable href and is dropped.
      const href = safeHref(block.href);
      if (!href) return null;
      return (
        <div className="sol-cta">
          {block.description ? <p>{block.description}</p> : null}
          <a
            href={href}
            className={block.style === 'secondary' ? 'sol-btn sol-btn-secondary' : 'sol-btn sol-btn-primary'}
            {...(block.external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
          >
            {block.label}
          </a>
        </div>
      );
    }

    case 'image': {
      const src = safeHref(block.url);
      if (!src) return null;
      return (
        <figure className="sol-figure">
          <img src={src} alt={block.alt} width={block.width} height={block.height} loading="lazy" />
          {block.caption || block.credit ? (
            <figcaption>
              <Inline content={block.caption} />
              {block.credit ? <span className="sol-credit">{block.credit}</span> : null}
            </figcaption>
          ) : null}
        </figure>
      );
    }

    case 'divider':
      return <hr aria-hidden="true" className="sol-divider" />;

    case 'faq':
      return (
        <section className="sol-faq" aria-labelledby={`faq-${block.id}`}>
          <h2 id={`faq-${block.id}`}>{block.heading ?? 'Frequently asked questions'}</h2>
          {/*
            A plain definition list, never a collapsed accordion. Answers stay in the DOM so
            crawlers and answer engines read them without executing JavaScript — which is the
            entire reason this content model exists.
          */}
          <dl>
            {(block.items ?? []).map((item) => (
              <div key={item.id} className="sol-faq-item">
                <dt>{item.question}</dt>
                <dd>
                  <Inline content={item.answer} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      );

    case 'table':
      return (
        <div className="sol-table-scroll">
          <table className="sol-table">
            {block.caption ? <caption>{block.caption}</caption> : null}
            <thead>
              <tr>
                {(block.headers ?? []).map((header, i) => (
                  <th key={i} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(block.rows ?? []).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex}>
                      <Inline content={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'geo_statement':
      return (
        <div className="sol-statement">
          <p className="sol-statement-text">
            <Inline content={block.statement} />
          </p>
          {Array.isArray(block.examples) && block.examples.length > 0 ? (
            <ul className="sol-statement-examples">
              {block.examples.map((example, i) => (
                <li key={i}>{example}</li>
              ))}
            </ul>
          ) : null}
          {block.clarification ? (
            <p className="sol-statement-clarification">
              <Inline content={block.clarification} />
            </p>
          ) : null}
        </div>
      );

    case 'source': {
      const href = safeHref(block.url);
      return (
        <p className="sol-source">
          {block.label}
          {block.publisher ? ` — ${block.publisher}` : ''}
          {href ? (
            <>
              {' '}
              <a href={href} rel="noopener noreferrer nofollow" target="_blank">
                {href}
              </a>
            </>
          ) : null}
        </p>
      );
    }

    case 'related_content':
      return (
        <section className="sol-inline-related" aria-labelledby={`rel-${block.id}`}>
          <h2 id={`rel-${block.id}`}>{block.heading ?? 'Related resources'}</h2>
          <ul>
            {(block.items ?? []).map((item) => (
              <li key={item.slug}>
                <a href={`/resources/${item.slug}`}>{item.title}</a>
                <span className="sol-label">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>
      );

    default:
      // Unknown types are dropped by the serializer; nothing should reach here.
      return null;
  }
}

export function PublicBlocks({ blocks }: { blocks: PublicBlock[] | undefined }) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, index) => (
        <Block key={block?.id ?? index} block={block} index={index} />
      ))}
    </>
  );
}

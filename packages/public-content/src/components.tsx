/**
 * Page-level public components: breadcrumbs, resource cards, byline, and the two page bodies.
 *
 * Same rules as `blocks.tsx` — pure, deterministic, SSR-safe, serializer output only. These are
 * rendered identically by the server renderer and by the SPA, so anything non-deterministic here
 * becomes a hydration mismatch.
 *
 * `ResourceArticle` and `ResourcesLibrary` are the shared page bodies. The server renderer wraps
 * them in a full HTML document; the SPA wraps them in the marketing shell. Neither owns the
 * markup, so the two can never drift.
 */

import type {
  PublicBlock,
  PublicPerson,
  PublicResource,
  PublicResourceCard,
  PublicLabel,
} from './types';
import { PublicBlocks, headingAnchorId, inlineText } from './blocks';
import { formatPublicDate, formatReadingTime, resourcePath, toIsoDate } from './format';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="sol-breadcrumbs">
      <ol>
        {trail.map((crumb, index) => (
          <li key={index}>
            {crumb.href ? (
              <a href={crumb.href}>{crumb.label}</a>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ResourceCard({ card }: { card: PublicResourceCard }) {
  const published = formatPublicDate(card.publishedAt ?? card.updatedAt);
  const publishedIso = toIsoDate(card.publishedAt ?? card.updatedAt);
  const reading = formatReadingTime(card.readingTimeMinutes);
  const href = resourcePath(card.slug);

  return (
    <li className="sol-card">
      <article>
        {card.featuredImageUrl ? (
          <a href={href} tabIndex={-1} aria-hidden="true" className="sol-card-media">
            <img src={card.featuredImageUrl} alt={card.featuredImageAlt ?? ''} loading="lazy" />
          </a>
        ) : null}
        <div className="sol-card-body">
          <p className="sol-label">{card.label}</p>
          {/*
            The whole heading is the link, so the accessible name is the title — never a bare
            "Read more", which tells a screen-reader user nothing in a list of twelve.
          */}
          <h2 className="sol-card-title">
            <a href={href}>{card.title}</a>
          </h2>
          {card.description ? <p className="sol-card-desc">{card.description}</p> : null}
          <p className="sol-card-meta">
            {publishedIso ? <time dateTime={publishedIso}>{published}</time> : null}
            {publishedIso && reading ? <span aria-hidden="true"> · </span> : null}
            {reading ? <span>{reading}</span> : null}
          </p>
        </div>
      </article>
    </li>
  );
}

export function Byline({ person, role }: { person: PublicPerson | null; role: string }) {
  if (!person) return null;

  return (
    <div className="sol-byline">
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="sol-avatar" /> : null}
      <div>
        <p className="sol-byline-name">
          <span className="sol-byline-role">{role}</span> {person.name}
        </p>
        {/* Never manufactured — rendered only when the serializer actually exposes one. */}
        {person.title ? <p className="sol-byline-title">{person.title}</p> : null}
        {person.bio ? <p className="sol-byline-bio">{person.bio}</p> : null}
      </div>
    </div>
  );
}

export function RelatedResources({ items }: { items: PublicResourceCard[] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="sol-related" aria-labelledby="related-heading">
      <h2 id="related-heading">Related resources</h2>
      <ul className="sol-card-grid">
        {items.slice(0, 3).map((item) => (
          <ResourceCard key={item.slug} card={item} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Ordering hint per public label.
 *
 * The ROUTE and the shell are shared; only emphasis differs. An Answer leads with its direct
 * answer, an Insight with its citable summary, an Article with a table of contents. Everything
 * else is the author's block order, untouched.
 */
function TypeIntro({ resource }: { resource: PublicResource }) {
  const { label, typeFields, body } = resource;

  if (label === 'Answer' && typeFields.primaryQuestion) {
    return <p className="sol-primary-question">{typeFields.primaryQuestion}</p>;
  }

  if (label === 'Insight' && typeFields.citationSummary) {
    return (
      <aside className="sol-citation-summary" aria-label="Summary">
        <p>{typeFields.citationSummary}</p>
      </aside>
    );
  }

  if (label === 'Article') {
    // Index is carried alongside the block: `headingAnchorId` must receive the heading's position
    // in the FULL block list, exactly as the renderer sees it, or the ids drift apart again.
    const headings = (body?.blocks ?? [])
      .map((block, index) => ({ block, index }))
      .filter(
        (entry): entry is { block: Extract<PublicBlock, { type: 'heading' }>; index: number } =>
          entry.block.type === 'heading' && entry.block.level === 2,
      );

    // Only worth a contents list when there is genuinely something to navigate.
    if (headings.length >= 3) {
      return (
        <nav className="sol-toc" aria-labelledby="toc-heading">
          <h2 id="toc-heading">On this page</h2>
          <ol>
            {headings.map(({ block, index }) => (
              <li key={block.id}>
                <a href={`#${headingAnchorId(block, index)}`}>{inlineText(block.content)}</a>
              </li>
            ))}
          </ol>
        </nav>
      );
    }
  }

  return null;
}

/** Insight key statements, when the serializer exposes them. Public fields only. */
function KeyStatements({ statements }: { statements: string[] | undefined }) {
  if (!Array.isArray(statements) || statements.length === 0) return null;
  return (
    <section className="sol-key-statements" aria-labelledby="key-statements-heading">
      <h2 id="key-statements-heading">Key points</h2>
      <ul>
        {statements.map((statement, index) => (
          <li key={index}>{statement}</li>
        ))}
      </ul>
    </section>
  );
}

export function ResourceArticle({ resource }: { resource: PublicResource }) {
  const published = formatPublicDate(resource.publishedAt);
  const publishedIso = toIsoDate(resource.publishedAt);
  const updated = formatPublicDate(resource.updatedAt);
  const updatedIso = toIsoDate(resource.updatedAt);
  const reviewed = formatPublicDate(resource.reviewedAt);
  const reviewedIso = toIsoDate(resource.reviewedAt);
  const reading = formatReadingTime(resource.readingTimeMinutes);

  return (
    <div className="sol-page">
      <Breadcrumbs
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: resource.title },
        ]}
      />

      <article className="sol-article">
        <header className="sol-article-header">
          <p className="sol-label">{resource.label}</p>
          <h1>{resource.title}</h1>
          {resource.description ? <p className="sol-lede">{resource.description}</p> : null}

          <p className="sol-article-meta">
            {publishedIso ? (
              <>
                <span>Published </span>
                <time dateTime={publishedIso}>{published}</time>
              </>
            ) : null}
            {updatedIso && updatedIso !== publishedIso ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>Updated </span>
                <time dateTime={updatedIso}>{updated}</time>
              </>
            ) : null}
            {reviewedIso ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>Reviewed </span>
                <time dateTime={reviewedIso}>{reviewed}</time>
              </>
            ) : null}
            {reading ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>{reading}</span>
              </>
            ) : null}
          </p>
        </header>

        {resource.featuredImageUrl ? (
          <img
            className="sol-hero"
            src={resource.featuredImageUrl}
            alt={resource.featuredImageAlt ?? ''}
          />
        ) : null}

        <TypeIntro resource={resource} />

        <div className="sol-prose">
          <PublicBlocks blocks={resource.body?.blocks} />
        </div>

        {resource.label === 'Insight' ? (
          <KeyStatements statements={resource.typeFields.keyStatements} />
        ) : null}

        {resource.author || resource.reviewer ? (
          <footer className="sol-authors">
            <Byline person={resource.author} role="Written by" />
            <Byline person={resource.reviewer} role="Reviewed by" />
          </footer>
        ) : null}
      </article>

      <RelatedResources items={resource.related ?? []} />
    </div>
  );
}

export interface ResourcesLibraryProps {
  items: PublicResourceCard[];
  total: number;
  page: number;
  pageSize: number;
  /** Active public label filter, or null for "All". */
  activeLabel: PublicLabel | null;
  /** Builds the href for a filter chip or a page link. Passed in so the SPA and the server
   *  renderer can produce the same links without this package knowing about a router. */
  buildHref: (params: { label?: PublicLabel | null; page?: number }) => string;
}

const FILTERS: Array<{ label: PublicLabel | null; text: string }> = [
  { label: null, text: 'All' },
  { label: 'Answer', text: 'Answers' },
  { label: 'Insight', text: 'Insights' },
  { label: 'Article', text: 'Articles' },
];

export function ResourcesLibrary({
  items,
  total,
  page,
  pageSize,
  activeLabel,
  buildHref,
}: ResourcesLibraryProps) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));

  return (
    <div className="sol-page">
      <Breadcrumbs trail={[{ label: 'Home', href: '/' }, { label: 'Resources' }]} />

      <header className="sol-library-header">
        <h1>Solace Resources</h1>
        <p className="sol-lede">
          Clear, careful answers about talking things through, looking after your mental wellbeing,
          and getting support when you need it.
        </p>
      </header>

      {/* One library, filtered — never separate sections per internal strategy. */}
      <nav className="sol-filters" aria-label="Filter resources">
        <ul>
          {FILTERS.map((filter) => {
            const isActive = filter.label === activeLabel;
            return (
              <li key={filter.text}>
                <a
                  href={buildHref({ label: filter.label, page: 1 })}
                  className={isActive ? 'sol-btn sol-btn-primary' : 'sol-btn sol-btn-secondary'}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {filter.text}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {items.length === 0 ? (
        <p className="sol-empty">
          {activeLabel
            ? 'Nothing here yet under this filter. Try “All”.'
            : 'New resources are on the way. Please check back soon.'}
        </p>
      ) : (
        <ul className="sol-card-grid">
          {items.map((item) => (
            <ResourceCard key={item.slug} card={item} />
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="sol-pagination" aria-label="Pagination">
          {page > 1 ? (
            <a rel="prev" href={buildHref({ label: activeLabel, page: page - 1 })}>
              Previous
            </a>
          ) : null}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <a rel="next" href={buildHref({ label: activeLabel, page: page + 1 })}>
              Next
            </a>
          ) : null}
        </nav>
      ) : null}

      <aside className="sol-notice" role="note">
        <p>
          These resources are for information and support. They are not a diagnosis or a substitute
          for professional care. If you are in immediate danger or need urgent help, contact your
          local emergency services or a crisis line straight away.
        </p>
      </aside>

      <section className="sol-cta" aria-labelledby="library-cta">
        <h2 id="library-cta">Someone to talk to</h2>
        <p>Solace is a calm, private space to talk things through whenever you need it.</p>
        <a className="sol-btn sol-btn-primary" href="/how-it-works">
          See how Solace works
        </a>
      </section>
    </div>
  );
}

/**
 * Client-side head synchronisation for the public Resources pages.
 *
 * IMPORTANT: this is NOT the SEO mechanism. The server-rendered HTML already carries the title,
 * description, canonical, robots, Open Graph and JSON-LD before any JavaScript runs — see
 * `apps/api/src/modules/render/`. This hook exists solely so that CLIENT-SIDE navigation between
 * resources (which never touches the server) keeps the head honest for a browsing human and for
 * anything that reads the live DOM.
 *
 * It follows the same imperative pattern as `usePrelaunchMeta.ts`, because this app has no
 * metadata framework and adding one for two routes would be the larger change.
 */

import { useEffect } from 'react';

export interface PublicMetaInput {
  title: string;
  description?: string | null;
  canonical?: string | null;
  robots?: string | null;
}

function upsert(selector: string, tag: 'meta' | 'link', attrs: Record<string, string>) {
  let element = document.head.querySelector(selector);
  const created = !element;
  if (!element) {
    element = document.createElement(tag);
    document.head.appendChild(element);
  }
  const previous: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(attrs)) {
    previous[key] = element.getAttribute(key);
    element.setAttribute(key, value);
  }
  return { element, created, previous };
}

export function usePublicMeta({ title, description, canonical, robots }: PublicMetaInput) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const undo: Array<() => void> = [];

    const track = (result: ReturnType<typeof upsert>) => {
      undo.push(() => {
        if (result.created) {
          result.element.remove();
          return;
        }
        for (const [key, value] of Object.entries(result.previous)) {
          if (value === null) result.element.removeAttribute(key);
          else result.element.setAttribute(key, value);
        }
      });
    };

    if (description) {
      track(upsert('meta[name="description"]', 'meta', { name: 'description', content: description }));
      track(
        upsert('meta[property="og:description"]', 'meta', {
          property: 'og:description',
          content: description,
        })
      );
    }
    if (canonical) {
      track(upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: canonical }));
      track(upsert('meta[property="og:url"]', 'meta', { property: 'og:url', content: canonical }));
    }
    if (robots) {
      track(upsert('meta[name="robots"]', 'meta', { name: 'robots', content: robots }));
    }
    track(upsert('meta[property="og:title"]', 'meta', { property: 'og:title', content: title }));

    return () => {
      document.title = previousTitle;
      for (const restore of undo) restore();
    };
  }, [title, description, canonical, robots]);
}

/** Absolute canonical for the current origin. Browser-only — the server has its own. */
export function clientCanonical(path: string): string | null {
  if (typeof window === 'undefined') return null;
  return `${window.location.origin}${path}`;
}

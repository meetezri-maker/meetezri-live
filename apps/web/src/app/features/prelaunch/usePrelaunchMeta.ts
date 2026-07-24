import { useEffect } from "react";
import { PRELAUNCH_META, PRELAUNCH_ROUTE } from "./prelaunch.content";

/**
 * Page metadata for the pre-launch landing page.
 *
 * This app has no metadata framework (no Helmet, no SSR head), so tags are set
 * imperatively on mount and restored on unmount — the same approach
 * `MobileMetaTags` already uses. URLs derive from the live origin rather than a
 * hard-coded production host.
 */
export function usePrelaunchMeta() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PRELAUNCH_META.title;

    const origin = window.location.origin;
    const canonicalUrl = `${origin}${PRELAUNCH_ROUTE}`;
    const imageUrl = `${origin}${PRELAUNCH_META.ogImage}`;

    const created: Element[] = [];
    const restored: Array<{ el: Element; attr: string; value: string | null }> = [];

    function setMeta(selector: string, attrs: Record<string, string>) {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement(selector.startsWith("link") ? "link" : "meta");
        for (const [key, value] of Object.entries(attrs)) {
          el.setAttribute(key, value);
        }
        document.head.appendChild(el);
        created.push(el);
        return;
      }

      for (const [key, value] of Object.entries(attrs)) {
        restored.push({ el, attr: key, value: el.getAttribute(key) });
        el.setAttribute(key, value);
      }
    }

    setMeta('meta[name="description"]', {
      name: "description",
      content: PRELAUNCH_META.description,
    });
    // Ad traffic only — indexing is intentionally deferred until public launch.
    setMeta('meta[name="robots"]', { name: "robots", content: "noindex, follow" });
    setMeta('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });

    setMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    setMeta('meta[property="og:title"]', {
      property: "og:title",
      content: PRELAUNCH_META.title,
    });
    setMeta('meta[property="og:description"]', {
      property: "og:description",
      content: PRELAUNCH_META.description,
    });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    setMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });

    setMeta('meta[name="twitter:card"]', {
      name: "twitter:card",
      content: "summary_large_image",
    });
    setMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: PRELAUNCH_META.title,
    });
    setMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: PRELAUNCH_META.description,
    });
    setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });

    return () => {
      document.title = previousTitle;
      for (const { el, attr, value } of restored) {
        if (value === null) el.removeAttribute(attr);
        else el.setAttribute(attr, value);
      }
      for (const el of created) el.remove();
    };
  }, []);
}

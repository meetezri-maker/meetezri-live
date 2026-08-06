/**
 * Content type badge.
 *
 * THE ONLY PLACE a content type becomes user-visible text. The label comes from the shared
 * `PUBLIC_CONTENT_LABEL` map, so "AEO", "GEO" and "SEO" cannot reach a screen — the internal
 * value is never rendered, only used to pick a colour.
 */

import { PUBLIC_CONTENT_LABEL } from "@meetezri/shared";
import { cn } from "@/lib/utils";
import type { ContentHubContentType } from "@/lib/api";

/** Colour only distinguishes types at a glance; the label always carries the meaning. */
const TYPE_STYLES: Record<ContentHubContentType, string> = {
  aeo_answer: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  geo_article: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  seo_blog: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

export interface ContentTypeBadgeProps {
  contentType: ContentHubContentType;
  /** Server-provided label. Falls back to the shared map when absent. */
  label?: string;
  className?: string;
}

export function ContentTypeBadge({ contentType, label, className }: ContentTypeBadgeProps) {
  const text = label ?? PUBLIC_CONTENT_LABEL[contentType];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TYPE_STYLES[contentType],
        className,
      )}
    >
      {text}
    </span>
  );
}

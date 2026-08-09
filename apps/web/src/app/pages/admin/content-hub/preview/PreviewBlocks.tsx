/**
 * Admin preview block rendering.
 *
 * PHASE 5A: this file no longer contains a renderer. The block components moved to
 * `@meetezri/public-content`, which is now the single implementation shared by the admin preview,
 * the public SPA pages and the runtime server renderer.
 *
 * That matters more than it looks: previously the preview rendered admin-styled markup that
 * merely resembled the public page. Now it renders the exact components and the exact stylesheet
 * a reader will get, so "it looked right in preview" and "it looks right in public" are the same
 * statement rather than two hopes.
 *
 * The thin wrapper stays so the preview screen keeps its empty state and its own import path.
 */

import { PublicBlocks, type PublicBlock } from '@meetezri/public-content';

export function PreviewBlocks({ blocks }: { blocks: Array<Record<string, unknown>> }) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return (
      <p className="text-sm text-[var(--admin-text-muted)]">This document has no content yet.</p>
    );
  }

  // The preview screen types its payload loosely; the serializer has already produced public
  // block shapes by the time it reaches here.
  return <PublicBlocks blocks={blocks as unknown as PublicBlock[]} />;
}

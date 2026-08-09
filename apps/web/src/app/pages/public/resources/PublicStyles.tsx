/**
 * Injects the shared public stylesheet.
 *
 * The same `PUBLIC_CONTENT_CSS` string the server renderer inlines. Rendering it here means a
 * client-side navigation to `/resources` looks identical to a server-rendered load, without this
 * package depending on a bundler-specific CSS import.
 *
 * `id` is fixed so a second mount does not duplicate the rules, and so the server-rendered copy
 * (already in `<head>`) is the one that wins on a hydrated page.
 */

import { PUBLIC_CONTENT_CSS } from '@meetezri/public-content';

export function PublicStyles() {
  return <style id="sol-public-content-css">{PUBLIC_CONTENT_CSS}</style>;
}

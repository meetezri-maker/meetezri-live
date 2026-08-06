/**
 * Content Hub — route registry.
 *
 * Links store a KEY, not a URL. A route change is then a one-line edit here rather than a data
 * migration across every stored link.
 *
 * ZOD-FREE BY CONTRACT — see `constants.ts`.
 */

export interface RouteRegistryEntry {
  /** Public href this key resolves to. */
  href: string;
  /** Human label, used when a link has no anchor text. */
  label: string;
  /**
   * True when the mapping is a stand-in for a page that does not exist yet. Interim mappings are
   * intentionally visible so they can be found and retargeted rather than quietly becoming
   * permanent.
   */
  interim?: boolean;
  /** Why the mapping is interim, and what should replace it. */
  interimNote?: string;
}

/**
 * The registry. Every key is a genuinely public, unauthenticated route.
 *
 * Authenticated destinations (`/app/*`) are deliberately absent: an anonymous reader arriving
 * from an AI citation must never be sent into a login wall.
 */
export const ROUTE_REGISTRY = {
  'product.talk_it_out': {
    href: '/how-it-works',
    label: 'Talk It Out',
    interim: true,
    interimNote:
      'INTERIM. No dedicated Talk It Out marketing page exists yet; /how-it-works is the closest ' +
      'genuinely public page (it references Talk It Out throughout). Retarget to /talk-it-out ' +
      'once Product ships it — changing this one value is the entire migration.',
  },
  resource_library: {
    href: '/resources',
    label: 'Mental Wellness Resources',
  },
  pricing: {
    href: '/pricing',
    label: 'Pricing',
  },
  how_it_works: {
    href: '/how-it-works',
    label: 'How It Works',
  },
  home: {
    href: '/',
    label: 'Home',
  },
} as const satisfies Record<string, RouteRegistryEntry>;

export type RouteKey = keyof typeof ROUTE_REGISTRY;

/** All valid keys, for validation and for the admin link picker. */
export const ROUTE_KEYS = Object.keys(ROUTE_REGISTRY) as RouteKey[];

/** Whether a string is a known route key. Publish validation rejects unmapped keys. */
export function isRouteKey(value: unknown): value is RouteKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROUTE_REGISTRY, value);
}

/** Resolve a key to its href, or `null` when unknown. */
export function resolveRouteHref(key: string): string | null {
  return isRouteKey(key) ? ROUTE_REGISTRY[key].href : null;
}

/** Resolve a key to its display label, or `null` when unknown. */
export function resolveRouteLabel(key: string): string | null {
  return isRouteKey(key) ? ROUTE_REGISTRY[key].label : null;
}

/** Keys still pointing at a stand-in destination. Surfaced in the admin link editor. */
export function interimRouteKeys(): RouteKey[] {
  // `as satisfies` keeps each entry's literal type, so `interim` is absent from the type of
  // entries that omit it. Widen to the interface for this lookup rather than adding
  // `interim: false` noise to every permanent entry.
  return ROUTE_KEYS.filter((key) => (ROUTE_REGISTRY[key] as RouteRegistryEntry).interim === true);
}

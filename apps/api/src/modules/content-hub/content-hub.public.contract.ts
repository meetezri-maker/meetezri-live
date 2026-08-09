/**
 * Content Hub — THE PUBLIC CONTRACT BINDING.
 *
 * `content-hub.public.schema.ts` owns the RUNTIME truth (the Zod schemas Fastify validates every
 * public response against). `@meetezri/public-content` owns the TYPE truth (`PublicResource`,
 * consumed by the server renderer, the public SPA and the admin preview).
 *
 * This file is the weld between them. It contains no runtime logic worth speaking of — its whole
 * job is to fail compilation if the two ever disagree, in EITHER direction:
 *
 *   schema → type   a field the API serialises that the renderer contract does not describe
 *   type → schema   a field the contract promises that the API does not actually serialise
 *
 * Without both directions the alias in `content-hub.public.schema.ts` would be an assumption.
 * With them it is checked on every build.
 *
 * WHY THIS EXISTS AT ALL: the public types used to be `z.infer<…>`, which made them a function of
 * the compiler settings in force at build time. Zod v3 decides optionality with
 * `undefined extends T[k]`, true for every property when `strictNullChecks` is off, so a build
 * that lost the flag inferred every public field as optional and production failed to compile.
 * The types are now stated; this file is what stops "stated" from drifting into "wrong".
 */

import type { z } from 'zod';
import type {
  PublicBlock as PublicBlockContract,
  PublicResource,
  PublicResourceCard,
} from '@meetezri/public-content';
import type {
  publicBlockSchema,
  publicCardSchema,
  publicDetailSchema,
} from './content-hub.public.schema';

/** `A extends B` as a compile-time assertion. Resolves to `never` — and fails — when it does not. */
type Assert<Condition extends true> = Condition;
type Extends<A, B> = [A] extends [B] ? true : false;

type InferredDetail = z.infer<typeof publicDetailSchema>;
type InferredCard = z.infer<typeof publicCardSchema>;
type InferredBlock = z.infer<typeof publicBlockSchema>;

// ─── schema → type ───────────────────────────────────────────────────────────
// Fails if the API serialises something the renderer contract cannot describe.

export type _DetailSatisfiesContract = Assert<Extends<InferredDetail, PublicResource>>;
export type _CardSatisfiesContract = Assert<Extends<InferredCard, PublicResourceCard>>;
export type _BlockSatisfiesContract = Assert<Extends<InferredBlock, PublicBlockContract>>;

// ─── type → schema ───────────────────────────────────────────────────────────
// Fails if the contract promises a field the API does not actually serialise. This is the
// direction that keeps the allow-list doctrine honest: adding a field to `PublicResource` does
// NOT make it public — it makes this file fail until the Zod schema is updated to match.

export type _ContractSatisfiesDetail = Assert<Extends<PublicResource, InferredDetail>>;
export type _ContractSatisfiesCard = Assert<Extends<PublicResourceCard, InferredCard>>;
export type _ContractSatisfiesBlock = Assert<Extends<PublicBlockContract, InferredBlock>>;

/**
 * The canary.
 *
 * `RequiredKeys` reports the keys that are genuinely required. Under `strictNullChecks` these are
 * every public field; without it, Zod's inference makes them all optional and this collapses to
 * `never`, failing the assertions below.
 *
 * This is the check that would have caught the deploy failure at its source rather than three
 * layers downstream at a JSX prop, so it is asserted against the INFERRED type deliberately —
 * the stated aliases cannot degrade, but the inference can, and that is what needs watching.
 */
type RequiredKeys<T> = { [K in keyof T]-?: object extends Pick<T, K> ? never : K }[keyof T];

export type _SlugIsRequired = Assert<Extends<'slug', RequiredKeys<InferredDetail>>>;
export type _LabelIsRequired = Assert<Extends<'label', RequiredKeys<InferredDetail>>>;
export type _TitleIsRequired = Assert<Extends<'title', RequiredKeys<InferredDetail>>>;
export type _BodyIsRequired = Assert<Extends<'body', RequiredKeys<InferredDetail>>>;
export type _CanonicalPathIsRequired = Assert<Extends<'canonicalPath', RequiredKeys<InferredDetail>>>;
export type _RobotsIsRequired = Assert<Extends<'robots', RequiredKeys<InferredDetail>>>;

export type _CardSlugIsRequired = Assert<Extends<'slug', RequiredKeys<InferredCard>>>;
export type _CardLabelIsRequired = Assert<Extends<'label', RequiredKeys<InferredCard>>>;
export type _CardTitleIsRequired = Assert<Extends<'title', RequiredKeys<InferredCard>>>;

/**
 * A runtime marker, so this module is retained by the build rather than elided as type-only and
 * silently stopping being checked.
 */
export const PUBLIC_CONTRACT_VERIFIED = true;

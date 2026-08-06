/**
 * Content Hub — WEB Zod v4 create schema. The first web-owned Content Hub schema.
 *
 * DOES NOT IMPORT THE API'S ZOD v3 SCHEMAS. The API is on zod v3 and the web app on v4; a shared
 * schema instance would put two runtimes in one bundle (plan §2.4.1). Agreement is proven by both
 * sides validating the SAME shared inputs — see `contentHubCreate.schema.test.ts`.
 *
 * Built from shared TypeScript types, shared constants and shared PLAIN validators, so the
 * normalisation the user sees in the form is byte-identical to what the server will store.
 */

import { z } from "zod";
import {
  CONTENT_LIMITS,
  CONTENT_TYPES,
  normaliseSlug,
  normaliseTags,
  validateSlug,
} from "@meetezri/shared";

/** Comma/newline separated input → normalised tag list, using the shared algorithm. */
export function parseTagsInput(raw: string): string[] {
  return normaliseTags(raw.split(/[,\n]/));
}

export const contentHubCreateSchema = z.object({
  contentType: z.enum(CONTENT_TYPES),

  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title must be 200 characters or fewer."),

  /**
   * Optional in the form: the server derives one from the title when omitted. When supplied it is
   * held to the same rules the server applies, so the user finds out here rather than after submit.
   */
  slug: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || normaliseSlug(value).length > 0, {
      message: "This slug contains no usable characters.",
    })
    .refine((value) => !value || validateSlug(normaliseSlug(value)).reason !== "reserved", {
      message: "That slug is reserved. Choose another.",
    })
    .refine((value) => !value || normaliseSlug(value).length <= CONTENT_LIMITS.maxSlugLength, {
      message: `Slug must be ${CONTENT_LIMITS.maxSlugLength} characters or fewer.`,
    }),

  pillar: z.string().trim().max(200).optional(),

  week: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return undefined;
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => value === undefined || (Number.isInteger(value) && value >= 1 && value <= 520), {
      message: "Week must be a whole number between 1 and 520.",
    }),

  /** Raw text; normalised on submit. The count rule runs against the NORMALISED list. */
  tagsInput: z
    .string()
    .optional()
    .refine((value) => parseTagsInput(value ?? "").length <= CONTENT_LIMITS.maxTags, {
      message: `At most ${CONTENT_LIMITS.maxTags} tags are allowed.`,
    }),

  editorialRef: z.string().trim().max(64, "Reference must be 64 characters or fewer.").optional(),

  authorId: z.string().uuid("Select a valid author.").optional(),
});

export type ContentHubCreateForm = z.input<typeof contentHubCreateSchema>;
export type ContentHubCreateValues = z.output<typeof contentHubCreateSchema>;

/** Form values → the API's create body, applying shared normalisation exactly once. */
export function toCreateBody(values: ContentHubCreateValues) {
  const slug = values.slug ? normaliseSlug(values.slug) : undefined;
  const tags = parseTagsInput(values.tagsInput ?? "");

  return {
    contentType: values.contentType,
    title: values.title,
    ...(slug ? { slug } : {}),
    ...(values.pillar ? { pillar: values.pillar } : {}),
    ...(values.week !== undefined ? { week: values.week } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(values.editorialRef ? { editorialRef: values.editorialRef } : {}),
    ...(values.authorId ? { authorId: values.authorId } : {}),
  };
}

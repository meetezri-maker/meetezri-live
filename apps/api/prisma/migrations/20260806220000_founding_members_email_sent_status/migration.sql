-- Allow the `email_sent` status on founding_members.
--
-- `20260724120000_founding_members` created a CHECK constraint limiting status
-- to ('waiting', 'invited', 'converted', 'unsubscribed'). The welcome-email flow
-- promotes a row to 'email_sent' once the provider accepts the message, which
-- the original constraint rejects with SQLSTATE 23514. Prisma does not model
-- CHECK constraints, so `schema.prisma` gave no hint this existed.
--
-- Existing values are unaffected: this only widens the allowed set.

ALTER TABLE "public"."founding_members"
    DROP CONSTRAINT IF EXISTS "founding_members_status_check";

ALTER TABLE "public"."founding_members"
    ADD CONSTRAINT "founding_members_status_check"
    CHECK ("status" IN ('waiting', 'email_sent', 'invited', 'converted', 'unsubscribed'));

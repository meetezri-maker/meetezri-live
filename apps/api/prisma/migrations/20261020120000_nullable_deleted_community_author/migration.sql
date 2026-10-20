-- Preserve community posts and their non-target interactions after an author's profile is deleted.
ALTER TABLE "public"."community_posts"
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "public"."community_posts"
  DROP CONSTRAINT "community_posts_user_id_fkey";

ALTER TABLE "public"."community_posts"
  ADD CONSTRAINT "community_posts_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."profiles"("id")
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

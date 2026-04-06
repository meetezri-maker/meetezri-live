-- Admin backup/export audit records (physical DB backups remain host-managed).

CREATE TABLE IF NOT EXISTS "public"."admin_backup_records" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "duration_ms" INTEGER,
    "storage_path" TEXT,
    "metadata" JSONB,
    "error_message" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_backup_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_backup_records_created_at_idx" ON "public"."admin_backup_records"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "admin_backup_records_kind_idx" ON "public"."admin_backup_records"("kind");

ALTER TABLE "public"."admin_backup_records" DROP CONSTRAINT IF EXISTS "admin_backup_records_created_by_fkey";
ALTER TABLE "public"."admin_backup_records" ADD CONSTRAINT "admin_backup_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

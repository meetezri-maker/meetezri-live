-- CreateTable
CREATE TABLE "public"."safety_resource_interactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_name" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "context_session_id" TEXT,
    "safety_state" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT "safety_resource_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "safety_resource_interactions_user_id_created_at_idx" ON "public"."safety_resource_interactions"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."safety_resource_interactions" ADD CONSTRAINT "safety_resource_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

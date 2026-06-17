-- Source Tagging: isSeed flag for cold-start seed data
-- Allows admin purge of seed content while preserving organic user uploads

-- Add isSeed column to Material (default false for user uploads)
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "isSeed" BOOLEAN NOT NULL DEFAULT false;

-- Composite index: efficient querying of seed + organic materials by topic
CREATE INDEX IF NOT EXISTS "Material_topicId_isSeed_idx" ON "Material"("topicId", "isSeed");

-- Simple index: fast admin purge of all seed data
CREATE INDEX IF NOT EXISTS "Material_isSeed_idx" ON "Material"("isSeed");

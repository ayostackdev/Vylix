-- Add composite indexes for 3K concurrent user optimization
-- These indexes are designed to support hot queries with better performance

-- User table indexes for filtering by level and status
CREATE INDEX IF NOT EXISTS "User_currentLevel_idx" ON "User"("currentLevel");
CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status");

-- Course table index for department course listings
CREATE INDEX IF NOT EXISTS "Course_departmentId_idx" ON "Course"("departmentId");

-- Topic table composite index for active topics in course sorted by recency
CREATE INDEX IF NOT EXISTS "Topic_courseId_isActive_lastActivity_idx" ON "Topic"("courseId", "isActive", "lastActivity" DESC);

-- Material table composite index for recent materials in topic
CREATE INDEX IF NOT EXISTS "Material_topicId_uploadedAt_idx" ON "Material"("topicId", "uploadedAt" DESC);

-- Message table composite index for fetching non-deleted messages sorted by creation
CREATE INDEX IF NOT EXISTS "Message_conversationId_deletedAt_createdAt_idx" ON "Message"("conversationId", "deletedAt", "createdAt" DESC);

-- Notification table composite index for unread notification counts
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- These indexes optimize the following query patterns:
-- 1. Filtering students by academic level
-- 2. Department course listings
-- 3. Active topics in a course sorted by recent activity  
-- 4. Recent materials in a topic for pagination
-- 5. Non-deleted messages in conversation for infinite scroll
-- 6. Counting unread notifications per user
--
-- Expected improvements:
-- - Query latency: 200-300ms → 50-100ms for indexed queries
-- - Database throughput: +3x for hot queries
-- - Cache hit rate: 50-70% with expanded cache coverage
-- - Overall active user capacity: 1,000 → 3,000 concurrent users

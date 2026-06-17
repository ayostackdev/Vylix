-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'ALUMNI';

-- DropForeignKey
ALTER TABLE "PointsTransaction" DROP CONSTRAINT "PointsTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionAnswer" DROP CONSTRAINT "QuestionAnswer_authorId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionAnswer" DROP CONSTRAINT "QuestionAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "TopicQuestion" DROP CONSTRAINT "TopicQuestion_authorId_fkey";

-- DropForeignKey
ALTER TABLE "TopicQuestion" DROP CONSTRAINT "TopicQuestion_topicId_fkey";

-- DropForeignKey
ALTER TABLE "UserRewardPurchase" DROP CONSTRAINT "UserRewardPurchase_rewardId_fkey";

-- DropForeignKey
ALTER TABLE "UserRewardPurchase" DROP CONSTRAINT "UserRewardPurchase_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserStreak" DROP CONSTRAINT "UserStreak_userId_fkey";

-- DropIndex
DROP INDEX "Material_topicId_uploadedAt_idx";

-- DropIndex
DROP INDEX "Message_conversationId_deletedAt_createdAt_idx";

-- DropIndex
DROP INDEX "Topic_courseId_isActive_lastActivity_idx";

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "examYear" INTEGER,
ADD COLUMN     "isPastQuestion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "semester" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailPromptDismissedAt" TIMESTAMP(3),
ADD COLUMN     "graduatedAt" TIMESTAMP(3),
ADD COLUMN     "levelUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "schoolEmail" TEXT,
ADD COLUMN     "schoolEmailPromptDismissedAt" TIMESTAMP(3),
ADD COLUMN     "userStreakId" TEXT;

-- CreateIndex
CREATE INDEX "Material_topicId_uploadedAt_idx" ON "Material"("topicId", "uploadedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_deletedAt_createdAt_idx" ON "Message"("conversationId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Topic_courseId_isActive_lastActivity_idx" ON "Topic"("courseId", "isActive", "lastActivity");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_userStreakId_fkey" FOREIGN KEY ("userStreakId") REFERENCES "UserStreak"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRewardPurchase" ADD CONSTRAINT "UserRewardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicQuestion" ADD CONSTRAINT "TopicQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicQuestion" ADD CONSTRAINT "TopicQuestion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TopicQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAnswer" ADD CONSTRAINT "QuestionAnswer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

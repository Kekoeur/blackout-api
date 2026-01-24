-- AlterTable
ALTER TABLE "PhotoSubmission" ADD COLUMN     "moderatorComment" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "nsfwFlagCount" INTEGER NOT NULL DEFAULT 0;

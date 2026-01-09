-- AlterEnum
ALTER TYPE "BarRole" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "Bar" ALTER COLUMN "active" SET DEFAULT false;

-- AlterTable
ALTER TABLE "Drink" ADD COLUMN     "barId" TEXT,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "bar_users" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Drink" ADD CONSTRAINT "Drink_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "bar_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drink" ADD CONSTRAINT "Drink_barId_fkey" FOREIGN KEY ("barId") REFERENCES "Bar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

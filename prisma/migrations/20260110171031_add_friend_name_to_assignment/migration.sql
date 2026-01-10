/*
  Warnings:

  - You are about to alter the column `latitude` on the `Bar` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,7)`.
  - You are about to alter the column `longitude` on the `Bar` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Decimal(10,7)`.

*/
-- AlterTable
ALTER TABLE "Bar" ALTER COLUMN "latitude" SET DATA TYPE DECIMAL(10,7),
ALTER COLUMN "longitude" SET DATA TYPE DECIMAL(10,7);

-- AlterTable
ALTER TABLE "OrderItemAssignment" ADD COLUMN     "friendName" TEXT;

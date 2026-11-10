-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "CorporateStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "BookingRequest" ADD COLUMN     "billAmount" INTEGER,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "commissionAmount" INTEGER,
ADD COLUMN     "commissionBps" INTEGER,
ADD COLUMN     "commissionPaidAt" TIMESTAMP(3),
ADD COLUMN     "commissionStatus" "CommissionStatus",
ADD COLUMN     "partnerDiscountPct" INTEGER,
ADD COLUMN     "testedOn" DATE;

-- AlterTable
ALTER TABLE "Lab" ADD COLUMN     "commissionBps" INTEGER,
ADD COLUMN     "isPartner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partnerDiscountPct" INTEGER;

-- CreateTable
CREATE TABLE "CorporateRequest" (
    "id" SERIAL NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "employees" INTEGER NOT NULL,
    "area" TEXT,
    "needs" TEXT NOT NULL,
    "status" "CorporateStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "landingPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorporateRequest_status_createdAt_idx" ON "CorporateRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_code_key" ON "BookingRequest"("code");

-- CreateIndex
CREATE INDEX "BookingRequest_labId_testedOn_idx" ON "BookingRequest"("labId", "testedOn");


-- Backfill: every existing booking gets a code so the inbox and statements can show one.
UPDATE "BookingRequest" SET "code" = 'TM-' || "id" WHERE "code" IS NULL;

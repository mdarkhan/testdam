-- AlterTable
ALTER TABLE "Lab" ADD COLUMN     "importBatch" TEXT;

-- AlterTable
ALTER TABLE "LabTestPrice" ADD COLUMN     "importBatch" TEXT;

-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN     "importBatch" TEXT;

-- CreateIndex
CREATE INDEX "LabTestPrice_importBatch_idx" ON "LabTestPrice"("importBatch");

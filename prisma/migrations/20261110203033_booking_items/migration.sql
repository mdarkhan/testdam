-- CreateTable
CREATE TABLE "BookingItem" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "testId" INTEGER NOT NULL,
    "priceAtRequest" INTEGER NOT NULL,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingItem_bookingId_idx" ON "BookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "BookingItem_testId_idx" ON "BookingItem"("testId");

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "BookingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

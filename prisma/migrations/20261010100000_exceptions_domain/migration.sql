-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'EXCEPTION';

-- CreateEnum
CREATE TYPE "DeliveryExceptionStatus" AS ENUM (
  'OPEN',
  'DRIVER_CONTACTED',
  'PHARMACY_RETRIEVAL_REQUIRED',
  'CUSTOMER_CONTACT_REQUIRED',
  'ADMIN_REVIEW',
  'RESOLVED'
);

-- CreateEnum
CREATE TYPE "CustodianType" AS ENUM (
  'DRIVER',
  'PHARMACY',
  'OTHER'
);

-- CreateTable
CREATE TABLE "DeliveryException" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "DeliveryExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "currentCustodian" "CustodianType" NOT NULL DEFAULT 'DRIVER',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "resolution" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryException_deliveryId_key" ON "DeliveryException"("deliveryId");

-- CreateIndex
CREATE INDEX "DeliveryException_status_idx" ON "DeliveryException"("status");

-- CreateIndex
CREATE INDEX "DeliveryException_driverId_idx" ON "DeliveryException"("driverId");

-- AddForeignKey
ALTER TABLE "DeliveryException" ADD CONSTRAINT "DeliveryException_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryException" ADD CONSTRAINT "DeliveryException_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryException" ADD CONSTRAINT "DeliveryException_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

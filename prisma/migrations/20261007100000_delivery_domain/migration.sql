-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM (
  'NOT_STARTED',
  'SEARCHING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'GOING_TO_PHARMACY',
  'ARRIVED_AT_PHARMACY',
  'HANDOVER_PENDING',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVING_SOON',
  'OTP_PENDING',
  'DELIVERED',
  'CASH_PENDING',
  'COMPLETED',
  'EXCEPTION'
);

-- CreateEnum
CREATE TYPE "DeliveryOfferStatus" AS ENUM (
  'OFFERED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "pickupAddress" TEXT NOT NULL,
    "pickupLatitude" DECIMAL(10,7) NOT NULL,
    "pickupLongitude" DECIMAL(10,7) NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLatitude" DECIMAL(10,7) NOT NULL,
    "dropoffLongitude" DECIMAL(10,7) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryOffer" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "DeliveryOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOffer_pkey" PRIMARY KEY ("id")
);

-- Active Delivery Partial Unique Index (SRS Section 32)
CREATE UNIQUE INDEX "one_active_delivery_per_driver"
ON "Delivery" ("driverId")
WHERE "status" IN (
  'DRIVER_ASSIGNED',
  'GOING_TO_PHARMACY',
  'ARRIVED_AT_PHARMACY',
  'HANDOVER_PENDING',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVING_SOON',
  'OTP_PENDING',
  'DELIVERED',
  'CASH_PENDING',
  'EXCEPTION'
);

-- Indexes
CREATE INDEX "Delivery_orderId_idx" ON "Delivery"("orderId");
CREATE INDEX "Delivery_driverId_status_idx" ON "Delivery"("driverId", "status");
CREATE INDEX "Delivery_status_createdAt_idx" ON "Delivery"("status", "createdAt");

CREATE INDEX "DeliveryOffer_deliveryId_status_idx" ON "DeliveryOffer"("deliveryId", "status");
CREATE INDEX "DeliveryOffer_driverId_status_idx" ON "DeliveryOffer"("driverId", "status");

-- Foreign Keys
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryOffer" ADD CONSTRAINT "DeliveryOffer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

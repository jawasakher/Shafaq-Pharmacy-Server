-- CreateEnum
CREATE TYPE "DeliveryOtpStatus" AS ENUM (
  'ACTIVE',
  'CONSUMED',
  'EXPIRED',
  'REVOKED',
  'LOCKED'
);

-- CreateEnum
CREATE TYPE "CashCollectionStatus" AS ENUM (
  'NOT_DUE',
  'DUE',
  'RECEIVED',
  'UNPAID',
  'PARTIALLY_PAID',
  'DISPUTED'
);

-- CreateTable
CREATE TABLE "DeliveryOtp" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "status" "DeliveryOtpStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashCollection" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "receivedAmount" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SYP',
    "status" "CashCollectionStatus" NOT NULL DEFAULT 'NOT_DUE',
    "verifiedByUserId" TEXT,
    "verificationMethod" TEXT,
    "receivedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryOtp_deliveryId_status_idx" ON "DeliveryOtp"("deliveryId", "status");

-- CreateIndex
CREATE INDEX "DeliveryOtp_expiresAt_idx" ON "DeliveryOtp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashCollection_deliveryId_key" ON "CashCollection"("deliveryId");

-- CreateIndex
CREATE INDEX "CashCollection_deliveryId_status_idx" ON "CashCollection"("deliveryId", "status");

-- CreateIndex
CREATE INDEX "CashCollection_status_createdAt_idx" ON "CashCollection"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryOtp" ADD CONSTRAINT "DeliveryOtp_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashCollection" ADD CONSTRAINT "CashCollection_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

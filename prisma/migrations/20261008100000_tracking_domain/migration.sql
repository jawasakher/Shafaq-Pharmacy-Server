-- CreateTable
CREATE TABLE "DriverCurrentLocation" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(5,2),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverCurrentLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverLocationHistory" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "heading" DECIMAL(5,2),
    "speed" DECIMAL(5,2),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverLocationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverCurrentLocation_driverId_key" ON "DriverCurrentLocation"("driverId");

-- CreateIndex
CREATE INDEX "DriverCurrentLocation_deliveryId_idx" ON "DriverCurrentLocation"("deliveryId");

-- CreateIndex
CREATE INDEX "DriverCurrentLocation_recordedAt_idx" ON "DriverCurrentLocation"("recordedAt");

-- CreateIndex
CREATE INDEX "DriverLocationHistory_driverId_recordedAt_idx" ON "DriverLocationHistory"("driverId", "recordedAt");

-- CreateIndex
CREATE INDEX "DriverLocationHistory_deliveryId_recordedAt_idx" ON "DriverLocationHistory"("deliveryId", "recordedAt");

-- AddForeignKey
ALTER TABLE "DriverCurrentLocation" ADD CONSTRAINT "DriverCurrentLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCurrentLocation" ADD CONSTRAINT "DriverCurrentLocation_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocationHistory" ADD CONSTRAINT "DriverLocationHistory_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocationHistory" ADD CONSTRAINT "DriverLocationHistory_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

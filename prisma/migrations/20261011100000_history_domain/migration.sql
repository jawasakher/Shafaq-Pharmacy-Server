-- CreateTable
CREATE TABLE "OrderStateHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" "OrderStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryStateHistory" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" "DeliveryStatus" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStateHistory_orderId_timestamp_idx" ON "OrderStateHistory"("orderId", "timestamp");

-- CreateIndex
CREATE INDEX "OrderStateHistory_timestamp_idx" ON "OrderStateHistory"("timestamp");

-- CreateIndex
CREATE INDEX "DeliveryStateHistory_deliveryId_timestamp_idx" ON "DeliveryStateHistory"("deliveryId", "timestamp");

-- CreateIndex
CREATE INDEX "DeliveryStateHistory_timestamp_idx" ON "DeliveryStateHistory"("timestamp");

-- AddForeignKey
ALTER TABLE "OrderStateHistory" ADD CONSTRAINT "OrderStateHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryStateHistory" ADD CONSTRAINT "DeliveryStateHistory_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

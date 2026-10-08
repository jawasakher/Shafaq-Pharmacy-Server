-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM (
  'REQUESTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED'
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "pharmacistId" TEXT,
    "pharmacyId" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'REQUESTED',
    "symptoms" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "currentMedications" TEXT,
    "allergies" TEXT,
    "additionalDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationAssignmentHistory" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "pharmacistId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- One active consultation per customer partial unique index (SRS Section 45)
CREATE UNIQUE INDEX "one_active_consultation_per_customer"
ON "Consultation" ("customerId")
WHERE "status" IN (
  'REQUESTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER'
);

-- CreateIndex
CREATE INDEX "Consultation_customerId_status_idx" ON "Consultation"("customerId", "status");

-- CreateIndex
CREATE INDEX "Consultation_pharmacistId_status_idx" ON "Consultation"("pharmacistId", "status");

-- CreateIndex
CREATE INDEX "Consultation_pharmacyId_status_idx" ON "Consultation"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "Consultation_status_createdAt_idx" ON "Consultation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationAssignmentHistory_consultationId_idx" ON "ConsultationAssignmentHistory"("consultationId");

-- CreateIndex
CREATE INDEX "ConsultationAssignmentHistory_pharmacistId_idx" ON "ConsultationAssignmentHistory"("pharmacistId");

-- CreateIndex
CREATE INDEX "ChatMessage_consultationId_createdAt_idx" ON "ChatMessage"("consultationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationAssignmentHistory" ADD CONSTRAINT "ConsultationAssignmentHistory_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationAssignmentHistory" ADD CONSTRAINT "ConsultationAssignmentHistory_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

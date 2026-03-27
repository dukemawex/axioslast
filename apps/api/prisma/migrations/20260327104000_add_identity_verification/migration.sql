-- CreateEnum
CREATE TYPE "IdVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "idVerificationFailureReason" TEXT,
ADD COLUMN "idVerificationProvider" TEXT,
ADD COLUMN "idVerificationRef" TEXT,
ADD COLUMN "idVerificationStatus" "IdVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN "idVerifiedAt" TIMESTAMP(3),
ADD COLUMN "nationalIdNumber" TEXT,
ADD COLUMN "ninNumber" TEXT;

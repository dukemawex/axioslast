-- CreateEnum
CREATE TYPE "KYCTier" AS ENUM ('NONE', 'BASIC', 'STANDARD', 'PREMIUM');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "kycTier" "KYCTier" NOT NULL DEFAULT 'NONE',
ADD COLUMN "kycVerifiedAt" TIMESTAMP(3),
ADD COLUMN "kycRejectionReason" TEXT,
ADD COLUMN "bvnHash" TEXT,
ADD COLUMN "ninHash" TEXT,
ADD COLUMN "nationalIdHash" TEXT,
ADD COLUMN "idType" TEXT,
ADD COLUMN "idCountry" TEXT,
ADD COLUMN "monthlySwapLimit" DECIMAL(18, 2) NOT NULL DEFAULT 200000,
ADD COLUMN "monthlySwapUsed" DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "User_bvnHash_key" ON "User"("bvnHash");

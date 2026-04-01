-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "phantombusterApiKey" TEXT,
ADD COLUMN     "phantombusterConnectAgentId" TEXT,
ADD COLUMN     "phantombusterMessageAgentId" TEXT;

-- AlterTable
ALTER TABLE "OutreachActivity" ADD COLUMN     "gmailMessageId" TEXT,
ADD COLUMN     "gmailThreadId" TEXT,
ADD COLUMN     "linkedinNote" TEXT;

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dailySentCount" INTEGER NOT NULL DEFAULT 0,
    "dailyResetAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_organizationId_email_key" ON "GmailAccount"("organizationId", "email");

-- CreateIndex
CREATE INDEX "OutreachActivity_gmailThreadId_idx" ON "OutreachActivity"("gmailThreadId");

-- AddForeignKey
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CCO', 'SDR_MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CompanySource" AS ENUM ('APOLLO', 'HUBSPOT', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('DISCOVERED', 'RESEARCHING', 'RESEARCHED', 'SCORING', 'QUALIFIED', 'DISQUALIFIED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_SEQUENCE', 'REPLIED', 'INTERESTED', 'NOT_INTERESTED', 'MEETING_BOOKED', 'PUSHED_TO_CRM');

-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SequenceChannel" AS ENUM ('EMAIL', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_REPLIED', 'EMAIL_BOUNCED', 'EMAIL_UNSUBSCRIBED', 'LINKEDIN_CONNECT_SENT', 'LINKEDIN_CONNECT_ACCEPTED', 'LINKEDIN_MESSAGE_SENT', 'LINKEDIN_MESSAGE_REPLIED');

-- CreateEnum
CREATE TYPE "ReplyClassification" AS ENUM ('INTERESTED', 'NOT_NOW', 'NOT_INTERESTED', 'OUT_OF_OFFICE', 'BOUNCE', 'UNSUBSCRIBE', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalItemType" AS ENUM ('LEAD_QUALIFICATION', 'OUTREACH_MESSAGE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "ExclusionType" AS ENUM ('DOMAIN', 'EMAIL', 'COMPANY_NAME', 'HUBSPOT_CLIENT', 'HUBSPOT_CONTACT');

-- CreateEnum
CREATE TYPE "KnowledgeItemType" AS ENUM ('CASE_STUDY', 'SERVICE', 'VERTICAL', 'TESTIMONIAL');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('PUSH', 'PULL');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "apolloApiKey" TEXT,
    "hubspotAccessToken" TEXT,
    "icommApiKey" TEXT,
    "icommSmtpHost" TEXT,
    "icommSmtpPort" TEXT,
    "icommSmtpUser" TEXT,
    "icommSmtpPass" TEXT,
    "anthropicApiKey" TEXT,
    "emailDomain" TEXT,
    "requireLeadApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireMessageApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "hashedPassword" TEXT,
    "emailVerified" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "IcpConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "countries" TEXT[],
    "employeeRanges" TEXT[],
    "jobTitles" TEXT[],
    "industries" TEXT[],
    "keywords" TEXT[],
    "excludeKeywords" TEXT[],
    "scoringCriteria" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcpConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apolloId" TEXT,
    "hubspotId" TEXT,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "employeeCount" INTEGER,
    "annualRevenue" TEXT,
    "country" TEXT,
    "city" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "description" TEXT,
    "technologies" TEXT[],
    "aiBrief" TEXT,
    "aiPainPoints" TEXT[],
    "aiServiceMatch" TEXT[],
    "aiResearchedAt" TIMESTAMP(3),
    "source" "CompanySource" NOT NULL DEFAULT 'APOLLO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apolloId" TEXT,
    "hubspotContactId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "jobTitle" TEXT,
    "seniority" TEXT,
    "department" TEXT,
    "companyId" TEXT NOT NULL,
    "aiRelevanceScore" DOUBLE PRECISION,
    "aiScoreReasoning" TEXT,
    "aiPersonalization" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'DISCOVERED',
    "discoveryRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "icpConfigId" TEXT NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'PENDING',
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "totalNew" INTEGER NOT NULL DEFAULT 0,
    "totalExcluded" INTEGER NOT NULL DEFAULT 0,
    "apolloCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channel" "SequenceChannel" NOT NULL DEFAULT 'EMAIL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "serviceContext" TEXT,
    "toneGuide" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "subjectTemplate" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "stepType" TEXT NOT NULL DEFAULT 'email',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "type" "ActivityType" NOT NULL,
    "channel" "SequenceChannel" NOT NULL DEFAULT 'EMAIL',
    "emailMessageId" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "fromEmail" TEXT,
    "toEmail" TEXT,
    "replyBody" TEXT,
    "replyClassification" "ReplyClassification",
    "replyClassifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalItem" (
    "id" TEXT NOT NULL,
    "type" "ApprovalItemType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT NOT NULL,
    "proposedSubject" TEXT,
    "proposedBody" TEXT,
    "sequenceStepId" TEXT,
    "aiBrief" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "resolvedAt" TIMESTAMP(3),
    "note" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "approvalItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ApprovalStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exclusion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ExclusionType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "hubspotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "KnowledgeItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "industry" TEXT,
    "service" TEXT,
    "metrics" TEXT,
    "country" TEXT,
    "url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HubspotSyncLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "direction" "SyncDirection" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "details" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HubspotSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Company_apolloId_key" ON "Company"("apolloId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_hubspotId_key" ON "Company"("hubspotId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_domain_key" ON "Company"("organizationId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_apolloId_key" ON "Lead"("apolloId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_email_key" ON "Lead"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceStep_sequenceId_order_key" ON "SequenceStep"("sequenceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceEnrollment_leadId_sequenceId_key" ON "SequenceEnrollment"("leadId", "sequenceId");

-- CreateIndex
CREATE INDEX "Exclusion_organizationId_value_idx" ON "Exclusion"("organizationId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Exclusion_organizationId_type_value_key" ON "Exclusion"("organizationId", "type", "value");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IcpConfig" ADD CONSTRAINT "IcpConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "DiscoveryRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryRun" ADD CONSTRAINT "DiscoveryRun_icpConfigId_fkey" FOREIGN KEY ("icpConfigId") REFERENCES "IcpConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceStep" ADD CONSTRAINT "SequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachActivity" ADD CONSTRAINT "OutreachActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachActivity" ADD CONSTRAINT "OutreachActivity_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "SequenceEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalItem" ADD CONSTRAINT "ApprovalItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_approvalItemId_fkey" FOREIGN KEY ("approvalItemId") REFERENCES "ApprovalItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exclusion" ADD CONSTRAINT "Exclusion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HubspotSyncLog" ADD CONSTRAINT "HubspotSyncLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { generateEmail } from "../services/ai/copywriter";

type CopywriterJobData = {
  enrollmentId: string;
  stepOrder: number;
  organizationId: string;
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processCopywriterJob(job: Job<CopywriterJobData>) {
  const prisma = createPrisma();
  const { enrollmentId, stepOrder, organizationId } = job.data;

  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      lead: { include: { company: true } },
      sequence: { include: { steps: { orderBy: { order: "asc" } } } },
    },
  });

  if (!enrollment || !enrollment.isActive) {
    job.log("Enrollment not found or inactive, skipping");
    return;
  }

  const step = enrollment.sequence.steps.find((s) => s.order === stepOrder);
  if (!step) throw new Error(`Step ${stepOrder} not found in sequence`);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      anthropicApiKey: true,
      requireMessageApproval: true,
      emailDomain: true,
    },
  });

  const apiKey = org?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  // Load relevant case studies from knowledge base
  const lead = enrollment.lead;
  const company = lead.company;

  const caseStudyFilters = [];
  if (company.industry) {
    caseStudyFilters.push({ industry: { contains: company.industry, mode: "insensitive" as const } });
  }
  if (company.aiServiceMatch.length > 0) {
    caseStudyFilters.push({ service: { in: company.aiServiceMatch } });
  }

  const caseStudies = await prisma.knowledgeItem.findMany({
    where: {
      organizationId,
      type: "CASE_STUDY",
      ...(caseStudyFilters.length > 0 ? { OR: caseStudyFilters } : {}),
    },
    take: 3,
  });

  // Get previously sent email subjects for context
  const previousActivities = await prisma.outreachActivity.findMany({
    where: { enrollmentId, type: "EMAIL_SENT" },
    orderBy: { createdAt: "asc" },
    select: { subject: true },
  });

  job.log(`Generating email step ${stepOrder} for ${lead.firstName} ${lead.lastName}`);

  const email = await generateEmail(
    {
      leadFirstName: lead.firstName,
      leadLastName: lead.lastName,
      leadTitle: lead.jobTitle,
      leadCountry: company.country,
      companyName: company.name,
      companyIndustry: company.industry,
      companyBrief: company.aiBrief,
      companyPainPoints: company.aiPainPoints,
      companyServiceMatches: company.aiServiceMatch,
      personalHooks: lead.aiPersonalization,
      sequenceName: enrollment.sequence.name,
      serviceContext: enrollment.sequence.serviceContext,
      toneGuide: enrollment.sequence.toneGuide,
      stepNumber: stepOrder,
      stepType: step.stepType,
      stepTemplate: step.bodyTemplate,
      subjectTemplate: step.subjectTemplate,
      previousStepsSent: previousActivities.map((a) => a.subject || ""),
      relevantCaseStudies: caseStudies.map((cs) => ({
        title: cs.title,
        description: cs.description,
        metrics: cs.metrics,
        service: cs.service,
      })),
    },
    apiKey
  );

  // If message approval required, create approval item
  if (org?.requireMessageApproval) {
    await prisma.approvalItem.create({
      data: {
        type: "OUTREACH_MESSAGE",
        status: "PENDING",
        leadId: lead.id,
        proposedSubject: email.subject,
        proposedBody: email.body,
        sequenceStepId: step.id,
        aiBrief: `${step.stepType === "email" ? "Email" : "LinkedIn"} paso ${stepOrder} para ${lead.firstName} ${lead.lastName} @ ${company.name}`,
        aiConfidence: lead.aiRelevanceScore,
      },
    });
    job.log("Message approval item created, waiting for CCO review");
  } else {
    // Auto-send: enqueue outreach
    const { outreachQueue } = await import("../lib/queue");
    await outreachQueue.add("outreach", {
      enrollmentId,
      leadId: lead.id,
      organizationId,
      subject: email.subject,
      body: email.body,
      stepOrder,
      stepType: step.stepType,
    });
    job.log(`${step.stepType} generated, queued for sending`);
  }

  return email;
}

export function createCopywriterWorker() {
  const worker = new Worker<CopywriterJobData>(
    "copywriter",
    processCopywriterJob,
    {
      connection: redis,
      concurrency: 3,
      limiter: { max: 5, duration: 60_000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[copywriter] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[copywriter] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

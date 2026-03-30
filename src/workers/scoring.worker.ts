import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { scoreLead } from "../services/ai/scorer";
import { approvalPrepQueue } from "../lib/queue";

type ScoringJobData = {
  leadId: string;
  organizationId: string;
};

const QUALIFICATION_THRESHOLD = 60;

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processScoringJob(job: Job<ScoringJobData>) {
  const prisma = createPrisma();

  const { leadId, organizationId } = job.data;

  // Load lead with company and discovery run (for ICP)
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      company: true,
      discoveryRun: {
        include: { icpConfig: true },
      },
    },
  });

  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Update status
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "SCORING" },
  });

  // Get org API key
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { anthropicApiKey: true },
  });

  const apiKey = org?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  // Get ICP config (from discovery run or first active)
  const icp = lead.discoveryRun?.icpConfig ||
    (await prisma.icpConfig.findFirst({
      where: { organizationId, isActive: true },
    }));

  if (!icp) throw new Error("No ICP config found for scoring");

  try {
    job.log(`Scoring ${lead.firstName} ${lead.lastName} @ ${lead.company.name}`);

    const scoring = await scoreLead(
      {
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadTitle: lead.jobTitle,
        leadSeniority: lead.seniority,
        companyName: lead.company.name,
        companyIndustry: lead.company.industry,
        companyCountry: lead.company.country,
        companyEmployeeCount: lead.company.employeeCount,
        companyBrief: lead.company.aiBrief,
        companyPainPoints: lead.company.aiPainPoints,
        companyServiceMatches: lead.company.aiServiceMatch,
        icpJobTitles: icp.jobTitles,
        icpCountries: icp.countries,
        icpEmployeeRanges: icp.employeeRanges,
        icpIndustries: icp.industries,
        icpKeywords: icp.keywords,
      },
      apiKey
    );

    // Determine status based on score
    const newStatus =
      scoring.score >= QUALIFICATION_THRESHOLD ? "QUALIFIED" : "DISQUALIFIED";

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiRelevanceScore: scoring.score,
        aiScoreReasoning: scoring.reasoning,
        status: newStatus,
      },
    });

    job.log(`Score: ${scoring.score} → ${newStatus}`);

    // Enqueue approval prep for qualified leads
    if (newStatus === "QUALIFIED") {
      await approvalPrepQueue.add("approval-prep", { leadId, organizationId });
    }

    return scoring;
  } catch (error) {
    await prisma.lead
      .update({
        where: { id: leadId },
        data: { status: "RESEARCHED" },
      })
      .catch(() => {});

    throw error;
  }
}

export function createScoringWorker() {
  const worker = new Worker<ScoringJobData>(
    "scoring",
    processScoringJob,
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 60_000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[scoring] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[scoring] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

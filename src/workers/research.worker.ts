import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { researchCompany } from "../services/ai/researcher";
import { scoringQueue } from "../lib/queue";

type ResearchJobData = {
  leadId: string;
  organizationId: string;
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processResearchJob(job: Job<ResearchJobData>) {
  const prisma = createPrisma();

  const { leadId, organizationId } = job.data;

  // Load lead with company
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    include: { company: true },
  });

  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Update status
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "RESEARCHING" },
  });

  // Get org API key
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { anthropicApiKey: true },
  });

  const apiKey = org?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  try {
    // Run AI research
    job.log(`Researching ${lead.company.name} (${lead.company.domain})`);

    const research = await researchCompany(
      {
        companyName: lead.company.name,
        companyDomain: lead.company.domain,
        companyDescription: lead.company.description,
        companyIndustry: lead.company.industry,
        companyCountry: lead.company.country,
        companyTechnologies: lead.company.technologies,
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadTitle: lead.jobTitle,
      },
      apiKey
    );

    // Update company with research results
    await prisma.company.update({
      where: { id: lead.company.id },
      data: {
        aiBrief: research.brief,
        aiPainPoints: research.painPoints,
        aiServiceMatch: research.serviceMatches,
        aiResearchedAt: new Date(),
      },
    });

    // Update lead with personalization hooks
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "RESEARCHED",
        aiPersonalization: research.personalHooks.join("\n"),
      },
    });

    job.log(`Research complete: ${research.serviceMatches.length} service matches`);

    // Enqueue scoring
    await scoringQueue.add("scoring", {
      leadId,
      organizationId,
    });

    return research;
  } catch (error) {
    // Revert status on failure
    await prisma.lead
      .update({
        where: { id: leadId },
        data: { status: "DISCOVERED" },
      })
      .catch(() => {});

    throw error;
  }
}

export function createResearchWorker() {
  const worker = new Worker<ResearchJobData>(
    "research",
    processResearchJob,
    {
      connection: redis,
      concurrency: 3,
      limiter: {
        max: 5,
        duration: 60_000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[research] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[research] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

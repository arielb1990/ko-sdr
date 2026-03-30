import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type ApprovalPrepJobData = {
  leadId: string;
  organizationId: string;
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processApprovalPrepJob(job: Job<ApprovalPrepJobData>) {
  const prisma = createPrisma();

  const { leadId, organizationId } = job.data;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    include: { company: true },
  });

  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Check if org requires lead approval
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { requireLeadApproval: true, autoApproveThreshold: true },
  });

  if (!org?.requireLeadApproval) {
    // Skip approval — auto-approve all
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "APPROVED" },
    });
    job.log(`Auto-approved (approval disabled): ${lead.firstName} ${lead.lastName}`);
    return;
  }

  // Auto-approve if score meets threshold (autonomous mode)
  if (
    org.autoApproveThreshold &&
    lead.aiRelevanceScore != null &&
    lead.aiRelevanceScore >= org.autoApproveThreshold
  ) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: "APPROVED" },
    });
    job.log(`Auto-approved (score ${Math.round(lead.aiRelevanceScore)} >= threshold ${org.autoApproveThreshold}): ${lead.firstName} ${lead.lastName}`);
    return;
  }

  // Build approval brief from AI research
  const briefParts: string[] = [];
  briefParts.push(`**${lead.firstName} ${lead.lastName}** — ${lead.jobTitle || "Sin cargo"}`);
  briefParts.push(`**${lead.company.name}** (${lead.company.domain})`);

  if (lead.company.country) briefParts.push(`País: ${lead.company.country}`);
  if (lead.company.employeeCount) briefParts.push(`~${lead.company.employeeCount} empleados`);
  if (lead.company.industry) briefParts.push(`Industria: ${lead.company.industry}`);
  if (lead.aiRelevanceScore != null) briefParts.push(`Score: ${Math.round(lead.aiRelevanceScore)}/100`);
  if (lead.company.aiBrief) briefParts.push(`\n${lead.company.aiBrief}`);
  if (lead.company.aiServiceMatch.length > 0) {
    briefParts.push(`Servicios relevantes: ${lead.company.aiServiceMatch.join(", ")}`);
  }
  if (lead.aiScoreReasoning) briefParts.push(`\nRazón del score: ${lead.aiScoreReasoning}`);

  // Create approval item
  await prisma.approvalItem.create({
    data: {
      type: "LEAD_QUALIFICATION",
      status: "PENDING",
      leadId,
      aiBrief: briefParts.join("\n"),
      aiConfidence: lead.aiRelevanceScore,
    },
  });

  // Update lead status
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "PENDING_APPROVAL" },
  });

  job.log(`Approval item created for ${lead.firstName} ${lead.lastName}`);
}

export function createApprovalPrepWorker() {
  const worker = new Worker<ApprovalPrepJobData>(
    "approval-prep",
    processApprovalPrepJob,
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[approval-prep] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[approval-prep] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

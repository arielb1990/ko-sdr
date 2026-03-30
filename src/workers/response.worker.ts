import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { classifyReply } from "../services/ai/classifier";
import { hubspotSyncQueue } from "../lib/queue";

type ResponseJobData = {
  activityId: string;
  organizationId: string;
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processResponseJob(job: Job<ResponseJobData>) {
  const prisma = createPrisma();
  const { activityId, organizationId } = job.data;

  const activity = await prisma.outreachActivity.findUnique({
    where: { id: activityId },
    include: {
      lead: { include: { company: true } },
      enrollment: true,
    },
  });

  if (!activity || !activity.replyBody) {
    job.log("Activity not found or no reply body");
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { anthropicApiKey: true },
  });

  const apiKey = org?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  // Find the original sent email
  const originalEmail = await prisma.outreachActivity.findFirst({
    where: {
      leadId: activity.leadId,
      type: "EMAIL_SENT",
      enrollmentId: activity.enrollmentId,
    },
    orderBy: { createdAt: "desc" },
  });

  job.log(`Classifying reply from ${activity.lead.firstName} ${activity.lead.lastName}`);

  const classification = await classifyReply(
    {
      originalSubject: originalEmail?.subject || "",
      originalBody: originalEmail?.body || "",
      replyBody: activity.replyBody,
      leadName: `${activity.lead.firstName} ${activity.lead.lastName}`,
      companyName: activity.lead.company.name,
    },
    apiKey
  );

  // Update activity with classification
  await prisma.outreachActivity.update({
    where: { id: activityId },
    data: {
      replyClassification: classification.classification,
      replyClassifiedAt: new Date(),
    },
  });

  // Update lead status based on classification
  const statusMap: Record<string, string> = {
    INTERESTED: "INTERESTED",
    NOT_NOW: "REPLIED",
    NOT_INTERESTED: "NOT_INTERESTED",
    OUT_OF_OFFICE: "REPLIED",
    BOUNCE: "DISQUALIFIED",
    UNSUBSCRIBE: "NOT_INTERESTED",
    OTHER: "REPLIED",
  };

  const newStatus = statusMap[classification.classification] || "REPLIED";

  await prisma.lead.update({
    where: { id: activity.leadId },
    data: { status: newStatus as "INTERESTED" | "NOT_INTERESTED" | "REPLIED" | "DISQUALIFIED" },
  });

  // Pause sequence enrollment on any reply
  if (activity.enrollmentId) {
    await prisma.sequenceEnrollment.update({
      where: { id: activity.enrollmentId },
      data: { isActive: false, pausedAt: new Date() },
    });
    job.log("Sequence paused due to reply");
  }

  // If interested, trigger HubSpot sync
  if (classification.classification === "INTERESTED") {
    await hubspotSyncQueue.add("hubspot-sync", {
      type: "push-lead",
      leadId: activity.leadId,
      organizationId,
    });
    job.log("Lead interested → queued HubSpot push");
  }

  job.log(`Classified as ${classification.classification} (${Math.round(classification.confidence * 100)}% confidence)`);

  return classification;
}

export function createResponseWorker() {
  const worker = new Worker<ResponseJobData>(
    "response-classification",
    processResponseJob,
    {
      connection: redis,
      concurrency: 3,
      limiter: { max: 5, duration: 60_000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[response] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[response] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

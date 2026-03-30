import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { pullExclusions, pushLeadToHubspot } from "../services/hubspot";

type HubspotSyncJobData =
  | { type: "pull-exclusions"; organizationId: string }
  | { type: "push-lead"; leadId: string; organizationId: string };

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processHubspotSyncJob(job: Job<HubspotSyncJobData>) {
  const prisma = createPrisma();
  const { organizationId } = job.data;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { hubspotAccessToken: true },
  });

  if (!org?.hubspotAccessToken) {
    job.log("HubSpot access token not configured, skipping");
    return;
  }

  const startedAt = new Date();

  if (job.data.type === "pull-exclusions") {
    job.log("Pulling exclusions from HubSpot...");

    try {
      const exclusions = await pullExclusions(org.hubspotAccessToken);

      let processed = 0;
      for (const ex of exclusions) {
        await prisma.exclusion.upsert({
          where: {
            organizationId_type_value: {
              organizationId,
              type: ex.type,
              value: ex.value,
            },
          },
          create: {
            organizationId,
            type: ex.type,
            value: ex.value,
            reason: "Sincronizado desde HubSpot",
            source: "hubspot_sync",
            hubspotId: ex.hubspotId,
          },
          update: {
            hubspotId: ex.hubspotId,
          },
        });
        processed++;
      }

      await prisma.hubspotSyncLog.create({
        data: {
          organizationId,
          direction: "PULL",
          status: "SUCCESS",
          recordType: "exclusions",
          recordsProcessed: processed,
          startedAt,
          completedAt: new Date(),
        },
      });

      job.log(`Pulled ${processed} exclusions from HubSpot`);
      return { processed };
    } catch (error) {
      await prisma.hubspotSyncLog.create({
        data: {
          organizationId,
          direction: "PULL",
          status: "FAILED",
          recordType: "exclusions",
          error: error instanceof Error ? error.message : String(error),
          startedAt,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  if (job.data.type === "push-lead") {
    const { leadId } = job.data;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      include: { company: true },
    });

    if (!lead) throw new Error(`Lead ${leadId} not found`);

    job.log(`Pushing ${lead.firstName} ${lead.lastName} to HubSpot...`);

    try {
      const result = await pushLeadToHubspot(org.hubspotAccessToken, {
        email: lead.email,
        firstName: lead.firstName,
        lastName: lead.lastName,
        jobTitle: lead.jobTitle,
        companyName: lead.company.name,
        companyDomain: lead.company.domain,
        companyIndustry: lead.company.industry,
        companyCountry: lead.company.country,
        aiRelevanceScore: lead.aiRelevanceScore,
        status: lead.status,
      });

      // Update lead with HubSpot contact ID
      await prisma.lead.update({
        where: { id: leadId },
        data: { hubspotContactId: result.contactId },
      });

      // Update status if not already
      if (lead.status === "INTERESTED" || lead.status === "MEETING_BOOKED") {
        await prisma.lead.update({
          where: { id: leadId },
          data: { status: "PUSHED_TO_CRM" },
        });
      }

      await prisma.hubspotSyncLog.create({
        data: {
          organizationId,
          direction: "PUSH",
          status: "SUCCESS",
          recordType: "lead",
          recordsProcessed: 1,
          details: { contactId: result.contactId, dealId: result.dealId },
          startedAt,
          completedAt: new Date(),
        },
      });

      job.log(`Pushed to HubSpot: contact ${result.contactId}${result.dealId ? `, deal ${result.dealId}` : ""}`);
      return result;
    } catch (error) {
      await prisma.hubspotSyncLog.create({
        data: {
          organizationId,
          direction: "PUSH",
          status: "FAILED",
          recordType: "lead",
          recordsFailed: 1,
          error: error instanceof Error ? error.message : String(error),
          startedAt,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}

export function createHubspotSyncWorker() {
  const worker = new Worker<HubspotSyncJobData>(
    "hubspot-sync",
    processHubspotSyncJob,
    {
      connection: redis,
      concurrency: 1,
      limiter: { max: 10, duration: 60_000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[hubspot-sync] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[hubspot-sync] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

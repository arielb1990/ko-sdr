import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { checkReplies, refreshTokenIfNeeded } from "../services/gmail";
import { responseClassificationQueue } from "../lib/queue";

type GmailPollerJobData = {
  organizationId?: string; // If null, poll all orgs
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processGmailPollerJob(job: Job<GmailPollerJobData>) {
  const prisma = createPrisma();

  const where = job.data.organizationId
    ? { organizationId: job.data.organizationId, isActive: true }
    : { isActive: true };

  const accounts = await prisma.gmailAccount.findMany({ where });

  if (accounts.length === 0) {
    job.log("No active Gmail accounts to poll");
    return;
  }

  let totalReplies = 0;

  for (const account of accounts) {
    try {
      // Refresh token if needed
      const refreshed = await refreshTokenIfNeeded(account);
      if (refreshed) {
        await prisma.gmailAccount.update({
          where: { id: account.id },
          data: { accessToken: refreshed.accessToken, tokenExpiresAt: refreshed.expiresAt },
        });
        account.accessToken = refreshed.accessToken;
        account.tokenExpiresAt = refreshed.expiresAt;
      }

      const since = account.lastPolledAt || new Date(Date.now() - 5 * 60 * 1000);

      const replies = await checkReplies(account, since);

      for (const reply of replies) {
        // Check if this threadId matches an email we sent
        const sentActivity = await prisma.outreachActivity.findFirst({
          where: {
            gmailThreadId: reply.gmailThreadId,
            type: "EMAIL_SENT",
          },
          include: { lead: true },
        });

        if (!sentActivity) continue;

        // Check we haven't already processed this reply
        const existing = await prisma.outreachActivity.findFirst({
          where: { gmailMessageId: reply.gmailMessageId },
        });
        if (existing) continue;

        // Create reply activity
        const replyActivity = await prisma.outreachActivity.create({
          data: {
            leadId: sentActivity.leadId,
            enrollmentId: sentActivity.enrollmentId,
            type: "EMAIL_REPLIED",
            channel: "EMAIL",
            gmailThreadId: reply.gmailThreadId,
            gmailMessageId: reply.gmailMessageId,
            fromEmail: reply.from,
            toEmail: account.email,
            replyBody: reply.body,
          },
        });

        // Update lead status
        await prisma.lead.updateMany({
          where: { id: sentActivity.leadId, status: { in: ["IN_SEQUENCE", "APPROVED"] } },
          data: { status: "REPLIED" },
        });

        // Pause sequence
        if (sentActivity.enrollmentId) {
          await prisma.sequenceEnrollment.update({
            where: { id: sentActivity.enrollmentId },
            data: { isActive: false, pausedAt: new Date() },
          });
        }

        // Enqueue classification
        await responseClassificationQueue.add("response-classification", {
          activityId: replyActivity.id,
          organizationId: account.organizationId,
        });

        totalReplies++;
        job.log(`Reply detected from ${reply.from} in thread ${reply.gmailThreadId}`);
      }

      // Update last polled timestamp
      await prisma.gmailAccount.update({
        where: { id: account.id },
        data: { lastPolledAt: new Date() },
      });
    } catch (err) {
      job.log(`Error polling ${account.email}: ${err}`);
    }
  }

  job.log(`Poll complete: ${totalReplies} new replies found`);
  return { totalReplies };
}

export function createGmailPollerWorker() {
  const worker = new Worker<GmailPollerJobData>(
    "gmail-poller",
    processGmailPollerJob,
    { connection: redis, concurrency: 1 }
  );

  worker.on("completed", (job) => console.log(`[gmail-poller] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[gmail-poller] Job ${job?.id} failed:`, err.message));

  return worker;
}

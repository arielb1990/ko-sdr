import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { sendEmail, refreshTokenIfNeeded } from "../services/gmail";
import { sendConnectionRequest, sendLinkedInMessage } from "../services/phantombuster";

type OutreachJobData = {
  enrollmentId: string;
  leadId: string;
  organizationId: string;
  subject?: string;
  body: string;
  stepOrder: number;
  stepType: string; // "email" | "linkedin_connect" | "linkedin_message"
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processOutreachJob(job: Job<OutreachJobData>) {
  const prisma = createPrisma();
  const { enrollmentId, leadId, organizationId, subject, body, stepOrder, stepType } = job.data;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, firstName: true, lastName: true, linkedinUrl: true },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      phantombusterApiKey: true,
      phantombusterConnectAgentId: true,
      phantombusterMessageAgentId: true,
    },
  });
  if (!org) throw new Error("Organization not found");

  // Route by step type
  if (stepType === "linkedin_connect" || stepType === "linkedin_message") {
    await handleLinkedIn(prisma, job, lead, org, {
      enrollmentId, leadId, body, stepOrder, stepType,
    });
  } else {
    await handleEmail(prisma, job, lead, organizationId, {
      enrollmentId, leadId, subject: subject || "", body, stepOrder,
    });
  }

  // Update enrollment step
  await prisma.sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: { currentStep: stepOrder },
  });

  // Update lead status
  await prisma.lead.updateMany({
    where: { id: leadId, status: { in: ["APPROVED", "IN_SEQUENCE"] } },
    data: { status: "IN_SEQUENCE" },
  });

  // Schedule next step
  await scheduleNextStep(prisma, enrollmentId, stepOrder, organizationId);
}

async function handleEmail(
  prisma: PrismaClient,
  job: Job,
  lead: { email: string; firstName: string; lastName: string },
  organizationId: string,
  data: { enrollmentId: string; leadId: string; subject: string; body: string; stepOrder: number }
) {
  // Pick Gmail account with lowest daily count
  const accounts = await prisma.gmailAccount.findMany({
    where: { organizationId, isActive: true },
    orderBy: { dailySentCount: "asc" },
  });

  if (accounts.length === 0) throw new Error("No Gmail accounts configured. Go to Settings to connect one.");

  // Reset daily count if needed
  const now = new Date();
  let account = accounts[0];
  if (!account.dailyResetAt || account.dailyResetAt < new Date(now.toDateString())) {
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: { dailySentCount: 0, dailyResetAt: now },
    });
    account = { ...account, dailySentCount: 0 };
  }

  // Check daily limit (50 per account)
  if (account.dailySentCount >= 50) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const delay = tomorrow.getTime() - Date.now();
    const { outreachQueue } = await import("../lib/queue");
    await outreachQueue.add("outreach", job.data, { delay });
    job.log(`Daily limit reached for ${account.email}. Rescheduled.`);
    return;
  }

  // Refresh token if needed
  const refreshed = await refreshTokenIfNeeded(account);
  if (refreshed) {
    await prisma.gmailAccount.update({
      where: { id: account.id },
      data: { accessToken: refreshed.accessToken, tokenExpiresAt: refreshed.expiresAt },
    });
    account = { ...account, accessToken: refreshed.accessToken, tokenExpiresAt: refreshed.expiresAt };
  }

  // Check if there's a previous thread for this enrollment (for follow-ups)
  const previousActivity = await prisma.outreachActivity.findFirst({
    where: { enrollmentId: data.enrollmentId, type: "EMAIL_SENT", gmailThreadId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { gmailThreadId: true },
  });

  job.log(`Sending email to ${lead.email} from ${account.email}`);

  const result = await sendEmail(
    account,
    lead.email,
    data.subject,
    data.body,
    previousActivity?.gmailThreadId || undefined
  );

  // Log activity
  await prisma.outreachActivity.create({
    data: {
      leadId: data.leadId,
      enrollmentId: data.enrollmentId,
      type: "EMAIL_SENT",
      channel: "EMAIL",
      gmailMessageId: result.gmailMessageId,
      gmailThreadId: result.gmailThreadId,
      subject: data.subject,
      body: data.body,
      fromEmail: account.email,
      toEmail: lead.email,
    },
  });

  // Increment daily count
  await prisma.gmailAccount.update({
    where: { id: account.id },
    data: { dailySentCount: { increment: 1 } },
  });

  job.log(`Email sent via Gmail (thread: ${result.gmailThreadId})`);
}

async function handleLinkedIn(
  prisma: PrismaClient,
  job: Job,
  lead: { linkedinUrl: string | null; firstName: string; lastName: string },
  org: { phantombusterApiKey: string | null; phantombusterConnectAgentId: string | null; phantombusterMessageAgentId: string | null },
  data: { enrollmentId: string; leadId: string; body: string; stepOrder: number; stepType: string }
) {
  if (!lead.linkedinUrl) {
    job.log(`No LinkedIn URL for ${lead.firstName} ${lead.lastName}, skipping`);
    return;
  }
  if (!org.phantombusterApiKey) throw new Error("PhantomBuster API key not configured");

  const config = {
    apiKey: org.phantombusterApiKey,
    connectAgentId: org.phantombusterConnectAgentId || "",
    messageAgentId: org.phantombusterMessageAgentId || "",
  };

  if (data.stepType === "linkedin_connect") {
    if (!config.connectAgentId) throw new Error("PhantomBuster Connect Agent ID not configured");

    job.log(`Sending LinkedIn connection to ${lead.linkedinUrl}`);
    const result = await sendConnectionRequest(config, lead.linkedinUrl, data.body);

    await prisma.outreachActivity.create({
      data: {
        leadId: data.leadId,
        enrollmentId: data.enrollmentId,
        type: "LINKEDIN_CONNECT_SENT",
        channel: "LINKEDIN",
        linkedinNote: data.body,
        metadata: { containerId: result.containerId },
      },
    });
  } else if (data.stepType === "linkedin_message") {
    if (!config.messageAgentId) {
      job.log("PhantomBuster Message Agent not configured, skipping LinkedIn message step");
      return;
    }

    job.log(`Sending LinkedIn message to ${lead.linkedinUrl}`);
    const result = await sendLinkedInMessage(config, lead.linkedinUrl, data.body);

    await prisma.outreachActivity.create({
      data: {
        leadId: data.leadId,
        enrollmentId: data.enrollmentId,
        type: "LINKEDIN_MESSAGE_SENT",
        channel: "LINKEDIN",
        linkedinNote: data.body,
        metadata: { containerId: result.containerId },
      },
    });
  }
}

async function scheduleNextStep(
  prisma: PrismaClient,
  enrollmentId: string,
  currentStepOrder: number,
  organizationId: string
) {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { sequence: { include: { steps: { orderBy: { order: "asc" } } } } },
  });

  if (!enrollment) return;

  const nextStep = enrollment.sequence.steps.find((s) => s.order === currentStepOrder + 1);
  if (nextStep) {
    const delayMs = nextStep.delayDays * 24 * 60 * 60 * 1000;
    const { copywriterQueue } = await import("../lib/queue");
    await copywriterQueue.add(
      "copywriter",
      { enrollmentId, stepOrder: nextStep.order, organizationId },
      { delay: delayMs }
    );
  } else {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { completedAt: new Date(), isActive: false },
    });
  }
}

export function createOutreachWorker() {
  const worker = new Worker<OutreachJobData>(
    "outreach",
    processOutreachJob,
    { connection: redis, concurrency: 2 }
  );

  worker.on("completed", (job) => console.log(`[outreach] Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`[outreach] Job ${job?.id} failed:`, err.message));

  return worker;
}

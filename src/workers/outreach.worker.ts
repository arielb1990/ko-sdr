import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createEmailService, getWarmupDailyLimit } from "../services/email";

type OutreachJobData = {
  enrollmentId: string;
  leadId: string;
  organizationId: string;
  subject: string;
  body: string;
  stepOrder: number;
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processOutreachJob(job: Job<OutreachJobData>) {
  const prisma = createPrisma();
  const { enrollmentId, leadId, organizationId, subject, body, stepOrder } = job.data;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      icommSmtpHost: true,
      icommSmtpPort: true,
      icommSmtpUser: true,
      icommSmtpPass: true,
      emailDomain: true,
    },
  });

  if (!org) throw new Error("Organization not found");

  const emailService = createEmailService(org);
  if (!emailService) throw new Error("ICOMM SMTP not configured. Go to Settings.");

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Check warm-up limits
  const firstSentActivity = await prisma.outreachActivity.findFirst({
    where: {
      type: "EMAIL_SENT",
      lead: { organizationId },
    },
    orderBy: { createdAt: "asc" },
  });

  const daysSinceStart = firstSentActivity
    ? Math.floor((Date.now() - firstSentActivity.createdAt.getTime()) / 86400000)
    : 0;

  const dailyLimit = getWarmupDailyLimit(daysSinceStart);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const sentToday = await prisma.outreachActivity.count({
    where: {
      type: "EMAIL_SENT",
      lead: { organizationId },
      createdAt: { gte: todayStart },
    },
  });

  if (sentToday >= dailyLimit) {
    // Reschedule for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const delay = tomorrow.getTime() - Date.now();
    const { outreachQueue } = await import("../lib/queue");
    await outreachQueue.add("outreach", job.data, { delay });
    job.log(`Daily limit reached (${sentToday}/${dailyLimit}). Rescheduled for tomorrow.`);
    return;
  }

  // Send email
  const fromEmail = org.icommSmtpUser || `sdr@${org.emailDomain || "knownonline.com"}`;

  job.log(`Sending to ${lead.email}: "${subject}"`);

  const result = await emailService.send({
    from: `Known Online <${fromEmail}>`,
    to: lead.email,
    subject,
    body,
  });

  // Log activity
  await prisma.outreachActivity.create({
    data: {
      leadId,
      enrollmentId,
      type: "EMAIL_SENT",
      channel: "EMAIL",
      emailMessageId: result.messageId,
      subject,
      body,
      fromEmail,
      toEmail: lead.email,
    },
  });

  // Update enrollment step
  await prisma.sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: { currentStep: stepOrder },
  });

  // Update lead status if not already in sequence
  await prisma.lead.updateMany({
    where: { id: leadId, status: { in: ["APPROVED", "IN_SEQUENCE"] } },
    data: { status: "IN_SEQUENCE" },
  });

  // Schedule next step if exists
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { sequence: { include: { steps: { orderBy: { order: "asc" } } } } },
  });

  if (enrollment) {
    const nextStep = enrollment.sequence.steps.find((s) => s.order === stepOrder + 1);
    if (nextStep) {
      const delayMs = nextStep.delayDays * 24 * 60 * 60 * 1000;
      const { copywriterQueue } = await import("../lib/queue");
      await copywriterQueue.add(
        "copywriter",
        {
          enrollmentId,
          stepOrder: nextStep.order,
          organizationId,
        },
        { delay: delayMs }
      );
      job.log(`Next step ${nextStep.order} scheduled in ${nextStep.delayDays} days`);
    } else {
      // Sequence complete
      await prisma.sequenceEnrollment.update({
        where: { id: enrollmentId },
        data: { completedAt: new Date(), isActive: false },
      });
      job.log("Sequence completed");
    }
  }

  return { messageId: result.messageId };
}

export function createOutreachWorker() {
  const worker = new Worker<OutreachJobData>(
    "outreach",
    processOutreachJob,
    {
      connection: redis,
      concurrency: 2,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[outreach] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[outreach] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

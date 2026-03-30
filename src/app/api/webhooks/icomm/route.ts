import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { responseClassificationQueue } from "@/lib/queue";

/**
 * Webhook endpoint for ICOMM email events (opens, clicks, replies, bounces).
 * ICOMM sends POST requests with event data.
 *
 * This also handles manual reply ingestion via POST with { leadEmail, replyBody }.
 */
export async function POST(request: Request) {
  const body = await request.json();

  // Support both ICOMM webhook format and manual reply ingestion
  const eventType = body.event || body.type;
  const email = body.email || body.leadEmail;
  const messageId = body.messageId || body.message_id;

  if (!email && !messageId) {
    return NextResponse.json({ error: "email or messageId required" }, { status: 400 });
  }

  // Find the lead by email or message ID
  let activity;
  if (messageId) {
    activity = await prisma.outreachActivity.findFirst({
      where: { emailMessageId: messageId },
      include: { lead: true },
    });
  }

  if (!activity && email) {
    activity = await prisma.outreachActivity.findFirst({
      where: { toEmail: email.toLowerCase(), type: "EMAIL_SENT" },
      orderBy: { createdAt: "desc" },
      include: { lead: true },
    });
  }

  if (!activity) {
    return NextResponse.json({ ok: true, message: "Lead not found, event ignored" });
  }

  const leadId = activity.leadId;
  const enrollmentId = activity.enrollmentId;

  switch (eventType) {
    case "open":
    case "opened": {
      await prisma.outreachActivity.create({
        data: {
          leadId,
          enrollmentId,
          type: "EMAIL_OPENED",
          channel: "EMAIL",
          emailMessageId: messageId,
          toEmail: email,
        },
      });
      break;
    }

    case "click":
    case "clicked": {
      await prisma.outreachActivity.create({
        data: {
          leadId,
          enrollmentId,
          type: "EMAIL_CLICKED",
          channel: "EMAIL",
          emailMessageId: messageId,
          toEmail: email,
          metadata: body.url ? { url: body.url } : undefined,
        },
      });
      break;
    }

    case "reply":
    case "replied":
    case "inbound": {
      const replyBody = body.replyBody || body.body || body.text || "";

      const replyActivity = await prisma.outreachActivity.create({
        data: {
          leadId,
          enrollmentId,
          type: "EMAIL_REPLIED",
          channel: "EMAIL",
          emailMessageId: messageId,
          toEmail: email,
          replyBody,
        },
      });

      // Update lead status
      await prisma.lead.updateMany({
        where: { id: leadId, status: { in: ["IN_SEQUENCE", "APPROVED"] } },
        data: { status: "REPLIED" },
      });

      // Enqueue classification
      await responseClassificationQueue.add("response-classification", {
        activityId: replyActivity.id,
        organizationId: activity.lead.organizationId,
      });

      break;
    }

    case "bounce":
    case "bounced": {
      await prisma.outreachActivity.create({
        data: {
          leadId,
          enrollmentId,
          type: "EMAIL_BOUNCED",
          channel: "EMAIL",
          emailMessageId: messageId,
          toEmail: email,
        },
      });

      // Pause enrollment and mark lead
      if (enrollmentId) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollmentId },
          data: { isActive: false, pausedAt: new Date() },
        });
      }
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "DISQUALIFIED" },
      });
      break;
    }

    case "unsubscribe":
    case "unsubscribed": {
      await prisma.outreachActivity.create({
        data: {
          leadId,
          enrollmentId,
          type: "EMAIL_UNSUBSCRIBED",
          channel: "EMAIL",
          toEmail: email,
        },
      });

      if (enrollmentId) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollmentId },
          data: { isActive: false, pausedAt: new Date() },
        });
      }
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "NOT_INTERESTED" },
      });
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

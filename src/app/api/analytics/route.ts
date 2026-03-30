import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.user.organizationId;
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Pipeline funnel
  const [
    totalDiscovered,
    totalResearched,
    totalQualified,
    totalDisqualified,
    totalPendingApproval,
    totalApproved,
    totalRejected,
    totalInSequence,
    totalReplied,
    totalInterested,
    totalNotInterested,
    totalMeetings,
    totalPushedCrm,
  ] = await Promise.all([
    prisma.lead.count({ where: { organizationId: orgId, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: { in: ["RESEARCHED", "SCORING", "QUALIFIED", "DISQUALIFIED", "PENDING_APPROVAL", "APPROVED", "REJECTED", "IN_SEQUENCE", "REPLIED", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "PUSHED_TO_CRM"] }, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, aiRelevanceScore: { gte: 60 }, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "DISQUALIFIED", createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "PENDING_APPROVAL", createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: { in: ["APPROVED", "IN_SEQUENCE", "REPLIED", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "PUSHED_TO_CRM"] }, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "REJECTED", createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: { in: ["IN_SEQUENCE", "REPLIED", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "PUSHED_TO_CRM"] }, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: { in: ["REPLIED", "INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED", "PUSHED_TO_CRM"] }, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: { in: ["INTERESTED", "MEETING_BOOKED", "PUSHED_TO_CRM"] }, createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "NOT_INTERESTED", createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "MEETING_BOOKED", createdAt: { gte: since } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "PUSHED_TO_CRM", createdAt: { gte: since } } }),
  ]);

  // Outreach stats
  const [emailsSent, emailsOpened, emailsClicked, emailsReplied, emailsBounced] =
    await Promise.all([
      prisma.outreachActivity.count({ where: { type: "EMAIL_SENT", lead: { organizationId: orgId }, createdAt: { gte: since } } }),
      prisma.outreachActivity.count({ where: { type: "EMAIL_OPENED", lead: { organizationId: orgId }, createdAt: { gte: since } } }),
      prisma.outreachActivity.count({ where: { type: "EMAIL_CLICKED", lead: { organizationId: orgId }, createdAt: { gte: since } } }),
      prisma.outreachActivity.count({ where: { type: "EMAIL_REPLIED", lead: { organizationId: orgId }, createdAt: { gte: since } } }),
      prisma.outreachActivity.count({ where: { type: "EMAIL_BOUNCED", lead: { organizationId: orgId }, createdAt: { gte: since } } }),
    ]);

  // Sequence performance
  const sequences = await prisma.sequence.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      _count: { select: { enrollments: true } },
      enrollments: {
        where: { createdAt: { gte: since } },
        select: {
          lead: { select: { status: true } },
          activities: { where: { type: "EMAIL_REPLIED" }, select: { id: true } },
        },
      },
    },
  });

  const sequencePerformance = sequences.map((seq) => {
    const enrolled = seq.enrollments.length;
    const replied = seq.enrollments.filter((e) => e.activities.length > 0).length;
    const interested = seq.enrollments.filter(
      (e) => e.lead.status === "INTERESTED" || e.lead.status === "MEETING_BOOKED" || e.lead.status === "PUSHED_TO_CRM"
    ).length;
    return {
      id: seq.id,
      name: seq.name,
      totalEnrolled: seq._count.enrollments,
      periodEnrolled: enrolled,
      replied,
      interested,
      replyRate: enrolled > 0 ? (replied / enrolled) * 100 : 0,
      interestRate: enrolled > 0 ? (interested / enrolled) * 100 : 0,
    };
  });

  // ICP performance
  const icpConfigs = await prisma.icpConfig.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      discoveryRuns: {
        where: { createdAt: { gte: since } },
        select: {
          totalFound: true,
          totalNew: true,
          totalExcluded: true,
          leads: {
            select: { status: true, aiRelevanceScore: true },
          },
        },
      },
    },
  });

  const icpPerformance = icpConfigs.map((icp) => {
    const allLeads = icp.discoveryRuns.flatMap((r) => r.leads);
    const totalFound = icp.discoveryRuns.reduce((sum, r) => sum + r.totalFound, 0);
    const totalNew = icp.discoveryRuns.reduce((sum, r) => sum + r.totalNew, 0);
    const qualified = allLeads.filter((l) => (l.aiRelevanceScore ?? 0) >= 60).length;
    const avgScore = allLeads.length > 0
      ? allLeads.reduce((sum, l) => sum + (l.aiRelevanceScore || 0), 0) / allLeads.length
      : 0;
    return {
      id: icp.id,
      name: icp.name,
      runs: icp.discoveryRuns.length,
      totalFound,
      totalNew,
      qualified,
      qualifyRate: totalNew > 0 ? (qualified / totalNew) * 100 : 0,
      avgScore: Math.round(avgScore),
    };
  });

  // Daily leads over time (last N days)
  const dailyLeads = await prisma.$queryRawUnsafe<Array<{ date: string; count: bigint }>>(
    `SELECT DATE(l."createdAt") as date, COUNT(*)::bigint as count
     FROM "Lead" l
     WHERE l."organizationId" = $1 AND l."createdAt" >= $2
     GROUP BY DATE(l."createdAt")
     ORDER BY date ASC`,
    orgId,
    since
  );

  return NextResponse.json({
    period: { days, since: since.toISOString() },
    funnel: {
      discovered: totalDiscovered,
      researched: totalResearched,
      qualified: totalQualified,
      disqualified: totalDisqualified,
      pendingApproval: totalPendingApproval,
      approved: totalApproved,
      rejected: totalRejected,
      inSequence: totalInSequence,
      replied: totalReplied,
      interested: totalInterested,
      notInterested: totalNotInterested,
      meetings: totalMeetings,
      pushedCrm: totalPushedCrm,
    },
    outreach: {
      sent: emailsSent,
      opened: emailsOpened,
      clicked: emailsClicked,
      replied: emailsReplied,
      bounced: emailsBounced,
      openRate: emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0,
      clickRate: emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0,
      replyRate: emailsSent > 0 ? (emailsReplied / emailsSent) * 100 : 0,
      bounceRate: emailsSent > 0 ? (emailsBounced / emailsSent) * 100 : 0,
    },
    sequencePerformance,
    icpPerformance,
    dailyLeads: dailyLeads.map((d) => ({
      date: d.date,
      count: Number(d.count),
    })),
  });
}

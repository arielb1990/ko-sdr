import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.user.organizationId;

  const [
    totalLeads,
    discovered,
    researching,
    qualified,
    disqualified,
    pendingApproval,
    approved,
    rejected,
    inSequence,
    interested,
    recentRuns,
  ] = await Promise.all([
    prisma.lead.count({ where: { organizationId: orgId } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "DISCOVERED" } }),
    prisma.lead.count({
      where: {
        organizationId: orgId,
        status: { in: ["RESEARCHING", "RESEARCHED", "SCORING"] },
      },
    }),
    prisma.lead.count({ where: { organizationId: orgId, status: "QUALIFIED" } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "DISQUALIFIED" } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "PENDING_APPROVAL" } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "APPROVED" } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "REJECTED" } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "IN_SEQUENCE" } }),
    prisma.lead.count({
      where: {
        organizationId: orgId,
        status: { in: ["INTERESTED", "MEETING_BOOKED"] },
      },
    }),
    prisma.discoveryRun.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        totalFound: true,
        totalNew: true,
        totalExcluded: true,
        createdAt: true,
        completedAt: true,
        icpConfig: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    stats: {
      totalLeads,
      discovered,
      researching,
      qualified,
      disqualified,
      pendingApproval,
      approved,
      rejected,
      inSequence,
      interested,
    },
    recentRuns,
  });
}

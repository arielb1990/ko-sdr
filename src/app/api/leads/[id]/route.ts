import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      company: true,
      outreachActivities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      approvalItems: {
        include: { actions: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
      },
      discoveryRun: {
        select: { id: true, createdAt: true, status: true },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(lead);
}

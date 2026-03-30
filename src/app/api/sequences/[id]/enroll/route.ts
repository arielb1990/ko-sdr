import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { copywriterQueue } from "@/lib/queue";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sequenceId } = await params;
  const body = await request.json();
  const { leadIds } = body as { leadIds: string[] };

  if (!leadIds?.length) {
    return NextResponse.json({ error: "leadIds is required" }, { status: 400 });
  }

  // Verify sequence exists and has steps
  const sequence = await prisma.sequence.findFirst({
    where: { id: sequenceId, organizationId: session.user.organizationId },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!sequence) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  if (sequence.steps.length === 0) {
    return NextResponse.json({ error: "Sequence has no steps" }, { status: 400 });
  }

  let enrolled = 0;

  for (const leadId of leadIds) {
    // Verify lead is approved and belongs to org
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId: session.user.organizationId,
        status: "APPROVED",
      },
    });

    if (!lead) continue;

    // Check not already enrolled in this sequence
    const existing = await prisma.sequenceEnrollment.findUnique({
      where: { leadId_sequenceId: { leadId, sequenceId } },
    });

    if (existing) continue;

    // Create enrollment
    const enrollment = await prisma.sequenceEnrollment.create({
      data: { leadId, sequenceId },
    });

    // Trigger first step immediately
    await copywriterQueue.add("copywriter", {
      enrollmentId: enrollment.id,
      stepOrder: 1,
      organizationId: session.user.organizationId,
    });

    enrolled++;
  }

  return NextResponse.json({ enrolled });
}

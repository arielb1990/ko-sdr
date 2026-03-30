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

  const sequence = await prisma.sequence.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      steps: { orderBy: { order: "asc" } },
      enrollments: {
        include: { lead: { select: { firstName: true, lastName: true, email: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!sequence) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(sequence);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // Update sequence
  await prisma.sequence.updateMany({
    where: { id, organizationId: session.user.organizationId },
    data: {
      name: body.name,
      description: body.description,
      serviceContext: body.serviceContext,
      toneGuide: body.toneGuide,
      isActive: body.isActive,
    },
  });

  // Replace steps if provided
  if (body.steps) {
    await prisma.sequenceStep.deleteMany({ where: { sequenceId: id } });
    await prisma.sequenceStep.createMany({
      data: body.steps.map(
        (step: { subjectTemplate?: string; bodyTemplate: string; delayDays: number }, i: number) => ({
          sequenceId: id,
          order: i + 1,
          delayDays: step.delayDays || 0,
          subjectTemplate: step.subjectTemplate || null,
          bodyTemplate: step.bodyTemplate,
        })
      ),
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.sequence.deleteMany({
    where: { id, organizationId: session.user.organizationId },
  });

  return NextResponse.json({ ok: true });
}

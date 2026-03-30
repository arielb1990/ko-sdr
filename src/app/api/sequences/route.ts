import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sequences = await prisma.sequence.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sequences);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const sequence = await prisma.sequence.create({
    data: {
      organizationId: session.user.organizationId,
      name: body.name,
      description: body.description || null,
      channel: body.channel || "EMAIL",
      serviceContext: body.serviceContext || null,
      toneGuide: body.toneGuide || null,
      steps: {
        create: (body.steps || []).map(
          (step: { subjectTemplate?: string; bodyTemplate: string; delayDays: number }, i: number) => ({
            order: i + 1,
            delayDays: step.delayDays || 0,
            subjectTemplate: step.subjectTemplate || null,
            bodyTemplate: step.bodyTemplate,
          })
        ),
      },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(sequence, { status: 201 });
}

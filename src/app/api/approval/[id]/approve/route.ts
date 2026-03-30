import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const item = await prisma.approvalItem.findFirst({
    where: { id, lead: { organizationId: session.user.organizationId } },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "PENDING") {
    return NextResponse.json({ error: "Already resolved" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.approvalItem.update({
      where: { id },
      data: { status: "APPROVED", resolvedAt: new Date(), note: body.note || null },
    }),
    prisma.approvalAction.create({
      data: {
        approvalItemId: id,
        userId: session.user.id,
        action: "APPROVED",
        note: body.note || null,
      },
    }),
    prisma.lead.update({
      where: { id: item.leadId },
      data: { status: "APPROVED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

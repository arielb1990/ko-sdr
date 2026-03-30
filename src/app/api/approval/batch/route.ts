import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { ids, action, note } = body as {
    ids: string[];
    action: "APPROVED" | "REJECTED";
    note?: string;
  };

  if (!ids?.length || !action) {
    return NextResponse.json({ error: "ids and action are required" }, { status: 400 });
  }

  const leadStatus = action === "APPROVED" ? "APPROVED" : "REJECTED";
  let processed = 0;

  for (const id of ids) {
    const item = await prisma.approvalItem.findFirst({
      where: {
        id,
        status: "PENDING",
        lead: { organizationId: session.user.organizationId },
      },
    });

    if (!item) continue;

    await prisma.$transaction([
      prisma.approvalItem.update({
        where: { id },
        data: { status: action, resolvedAt: new Date(), note: note || null },
      }),
      prisma.approvalAction.create({
        data: {
          approvalItemId: id,
          userId: session.user.id,
          action,
          note: note || null,
        },
      }),
      prisma.lead.update({
        where: { id: item.leadId },
        data: { status: leadStatus },
      }),
    ]);

    processed++;
  }

  return NextResponse.json({ processed });
}

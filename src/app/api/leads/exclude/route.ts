import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, value } = await request.json();
  const orgId = session.user.organizationId;

  let updated = 0;

  if (type === "email") {
    const result = await prisma.lead.updateMany({
      where: {
        organizationId: orgId,
        email: value.toLowerCase(),
        status: { notIn: ["DISQUALIFIED", "PUSHED_TO_CRM"] },
      },
      data: { status: "DISQUALIFIED" },
    });
    updated = result.count;
  } else if (type === "domain") {
    const result = await prisma.lead.updateMany({
      where: {
        organizationId: orgId,
        company: { domain: value.toLowerCase() },
        status: { notIn: ["DISQUALIFIED", "PUSHED_TO_CRM"] },
      },
      data: { status: "DISQUALIFIED" },
    });
    updated = result.count;
  }

  return NextResponse.json({ updated });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  const config = await prisma.icpConfig.updateMany({
    where: { id, organizationId: session.user.organizationId },
    data: {
      name: body.name,
      isActive: body.isActive,
      countries: body.countries,
      employeeRanges: body.employeeRanges,
      jobTitles: body.jobTitles,
      industries: body.industries,
      keywords: body.keywords,
      excludeKeywords: body.excludeKeywords,
      scoringCriteria: body.scoringCriteria || undefined,
    },
  });

  return NextResponse.json(config);
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

  await prisma.icpConfig.deleteMany({
    where: { id, organizationId: session.user.organizationId },
  });

  return NextResponse.json({ ok: true });
}

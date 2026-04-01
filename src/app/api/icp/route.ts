import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configs = await prisma.icpConfig.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const config = await prisma.icpConfig.create({
    data: {
      organizationId: session.user.organizationId,
      name: body.name,
      isActive: body.isActive ?? true,
      countries: body.countries || [],
      employeeRanges: body.employeeRanges || [],
      jobTitles: body.jobTitles || [],
      industries: body.industries || [],
      excludeIndustries: body.excludeIndustries || [],
      keywords: body.keywords || [],
      excludeKeywords: body.excludeKeywords || [],
      scoringCriteria: body.scoringCriteria || null,
    },
  });

  return NextResponse.json(config, { status: 201 });
}

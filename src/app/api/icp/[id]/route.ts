import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await prisma.icpConfig.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await prisma.icpConfig.update({
      where: { id },
      data: {
        name: body.name,
        isActive: body.isActive,
        countries: body.countries || [],
        employeeRanges: body.employeeRanges || [],
        jobTitles: body.jobTitles || [],
        industries: body.industries || [],
        excludeIndustries: body.excludeIndustries || [],
        keywords: body.keywords || [],
        excludeKeywords: body.excludeKeywords || [],
        scoringCriteria: body.scoringCriteria || undefined,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("[ICP PUT] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.icpConfig.findFirst({
      where: { id, organizationId: session.user.organizationId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.icpConfig.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ICP DELETE] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

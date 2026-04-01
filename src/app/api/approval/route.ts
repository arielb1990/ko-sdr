import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "PENDING";

  const items = await prisma.approvalItem.findMany({
    where: {
      status: status as "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED",
      lead: { organizationId: session.user.organizationId },
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          linkedinUrl: true,
          aiRelevanceScore: true,
          aiScoreReasoning: true,
          company: {
            select: {
              name: true,
              domain: true,
              country: true,
              industry: true,
              employeeCount: true,
              aiServiceMatch: true,
            },
          },
        },
      },
      actions: {
        include: { user: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(items);
}

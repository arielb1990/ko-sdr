import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { discoveryQueue } from "@/lib/queue";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runs = await prisma.discoveryRun.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      icpConfig: { select: { name: true } },
      _count: { select: { leads: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(runs);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { icpConfigId, maxPages } = body;

  if (!icpConfigId) {
    return NextResponse.json({ error: "icpConfigId is required" }, { status: 400 });
  }

  // Verify ICP config exists and belongs to org
  const icp = await prisma.icpConfig.findFirst({
    where: { id: icpConfigId, organizationId: session.user.organizationId },
  });

  if (!icp) {
    return NextResponse.json({ error: "ICP config not found" }, { status: 404 });
  }

  // Check Apollo API key
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { apolloApiKey: true },
  });

  if (!org?.apolloApiKey) {
    return NextResponse.json(
      { error: "Apollo API key not configured. Go to Settings to add it." },
      { status: 400 }
    );
  }

  // Create discovery run
  const run = await prisma.discoveryRun.create({
    data: {
      organizationId: session.user.organizationId,
      icpConfigId,
      status: "PENDING",
    },
  });

  // Enqueue job
  await discoveryQueue.add("discovery", {
    discoveryRunId: run.id,
    icpConfigId,
    organizationId: session.user.organizationId,
    maxPages: maxPages || 3,
  });

  return NextResponse.json(run, { status: 201 });
}

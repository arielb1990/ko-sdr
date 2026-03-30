import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
  };
  if (type) where.type = type;
  if (search) where.value = { contains: search, mode: "insensitive" };

  const exclusions = await prisma.exclusion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(exclusions);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.type || !body.value) {
    return NextResponse.json({ error: "type and value are required" }, { status: 400 });
  }

  const exclusion = await prisma.exclusion.upsert({
    where: {
      organizationId_type_value: {
        organizationId: session.user.organizationId,
        type: body.type,
        value: body.value.toLowerCase().trim(),
      },
    },
    create: {
      organizationId: session.user.organizationId,
      type: body.type,
      value: body.value.toLowerCase().trim(),
      reason: body.reason || null,
      source: "manual",
    },
    update: {
      reason: body.reason || undefined,
    },
  });

  return NextResponse.json(exclusion, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.exclusion.deleteMany({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
  };
  if (type) where.type = type;

  const items = await prisma.knowledgeItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.title || !body.description || !body.type) {
    return NextResponse.json({ error: "title, description, and type are required" }, { status: 400 });
  }

  const item = await prisma.knowledgeItem.create({
    data: {
      organizationId: session.user.organizationId,
      type: body.type,
      title: body.title,
      description: body.description,
      industry: body.industry || null,
      service: body.service || null,
      metrics: body.metrics || null,
      country: body.country || null,
      url: body.url || null,
      source: body.source || "manual",
    },
  });

  return NextResponse.json(item, { status: 201 });
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

  await prisma.knowledgeItem.deleteMany({
    where: {
      id,
      organizationId: session.user.organizationId,
    },
  });

  return NextResponse.json({ ok: true });
}

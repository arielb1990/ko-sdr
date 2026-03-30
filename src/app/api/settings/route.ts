import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.organization.findFirst({
    where: { id: session.user.organizationId },
    select: {
      apolloApiKey: true,
      hubspotAccessToken: true,
      icommApiKey: true,
      icommSmtpHost: true,
      icommSmtpPort: true,
      icommSmtpUser: true,
      icommSmtpPass: true,
      anthropicApiKey: true,
      emailDomain: true,
      requireLeadApproval: true,
      requireMessageApproval: true,
      autoApproveThreshold: true,
    },
  });

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  // Mask secrets - only show last 4 chars
  const masked = {
    ...org,
    apolloApiKey: maskSecret(org.apolloApiKey),
    hubspotAccessToken: maskSecret(org.hubspotAccessToken),
    icommApiKey: maskSecret(org.icommApiKey),
    icommSmtpPass: maskSecret(org.icommSmtpPass),
    anthropicApiKey: maskSecret(org.anthropicApiKey),
  };

  return NextResponse.json(masked);
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "CCO") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Only update fields that aren't masked (i.e., actually changed)
  const updateData: Record<string, unknown> = {};
  const fields = [
    "apolloApiKey",
    "hubspotAccessToken",
    "icommApiKey",
    "icommSmtpHost",
    "icommSmtpPort",
    "icommSmtpUser",
    "icommSmtpPass",
    "anthropicApiKey",
    "emailDomain",
    "requireLeadApproval",
    "requireMessageApproval",
    "autoApproveThreshold",
  ] as const;

  for (const field of fields) {
    const value = body[field];
    if (value === undefined) continue;
    // Skip masked values
    if (typeof value === "string" && value.startsWith("••••")) continue;
    updateData[field] = value;
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}

function maskSecret(value: string | null): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

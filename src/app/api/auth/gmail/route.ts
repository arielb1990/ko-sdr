import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailAuthUrl } from "@/services/gmail";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = session.user.organizationId;
  const url = getGmailAuthUrl(state);

  return NextResponse.redirect(url);
}

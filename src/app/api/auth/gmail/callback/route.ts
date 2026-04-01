import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens } from "@/services/gmail";
import { google } from "googleapis";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || state !== session.user.organizationId) {
    return NextResponse.redirect(new URL("/settings?error=gmail_auth_failed", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Get the email address of the authenticated account
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: tokens.access_token });
    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress!;

    // Save or update the Gmail account
    await prisma.gmailAccount.upsert({
      where: {
        organizationId_email: {
          organizationId: session.user.organizationId,
          email,
        },
      },
      create: {
        organizationId: session.user.organizationId,
        email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        tokenExpiresAt: new Date(tokens.expiry_date!),
        isActive: true,
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: new Date(tokens.expiry_date!),
        isActive: true,
      },
    });

    return NextResponse.redirect(new URL("/settings?gmail=connected", request.url));
  } catch (error) {
    console.error("Gmail OAuth error:", error);
    return NextResponse.redirect(new URL("/settings?error=gmail_auth_failed", request.url));
  }
}

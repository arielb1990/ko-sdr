import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"];

type GmailAccountData = {
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
};

type SendResult = {
  gmailMessageId: string;
  gmailThreadId: string;
};

type ReplyFound = {
  gmailThreadId: string;
  gmailMessageId: string;
  from: string;
  body: string;
  receivedAt: Date;
};

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
  );
}

export function getGmailAuthUrl(state: string): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

function createAuthClient(account: GmailAccountData) {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiresAt.getTime(),
  });
  return oauth2;
}

export async function refreshTokenIfNeeded(
  account: GmailAccountData
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  if (account.tokenExpiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return null; // Still valid
  }

  const oauth2 = createAuthClient(account);
  const { credentials } = await oauth2.refreshAccessToken();

  return {
    accessToken: credentials.access_token!,
    expiresAt: new Date(credentials.expiry_date!),
  };
}

/**
 * Send an email via Gmail API. Returns messageId and threadId.
 * If threadId is provided, sends as a reply in the same thread.
 */
export async function sendEmail(
  account: GmailAccountData,
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<SendResult> {
  const oauth2 = createAuthClient(account);
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  // Build RFC 2822 message
  const messageParts = [
    `From: ${account.email}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];

  const rawMessage = Buffer.from(messageParts.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: rawMessage,
      threadId: threadId || undefined,
    },
  });

  return {
    gmailMessageId: res.data.id!,
    gmailThreadId: res.data.threadId!,
  };
}

/**
 * Check for new replies in threads where we sent emails.
 * Returns replies received after sinceTimestamp.
 */
export async function checkReplies(
  account: GmailAccountData,
  sinceTimestamp: Date
): Promise<ReplyFound[]> {
  const oauth2 = createAuthClient(account);
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const sinceEpoch = Math.floor(sinceTimestamp.getTime() / 1000);
  const query = `in:inbox is:unread after:${sinceEpoch}`;

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messages = listRes.data.messages || [];
  const replies: ReplyFound[] = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    const headers = detail.data.payload?.headers || [];
    const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
    const threadId = detail.data.threadId || "";

    // Skip emails FROM our own account (we sent them)
    if (from.toLowerCase().includes(account.email.toLowerCase())) continue;

    // Extract plain text body
    let body = "";
    const payload = detail.data.payload;
    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, "base64").toString("utf-8");
    } else if (payload?.parts) {
      const textPart = payload.parts.find(
        (p) => p.mimeType === "text/plain" && p.body?.data
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    replies.push({
      gmailThreadId: threadId,
      gmailMessageId: msg.id!,
      from,
      body,
      receivedAt: new Date(parseInt(detail.data.internalDate || "0")),
    });
  }

  return replies;
}

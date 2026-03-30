import nodemailer from "nodemailer";

type EmailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

type SendEmailParams = {
  from: string;
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
};

type SendResult = {
  messageId: string;
  success: boolean;
};

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async send(params: SendEmailParams): Promise<SendResult> {
    const info = await this.transporter.sendMail({
      from: params.from,
      to: params.to,
      replyTo: params.replyTo || params.from,
      subject: params.subject,
      text: params.body,
      html: textToHtml(params.body),
    });

    return {
      messageId: info.messageId,
      success: true,
    };
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

export function createEmailService(org: {
  icommSmtpHost: string | null;
  icommSmtpPort: string | null;
  icommSmtpUser: string | null;
  icommSmtpPass: string | null;
}): EmailService | null {
  if (!org.icommSmtpHost || !org.icommSmtpUser || !org.icommSmtpPass) {
    return null;
  }

  return new EmailService({
    host: org.icommSmtpHost,
    port: parseInt(org.icommSmtpPort || "587"),
    user: org.icommSmtpUser,
    pass: org.icommSmtpPass,
  });
}

/**
 * Simple warm-up schedule: returns max emails allowed per day
 * based on how many days since domain was first used.
 */
export function getWarmupDailyLimit(daysSinceStart: number): number {
  if (daysSinceStart < 7) return 5;
  if (daysSinceStart < 14) return 15;
  if (daysSinceStart < 21) return 30;
  if (daysSinceStart < 28) return 50;
  return 100;
}

function textToHtml(text: string): string {
  return text
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

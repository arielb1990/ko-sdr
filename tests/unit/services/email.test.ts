import { describe, it, expect } from "vitest";
import { getWarmupDailyLimit, createEmailService } from "@/services/email";

describe("getWarmupDailyLimit", () => {
  it("returns 5 for first week", () => {
    expect(getWarmupDailyLimit(0)).toBe(5);
    expect(getWarmupDailyLimit(3)).toBe(5);
    expect(getWarmupDailyLimit(6)).toBe(5);
  });

  it("returns 15 for second week", () => {
    expect(getWarmupDailyLimit(7)).toBe(15);
    expect(getWarmupDailyLimit(10)).toBe(15);
    expect(getWarmupDailyLimit(13)).toBe(15);
  });

  it("returns 30 for third week", () => {
    expect(getWarmupDailyLimit(14)).toBe(30);
    expect(getWarmupDailyLimit(20)).toBe(30);
  });

  it("returns 50 for fourth week", () => {
    expect(getWarmupDailyLimit(21)).toBe(50);
    expect(getWarmupDailyLimit(27)).toBe(50);
  });

  it("returns 100 after fourth week", () => {
    expect(getWarmupDailyLimit(28)).toBe(100);
    expect(getWarmupDailyLimit(60)).toBe(100);
    expect(getWarmupDailyLimit(365)).toBe(100);
  });
});

describe("createEmailService", () => {
  it("returns null when SMTP config is incomplete", () => {
    expect(
      createEmailService({
        icommSmtpHost: null,
        icommSmtpPort: null,
        icommSmtpUser: null,
        icommSmtpPass: null,
      })
    ).toBeNull();
  });

  it("returns null when host is missing", () => {
    expect(
      createEmailService({
        icommSmtpHost: null,
        icommSmtpPort: "587",
        icommSmtpUser: "user",
        icommSmtpPass: "pass",
      })
    ).toBeNull();
  });

  it("returns null when user is missing", () => {
    expect(
      createEmailService({
        icommSmtpHost: "smtp.icomm.com",
        icommSmtpPort: "587",
        icommSmtpUser: null,
        icommSmtpPass: "pass",
      })
    ).toBeNull();
  });

  it("returns EmailService instance when config is complete", () => {
    const service = createEmailService({
      icommSmtpHost: "smtp.icomm.com",
      icommSmtpPort: "587",
      icommSmtpUser: "user@icomm.com",
      icommSmtpPass: "secret",
    });

    expect(service).not.toBeNull();
    expect(service).toHaveProperty("send");
    expect(service).toHaveProperty("verify");
  });

  it("defaults to port 587 when port is null", () => {
    const service = createEmailService({
      icommSmtpHost: "smtp.icomm.com",
      icommSmtpPort: null,
      icommSmtpUser: "user",
      icommSmtpPass: "pass",
    });

    expect(service).not.toBeNull();
  });
});

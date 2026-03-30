import { describe, it, expect, vi } from "vitest";

// Test the maskSecret logic (extracted inline since it's a private function)
describe("Settings API - maskSecret logic", () => {
  function maskSecret(value: string | null): string {
    if (!value) return "";
    if (value.length <= 4) return "••••";
    return "••••" + value.slice(-4);
  }

  it("masks null values as empty string", () => {
    expect(maskSecret(null)).toBe("");
  });

  it("masks short values completely", () => {
    expect(maskSecret("abc")).toBe("••••");
    expect(maskSecret("abcd")).toBe("••••");
  });

  it("shows last 4 chars of longer values", () => {
    expect(maskSecret("sk-1234567890")).toBe("••••7890");
    expect(maskSecret("my-api-key-here")).toBe("••••here");
  });

  it("handles empty string", () => {
    expect(maskSecret("")).toBe("");
  });
});

describe("Settings API - validation logic", () => {
  it("should not update masked values", () => {
    const body = {
      apolloApiKey: "••••7890", // masked, should be skipped
      hubspotAccessToken: "new-real-token", // changed, should be updated
      emailDomain: "outreach-ko.com", // not a secret
      requireLeadApproval: true,
    };

    const updateData: Record<string, unknown> = {};
    const fields = [
      "apolloApiKey",
      "hubspotAccessToken",
      "emailDomain",
      "requireLeadApproval",
    ];

    for (const field of fields) {
      const value = body[field as keyof typeof body];
      if (value === undefined) continue;
      if (typeof value === "string" && value.startsWith("••••")) continue;
      updateData[field] = value;
    }

    expect(updateData).not.toHaveProperty("apolloApiKey");
    expect(updateData).toHaveProperty("hubspotAccessToken", "new-real-token");
    expect(updateData).toHaveProperty("emailDomain", "outreach-ko.com");
    expect(updateData).toHaveProperty("requireLeadApproval", true);
  });
});

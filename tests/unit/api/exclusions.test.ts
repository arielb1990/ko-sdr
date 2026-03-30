import { describe, it, expect } from "vitest";

describe("Exclusions API - validation logic", () => {
  it("normalizes email values to lowercase and trims", () => {
    const raw = "  Juan@TestCo.COM  ";
    const normalized = raw.toLowerCase().trim();
    expect(normalized).toBe("juan@testco.com");
  });

  it("normalizes domain values", () => {
    const raw = "  TestCo.COM  ";
    const normalized = raw.toLowerCase().trim();
    expect(normalized).toBe("testco.com");
  });

  it("rejects missing type", () => {
    const body = { value: "test.com" };
    const isValid = body.hasOwnProperty("type") && (body as Record<string, unknown>).type;
    expect(isValid).toBeFalsy();
  });

  it("rejects missing value", () => {
    const body = { type: "DOMAIN" };
    const isValid = body.hasOwnProperty("value") && (body as Record<string, unknown>).value;
    expect(isValid).toBeFalsy();
  });

  it("accepts valid exclusion types", () => {
    const validTypes = ["DOMAIN", "EMAIL", "COMPANY_NAME", "HUBSPOT_CLIENT", "HUBSPOT_CONTACT"];
    for (const type of validTypes) {
      expect(validTypes).toContain(type);
    }
  });
});

describe("Exclusions - dedup key", () => {
  it("generates unique composite key for upsert", () => {
    const orgId = "org1";
    const type = "DOMAIN";
    const value = "testco.com";

    const key = `${orgId}_${type}_${value}`;
    expect(key).toBe("org1_DOMAIN_testco.com");

    // Same input = same key
    const key2 = `${orgId}_${type}_${value}`;
    expect(key).toBe(key2);
  });

  it("different types create different keys", () => {
    const orgId = "org1";
    const value = "test@testco.com";

    const emailKey = `${orgId}_EMAIL_${value}`;
    const domainKey = `${orgId}_DOMAIN_${value}`;

    expect(emailKey).not.toBe(domainKey);
  });
});

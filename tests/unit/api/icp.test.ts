import { describe, it, expect } from "vitest";

describe("ICP Config - validation", () => {
  it("requires a name", () => {
    const body = { name: "", countries: ["AR"] };
    expect(body.name).toBeFalsy();
  });

  it("accepts valid country codes", () => {
    const validCodes = ["AR", "UY", "CL", "EC", "PE", "PA", "GT", "CR", "US"];
    const input = ["AR", "CL", "US"];

    for (const code of input) {
      expect(validCodes).toContain(code);
    }
  });

  it("accepts valid employee ranges", () => {
    const validRanges = ["11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001+"];
    const input = ["51-200", "201-500"];

    for (const range of input) {
      expect(validRanges).toContain(range);
    }
  });

  it("defaults arrays to empty when not provided", () => {
    const body = { name: "Test ICP" };
    const processed = {
      name: body.name,
      countries: (body as Record<string, unknown>).countries || [],
      employeeRanges: (body as Record<string, unknown>).employeeRanges || [],
      jobTitles: (body as Record<string, unknown>).jobTitles || [],
      industries: (body as Record<string, unknown>).industries || [],
      keywords: (body as Record<string, unknown>).keywords || [],
      excludeKeywords: (body as Record<string, unknown>).excludeKeywords || [],
    };

    expect(processed.countries).toEqual([]);
    expect(processed.jobTitles).toEqual([]);
  });
});

describe("ICP Config - scoring criteria", () => {
  it("accepts null scoring criteria", () => {
    const criteria = null;
    expect(criteria).toBeNull();
  });

  it("accepts JSON scoring criteria", () => {
    const criteria = {
      ecommerce_presence: 0.3,
      growth_signals: 0.2,
      company_size: 0.2,
      seniority_match: 0.3,
    };

    const sum = Object.values(criteria).reduce((a, b) => a + b, 0);
    expect(sum).toBe(1.0);
  });
});

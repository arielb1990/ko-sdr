import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { scoreLead } from "@/services/ai/scorer";

const baseInput = {
  leadName: "Juan Pérez",
  leadTitle: "CTO",
  leadSeniority: "Director",
  companyName: "TestCo",
  companyIndustry: "Retail",
  companyCountry: "Argentina",
  companyEmployeeCount: 200,
  companyBrief: "Empresa de retail con ecommerce",
  companyPainPoints: ["Conversión baja"],
  companyServiceMatches: ["VTEX"],
  icpJobTitles: ["CTO", "CMO"],
  icpCountries: ["AR"],
  icpEmployeeRanges: ["51-200", "201-500"],
  icpIndustries: [],
  icpKeywords: ["ecommerce"],
};

describe("scoreLead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns structured score with reasoning", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "lead_score",
          input: {
            score: 85,
            reasoning: "Excelente fit: CTO en empresa de retail con 200 empleados.",
            disqualify_reason: null,
          },
        },
      ],
    });

    const result = await scoreLead(baseInput);

    expect(result.score).toBe(85);
    expect(result.reasoning).toContain("Excelente fit");
    expect(result.disqualifyReason).toBeNull();
  });

  it("clamps score to 0-100 range", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "lead_score",
          input: { score: 150, reasoning: "Test" },
        },
      ],
    });

    const result = await scoreLead(baseInput);
    expect(result.score).toBe(100);
  });

  it("clamps negative score to 0", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "lead_score",
          input: { score: -10, reasoning: "Test" },
        },
      ],
    });

    const result = await scoreLead(baseInput);
    expect(result.score).toBe(0);
  });

  it("uses claude-sonnet-4 model", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "lead_score",
          input: { score: 50, reasoning: "Test" },
        },
      ],
    });

    await scoreLead(baseInput);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        tool_choice: { type: "tool", name: "lead_score" },
      })
    );
  });

  it("includes ICP criteria in the prompt", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "lead_score",
          input: { score: 70, reasoning: "Test" },
        },
      ],
    });

    await scoreLead(baseInput);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("CTO, CMO");
    expect(prompt).toContain("AR");
    expect(prompt).toContain("ecommerce");
  });
});

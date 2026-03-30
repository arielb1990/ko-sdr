import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Anthropic SDK
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

// Mock fetch for web scraping
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import { researchCompany } from "@/services/ai/researcher";

describe("researchCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to fail (no website content)
    mockFetch.mockRejectedValue(new Error("Network error"));
  });

  it("returns structured research output from tool_use", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "company_research",
          input: {
            brief: "Empresa de retail con tienda online en Magento.",
            pain_points: ["Conversión baja", "SEO débil"],
            service_matches: ["Magento", "SEO", "CRO"],
            personal_hooks: [
              "Recientemente lanzaron una nueva categoría de productos",
            ],
          },
        },
      ],
    });

    const result = await researchCompany({
      companyName: "Test Store",
      companyDomain: "teststore.com",
      companyDescription: "E-commerce de retail",
      companyIndustry: "Retail",
      companyCountry: "Argentina",
      companyTechnologies: ["Magento"],
      leadName: "Juan Pérez",
      leadTitle: "CTO",
    });

    expect(result.brief).toBe("Empresa de retail con tienda online en Magento.");
    expect(result.painPoints).toEqual(["Conversión baja", "SEO débil"]);
    expect(result.serviceMatches).toEqual(["Magento", "SEO", "CRO"]);
    expect(result.personalHooks).toHaveLength(1);
  });

  it("calls Claude with correct model and tool_choice", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "company_research",
          input: {
            brief: "Test",
            pain_points: [],
            service_matches: [],
            personal_hooks: [],
          },
        },
      ],
    });

    await researchCompany({
      companyName: "Test",
      companyDomain: "test.com",
      companyDescription: null,
      companyIndustry: null,
      companyCountry: null,
      companyTechnologies: [],
      leadName: "Test",
      leadTitle: null,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-20250514",
        tool_choice: { type: "tool", name: "company_research" },
        tools: expect.arrayContaining([
          expect.objectContaining({ name: "company_research" }),
        ]),
      })
    );
  });

  it("throws when AI returns no tool_use", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "some text" }],
    });

    await expect(
      researchCompany({
        companyName: "Test",
        companyDomain: "test.com",
        companyDescription: null,
        companyIndustry: null,
        companyCountry: null,
        companyTechnologies: [],
        leadName: "Test",
        leadTitle: null,
      })
    ).rejects.toThrow("AI did not return structured research output");
  });

  it("includes website content in prompt when scrape succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("<html><body><h1>Test Store</h1><p>We sell things</p></body></html>"),
    });

    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "company_research",
          input: {
            brief: "Test",
            pain_points: [],
            service_matches: [],
            personal_hooks: [],
          },
        },
      ],
    });

    await researchCompany({
      companyName: "Test",
      companyDomain: "test.com",
      companyDescription: null,
      companyIndustry: null,
      companyCountry: null,
      companyTechnologies: [],
      leadName: "Test",
      leadTitle: null,
    });

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Test Store");
    expect(prompt).toContain("We sell things");
  });
});

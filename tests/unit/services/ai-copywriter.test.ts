import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { generateEmail } from "@/services/ai/copywriter";

const baseInput = {
  leadFirstName: "María",
  leadLastName: "García",
  leadTitle: "Directora de Ecommerce",
  leadCountry: "Argentina",
  companyName: "FashionCo",
  companyIndustry: "Moda",
  companyBrief: "Retailer de moda con tienda online",
  companyPainPoints: ["Conversión baja en mobile"],
  companyServiceMatches: ["VTEX", "CRO"],
  personalHooks: "Lanzaron nueva colección recientemente",
  sequenceName: "VTEX LATAM",
  serviceContext: "VTEX Commerce - migración",
  toneGuide: "Profesional pero cercano",
  stepNumber: 1,
  stepTemplate: "Hola {nombre}, vi que {empresa} está creciendo...",
  subjectTemplate: "Una idea para {empresa}",
  previousStepsSent: [],
  relevantCaseStudies: [
    {
      title: "Migración VTEX para RetailX",
      description: "Migramos de Magento a VTEX",
      metrics: "+40% conversión",
      service: "VTEX",
    },
  ],
};

describe("generateEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns subject and body from AI", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "email_copy",
          input: {
            subject: "Una oportunidad para FashionCo",
            body: "Hola María,\n\nVi que FashionCo está creciendo...",
          },
        },
      ],
    });

    const result = await generateEmail(baseInput);

    expect(result.subject).toBe("Una oportunidad para FashionCo");
    expect(result.body).toContain("María");
  });

  it("includes case studies in the prompt", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "email_copy",
          input: { subject: "Test", body: "Test body" },
        },
      ],
    });

    await generateEmail(baseInput);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Migración VTEX para RetailX");
    expect(prompt).toContain("+40% conversión");
  });

  it("sets language to español for LATAM countries", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "email_copy",
          input: { subject: "Test", body: "Test" },
        },
      ],
    });

    await generateEmail(baseInput);

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("**Idioma:** español");
  });

  it("sets language to inglés for US leads", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "email_copy",
          input: { subject: "Test", body: "Test" },
        },
      ],
    });

    await generateEmail({ ...baseInput, leadCountry: "United States" });

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("**Idioma:** inglés");
  });

  it("includes previous emails context for follow-ups", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "email_copy",
          input: { subject: "Test", body: "Test" },
        },
      ],
    });

    await generateEmail({
      ...baseInput,
      stepNumber: 2,
      previousStepsSent: ["Una oportunidad para FashionCo"],
    });

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Email 1: Una oportunidad para FashionCo");
  });
});

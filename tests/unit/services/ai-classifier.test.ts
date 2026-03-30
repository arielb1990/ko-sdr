import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { classifyReply } from "@/services/ai/classifier";

const baseInput = {
  originalSubject: "Una oportunidad para TestCo",
  originalBody: "Hola Juan, vi que TestCo está creciendo...",
  replyBody: "",
  leadName: "Juan Pérez",
  companyName: "TestCo",
};

describe("classifyReply", () => {
  beforeEach(() => vi.clearAllMocks());

  it("classifies an interested reply", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "classify_reply",
          input: {
            classification: "INTERESTED",
            confidence: 0.95,
            suggested_next_action: "Agendar reunión",
          },
        },
      ],
    });

    const result = await classifyReply({
      ...baseInput,
      replyBody: "Me interesa, ¿podemos agendar una call?",
    });

    expect(result.classification).toBe("INTERESTED");
    expect(result.confidence).toBe(0.95);
    expect(result.suggestedNextAction).toBe("Agendar reunión");
  });

  it("classifies a not interested reply", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "classify_reply",
          input: {
            classification: "NOT_INTERESTED",
            confidence: 0.9,
            suggested_next_action: "Eliminar de secuencia",
          },
        },
      ],
    });

    const result = await classifyReply({
      ...baseInput,
      replyBody: "No me interesa, por favor no me contacten más.",
    });

    expect(result.classification).toBe("NOT_INTERESTED");
  });

  it("classifies an OOO reply", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "classify_reply",
          input: {
            classification: "OUT_OF_OFFICE",
            confidence: 0.99,
            suggested_next_action: "Recontactar en 1 semana",
          },
        },
      ],
    });

    const result = await classifyReply({
      ...baseInput,
      replyBody: "Estoy de vacaciones hasta el 15 de abril.",
    });

    expect(result.classification).toBe("OUT_OF_OFFICE");
  });

  it("uses claude-haiku model for efficiency", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "classify_reply",
          input: {
            classification: "OTHER",
            confidence: 0.5,
            suggested_next_action: "Revisar manualmente",
          },
        },
      ],
    });

    await classifyReply({ ...baseInput, replyBody: "Test" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-haiku-4-5-20251001",
        tool_choice: { type: "tool", name: "classify_reply" },
      })
    );
  });
});

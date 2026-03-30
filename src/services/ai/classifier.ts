import { getAnthropicClient } from "./client";

type ClassifierInput = {
  originalSubject: string;
  originalBody: string;
  replyBody: string;
  leadName: string;
  companyName: string;
};

type ClassifierOutput = {
  classification:
    | "INTERESTED"
    | "NOT_NOW"
    | "NOT_INTERESTED"
    | "OUT_OF_OFFICE"
    | "BOUNCE"
    | "UNSUBSCRIBE"
    | "OTHER";
  confidence: number;
  suggestedNextAction: string;
};

const SYSTEM_PROMPT = `Sos un analista de ventas experto en clasificar respuestas a cold emails B2B.

Clasificá la respuesta en una de estas categorías:
- INTERESTED: Muestra interés, quiere saber más, acepta reunión, pide info
- NOT_NOW: No es buen momento pero no cierra la puerta (vacaciones, presupuesto, timing)
- NOT_INTERESTED: Rechaza claramente, no le interesa, pide que no lo contacten
- OUT_OF_OFFICE: Respuesta automática de fuera de oficina
- BOUNCE: Email rebotado, dirección no existe
- UNSUBSCRIBE: Pide ser eliminado de la lista
- OTHER: No encaja en ninguna categoría clara

También sugerí la mejor acción siguiente.`;

export async function classifyReply(
  input: ClassifierInput,
  apiKey?: string
): Promise<ClassifierOutput> {
  const anthropic = getAnthropicClient(apiKey);

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Clasificá esta respuesta:

**Email original enviado a ${input.leadName} (${input.companyName}):**
Subject: ${input.originalSubject}
Body: ${input.originalBody.slice(0, 500)}

**Respuesta recibida:**
${input.replyBody}`,
      },
    ],
    tools: [
      {
        name: "classify_reply",
        description: "Clasifica la respuesta del lead",
        input_schema: {
          type: "object" as const,
          properties: {
            classification: {
              type: "string",
              enum: [
                "INTERESTED",
                "NOT_NOW",
                "NOT_INTERESTED",
                "OUT_OF_OFFICE",
                "BOUNCE",
                "UNSUBSCRIBE",
                "OTHER",
              ],
            },
            confidence: {
              type: "number",
              description: "Confianza de 0 a 1",
            },
            suggested_next_action: {
              type: "string",
              description:
                "Acción sugerida: ej 'Agendar reunión', 'Recontactar en 3 meses', 'Eliminar de secuencia'",
            },
          },
          required: ["classification", "confidence", "suggested_next_action"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "classify_reply" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not return classification");
  }

  const result = toolUse.input as {
    classification: ClassifierOutput["classification"];
    confidence: number;
    suggested_next_action: string;
  };

  return {
    classification: result.classification,
    confidence: result.confidence,
    suggestedNextAction: result.suggested_next_action,
  };
}

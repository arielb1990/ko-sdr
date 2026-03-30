import { getAnthropicClient } from "./client";

type ScoringInput = {
  leadName: string;
  leadTitle: string | null;
  leadSeniority: string | null;
  companyName: string;
  companyIndustry: string | null;
  companyCountry: string | null;
  companyEmployeeCount: number | null;
  companyBrief: string | null;
  companyPainPoints: string[];
  companyServiceMatches: string[];
  // ICP criteria
  icpJobTitles: string[];
  icpCountries: string[];
  icpEmployeeRanges: string[];
  icpIndustries: string[];
  icpKeywords: string[];
};

type ScoringOutput = {
  score: number;
  reasoning: string;
  disqualifyReason: string | null;
};

const SYSTEM_PROMPT = `Sos un experto en calificación de leads B2B para Known Online, una consultora de ecommerce y transformación digital.

Tu tarea es evaluar cuán buen fit es un lead para los servicios de Known Online, basándote en:
- Coincidencia con el Ideal Customer Profile (ICP)
- Señales de necesidad de servicios digitales/ecommerce
- Seniority y poder de decisión del contacto
- Tamaño y sofisticación de la empresa

Score de 0 a 100:
- 80-100: Excelente fit, alta prioridad
- 60-79: Buen fit, vale la pena contactar
- 40-59: Fit moderado, evaluar caso a caso
- 0-39: Bajo fit, no vale la pena

Si hay una razón clara para descalificar (empresa muy chica, competidor, etc), indicalo.
Respondé en español.`;

export async function scoreLead(
  input: ScoringInput,
  apiKey?: string
): Promise<ScoringOutput> {
  const anthropic = getAnthropicClient(apiKey);

  const userPrompt = `Calificá este lead contra el ICP:

**Lead:**
- Nombre: ${input.leadName}
- Cargo: ${input.leadTitle || "No disponible"}
- Seniority: ${input.leadSeniority || "No disponible"}

**Empresa:**
- Nombre: ${input.companyName}
- Industria: ${input.companyIndustry || "No disponible"}
- País: ${input.companyCountry || "No disponible"}
- Empleados: ${input.companyEmployeeCount || "No disponible"}
${input.companyBrief ? `- Brief IA: ${input.companyBrief}` : ""}
${input.companyPainPoints.length > 0 ? `- Pain points: ${input.companyPainPoints.join("; ")}` : ""}
${input.companyServiceMatches.length > 0 ? `- Servicios KO relevantes: ${input.companyServiceMatches.join(", ")}` : ""}

**ICP (Ideal Customer Profile):**
- Cargos objetivo: ${input.icpJobTitles.join(", ")}
- Países objetivo: ${input.icpCountries.join(", ")}
- Tamaño empresa: ${input.icpEmployeeRanges.join(", ")} empleados
${input.icpIndustries.length > 0 ? `- Industrias: ${input.icpIndustries.join(", ")}` : "- Industrias: Todas"}
${input.icpKeywords.length > 0 ? `- Keywords: ${input.icpKeywords.join(", ")}` : ""}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [
      {
        name: "lead_score",
        description: "Genera un score de 0-100 para el lead con reasoning",
        input_schema: {
          type: "object" as const,
          properties: {
            score: {
              type: "number",
              description: "Score de 0 a 100",
            },
            reasoning: {
              type: "string",
              description:
                "Explicación concisa del score (2-3 oraciones)",
            },
            disqualify_reason: {
              type: "string",
              description:
                "Razón de descalificación si el score es < 40, o null",
              nullable: true,
            },
          },
          required: ["score", "reasoning"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "lead_score" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not return structured scoring output");
  }

  const result = toolUse.input as {
    score: number;
    reasoning: string;
    disqualify_reason?: string | null;
  };

  return {
    score: Math.max(0, Math.min(100, result.score)),
    reasoning: result.reasoning,
    disqualifyReason: result.disqualify_reason || null,
  };
}

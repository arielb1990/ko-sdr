import { getAnthropicClient } from "./client";

type CopywriterInput = {
  leadFirstName: string;
  leadLastName: string;
  leadTitle: string | null;
  leadCountry: string | null;
  companyName: string;
  companyIndustry: string | null;
  companyBrief: string | null;
  companyPainPoints: string[];
  companyServiceMatches: string[];
  personalHooks: string | null;
  // Sequence context
  sequenceName: string;
  serviceContext: string | null;
  toneGuide: string | null;
  stepNumber: number;
  stepType: string; // "email" | "linkedin_connect" | "linkedin_message"
  stepTemplate: string;
  subjectTemplate: string | null;
  previousStepsSent: string[];
  // Knowledge base - relevant case studies
  relevantCaseStudies: Array<{
    title: string;
    description: string;
    metrics: string | null;
    service: string | null;
  }>;
};

type CopywriterOutput = {
  subject: string;
  body: string;
};

const LATAM_COUNTRIES = ["Argentina", "Uruguay", "Chile", "Ecuador", "Peru", "Panama", "Guatemala", "Costa Rica", "Mexico", "Colombia", "Brazil"];

const SYSTEM_PROMPT = `Sos un copywriter experto en outreach B2B para Known Online, una consultora líder en ecommerce y transformación digital en LATAM y USA.

Generás copy para email y LinkedIn según el tipo de paso.

Reglas para EMAIL:
- Emails cortos (máx 150 palabras), directos, sin fluff
- Tono profesional pero cercano, no corporativo aburrido
- El subject debe generar curiosidad sin ser clickbait
- Para follow-ups: referenciá el email anterior brevemente, agregá nuevo valor
- No incluyas links ni adjuntos en el primer email

Reglas para LINKEDIN CONNECTION (nota de conexión):
- Máximo 300 caracteres (límite de LinkedIn)
- Super conciso: una razón clara de por qué conectar
- No vendas nada, solo generá interés
- Mencioná algo específico de la persona o empresa

Reglas para LINKEDIN MESSAGE:
- Máximo 500 caracteres
- Más informal que email, tono de chat profesional
- Directo al punto, una pregunta o propuesta clara

Reglas generales:
- Personalización real basada en el research de la empresa
- Si hay casos de éxito relevantes, mencioná uno brevemente como social proof
- No uses frases genéricas como "espero que estés bien"
- Firmá como "El equipo de Known Online" (no inventar nombres)
- Si el lead es de LATAM, escribí en español. Si es de USA, en inglés.
- No incluyas links ni adjuntos en el primer email
- CTA claro: una sola pregunta o propuesta al final`;

export async function generateEmail(
  input: CopywriterInput,
  apiKey?: string
): Promise<CopywriterOutput> {
  const anthropic = getAnthropicClient(apiKey);

  const isLatam = LATAM_COUNTRIES.some(
    (c) => input.leadCountry?.toLowerCase().includes(c.toLowerCase())
  );
  const language = isLatam ? "español" : "inglés";

  let caseStudyContext = "";
  if (input.relevantCaseStudies.length > 0) {
    caseStudyContext = "\n**Casos de éxito relevantes para usar como social proof:**\n";
    for (const cs of input.relevantCaseStudies.slice(0, 3)) {
      caseStudyContext += `- ${cs.title}: ${cs.description}`;
      if (cs.metrics) caseStudyContext += ` (${cs.metrics})`;
      caseStudyContext += "\n";
    }
  }

  const typeLabel = input.stepType === "linkedin_connect" ? "nota de conexión LinkedIn"
    : input.stepType === "linkedin_message" ? "mensaje de LinkedIn"
    : "email";

  const userPrompt = `Generá ${typeLabel} (paso ${input.stepNumber}) de la secuencia "${input.sequenceName}".

**Idioma:** ${language}

**Lead:**
- ${input.leadFirstName} ${input.leadLastName}
- Cargo: ${input.leadTitle || "No disponible"}
- Empresa: ${input.companyName} (${input.companyIndustry || "industria no especificada"})
- País: ${input.leadCountry || "No disponible"}

**Research de la empresa:**
${input.companyBrief || "No disponible"}
${input.companyPainPoints.length > 0 ? `Pain points: ${input.companyPainPoints.join("; ")}` : ""}
${input.companyServiceMatches.length > 0 ? `Servicios relevantes: ${input.companyServiceMatches.join(", ")}` : ""}
${input.personalHooks ? `Hooks de personalización: ${input.personalHooks}` : ""}
${caseStudyContext}
${input.serviceContext ? `**Contexto del servicio a promover:** ${input.serviceContext}` : ""}
${input.toneGuide ? `**Guía de tono:** ${input.toneGuide}` : ""}

**Template base (usá como guía, no copies literal):**
Subject: ${input.subjectTemplate || "(generar)"}
Body: ${input.stepTemplate}

${input.previousStepsSent.length > 0 ? `**Emails anteriores ya enviados:**\n${input.previousStepsSent.map((s, i) => `Email ${i + 1}: ${s}`).join("\n")}` : "Este es el primer email de la secuencia."}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [
      {
        name: "email_copy",
        description: "Genera subject y body del email",
        input_schema: {
          type: "object" as const,
          properties: {
            subject: {
              type: "string",
              description: "Subject line del email (máx 60 chars)",
            },
            body: {
              type: "string",
              description: "Body del email en texto plano (máx 150 palabras)",
            },
          },
          required: ["subject", "body"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "email_copy" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not return structured email output");
  }

  const result = toolUse.input as { subject: string; body: string };

  return {
    subject: result.subject,
    body: result.body,
  };
}

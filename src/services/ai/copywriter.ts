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

const SYSTEM_PROMPT = `Sos un copywriter experto en cold email B2B para Known Online, una consultora líder en ecommerce y transformación digital en LATAM y USA.

Reglas:
- Emails cortos (máx 150 palabras), directos, sin fluff
- Tono profesional pero cercano, no corporativo aburrido
- Personalización real basada en el research de la empresa
- Si hay casos de éxito relevantes, mencioná uno brevemente como social proof
- No uses frases genéricas como "espero que estés bien" o "me gustaría presentarme"
- El subject debe generar curiosidad sin ser clickbait
- Firmá como "El equipo de Known Online" (no inventar nombres)
- Si el lead es de LATAM, escribí en español. Si es de USA, en inglés.
- Para follow-ups: referenciá el email anterior brevemente, agregá nuevo valor
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

  const userPrompt = `Generá el email ${input.stepNumber} de la secuencia "${input.sequenceName}".

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

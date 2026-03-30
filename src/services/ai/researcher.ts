import { getAnthropicClient } from "./client";

type ResearchInput = {
  companyName: string;
  companyDomain: string;
  companyDescription: string | null;
  companyIndustry: string | null;
  companyCountry: string | null;
  companyTechnologies: string[];
  leadName: string;
  leadTitle: string | null;
};

type ResearchOutput = {
  brief: string;
  painPoints: string[];
  serviceMatches: string[];
  personalHooks: string[];
};

const SYSTEM_PROMPT = `Sos un analista de negocios experto en ecommerce y transformación digital para Known Online, una consultora que ofrece servicios de VTEX, Magento, SEO, Full Commerce, Analytics y CRO.

Tu tarea es investigar una empresa y generar un brief comercial que ayude al equipo de ventas a entender:
1. Qué hace la empresa y cuál es su situación digital
2. Cuáles son sus posibles pain points en ecommerce/digital
3. Qué servicios de Known Online podrían ser relevantes
4. Hooks de personalización para el primer contacto

Respondé SIEMPRE en español. Sé conciso y directo.`;

export async function researchCompany(
  input: ResearchInput,
  apiKey?: string
): Promise<ResearchOutput> {
  const anthropic = getAnthropicClient(apiKey);

  // Try to scrape the company website for extra context
  let websiteContent = "";
  try {
    const res = await fetch(`https://${input.companyDomain}`, {
      headers: { "User-Agent": "KO-SDR/1.0 (research bot)" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      // Strip HTML tags and take first 3000 chars
      websiteContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 3000);
    }
  } catch {
    // Scrape failed, continue without it
  }

  const userPrompt = `Investigá esta empresa y generá un brief comercial:

**Empresa:** ${input.companyName}
**Dominio:** ${input.companyDomain}
**Industria:** ${input.companyIndustry || "No disponible"}
**País:** ${input.companyCountry || "No disponible"}
**Descripción:** ${input.companyDescription || "No disponible"}
**Tecnologías detectadas:** ${input.companyTechnologies.length > 0 ? input.companyTechnologies.join(", ") : "No disponible"}

**Contacto:** ${input.leadName} - ${input.leadTitle || "cargo no disponible"}

${websiteContent ? `**Contenido del sitio web:**\n${websiteContent}` : "No se pudo acceder al sitio web."}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    tools: [
      {
        name: "company_research",
        description:
          "Genera un brief de investigación de la empresa con pain points y servicios relevantes",
        input_schema: {
          type: "object" as const,
          properties: {
            brief: {
              type: "string",
              description:
                "Brief conciso de la empresa (2-4 oraciones): qué hace, presencia digital, oportunidades",
            },
            pain_points: {
              type: "array",
              items: { type: "string" },
              description:
                "Lista de 2-5 pain points potenciales en ecommerce/digital",
            },
            service_matches: {
              type: "array",
              items: { type: "string" },
              description:
                "Servicios de KO relevantes: VTEX, Magento, SEO, Full Commerce, Analytics, CRO, UX/UI",
            },
            personal_hooks: {
              type: "array",
              items: { type: "string" },
              description:
                "2-3 hooks de personalización para el primer email (algo específico de la empresa/persona)",
            },
          },
          required: [
            "brief",
            "pain_points",
            "service_matches",
            "personal_hooks",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: "company_research" },
  });

  // Extract tool use result
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not return structured research output");
  }

  const result = toolUse.input as {
    brief: string;
    pain_points: string[];
    service_matches: string[];
    personal_hooks: string[];
  };

  return {
    brief: result.brief,
    painPoints: result.pain_points,
    serviceMatches: result.service_matches,
    personalHooks: result.personal_hooks,
  };
}

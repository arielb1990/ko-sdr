import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const items = await scrapeKnownOnline();

    let count = 0;
    for (const item of items) {
      await prisma.knowledgeItem.upsert({
        where: {
          id: item.id || "nonexistent",
        },
        create: {
          organizationId: session.user.organizationId,
          type: item.type,
          title: item.title,
          description: item.description,
          industry: item.industry,
          service: item.service,
          country: item.country,
          url: item.url,
          source: "web_scrape",
        },
        update: {
          description: item.description,
          industry: item.industry,
          service: item.service,
        },
      });
      count++;
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      { error: "Failed to scrape website" },
      { status: 500 }
    );
  }
}

async function scrapeKnownOnline() {
  const items: Array<{
    id?: string;
    type: "CASE_STUDY" | "SERVICE" | "VERTICAL" | "TESTIMONIAL";
    title: string;
    description: string;
    industry?: string;
    service?: string;
    country?: string;
    url?: string;
  }> = [];

  // Scrape main services page
  try {
    const res = await fetch("https://knownonline.com", {
      headers: { "User-Agent": "KO-SDR/1.0 (internal tool)" },
    });
    const html = await res.text();

    // Extract services from the homepage
    const serviceMatches = html.match(/<h[23][^>]*>(.*?)<\/h[23]>/gi) || [];
    const knownServices = [
      "VTEX",
      "Magento",
      "SEO",
      "Full Commerce",
      "Analytics",
      "CRO",
      "Digital",
    ];

    for (const match of serviceMatches) {
      const text = match.replace(/<[^>]+>/g, "").trim();
      const relatedService = knownServices.find((s) =>
        text.toLowerCase().includes(s.toLowerCase())
      );
      if (relatedService && text.length > 5 && text.length < 200) {
        items.push({
          type: "SERVICE",
          title: text,
          description: `Servicio de ${relatedService} ofrecido por Known Online.`,
          service: relatedService,
          url: "https://knownonline.com",
        });
      }
    }
  } catch {
    // Silently handle fetch errors
  }

  // If scraping didn't yield results, seed with known KO services
  if (items.length === 0) {
    const koServices = [
      {
        title: "VTEX Commerce",
        description:
          "Implementación y migración a VTEX Commerce Cloud. Experiencia en retailers de moda, alimentos, electrónica y B2B.",
        service: "VTEX",
      },
      {
        title: "Magento / Adobe Commerce",
        description:
          "Desarrollo y optimización de tiendas Magento. Especialidad en catálogos grandes y operaciones complejas.",
        service: "Magento",
      },
      {
        title: "SEO & Content Strategy",
        description:
          "Estrategia SEO técnico y de contenidos para ecommerce. Auditorías, implementación y monitoreo continuo.",
        service: "SEO",
      },
      {
        title: "Full Commerce Operations",
        description:
          "Gestión integral de operaciones ecommerce: logística, atención al cliente, marketplace, fulfillment.",
        service: "Full Commerce",
      },
      {
        title: "Analytics & Data",
        description:
          "Implementación de GA4, dashboards, attribution modeling y data-driven decision making para ecommerce.",
        service: "Analytics",
      },
      {
        title: "CRO - Conversion Rate Optimization",
        description:
          "Auditorías CRO, A/B testing, optimización de funnel y mejora continua de conversión.",
        service: "CRO",
      },
    ];

    for (const svc of koServices) {
      items.push({
        type: "SERVICE",
        title: svc.title,
        description: svc.description,
        service: svc.service,
        url: "https://knownonline.com",
      });
    }
  }

  return items;
}

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: "known-online" },
    create: {
      name: "Known Online",
      slug: "known-online",
    },
    update: {},
  });

  console.log("Organization:", org.name);

  // Create admin user
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@knownonline.com" },
    create: {
      email: "admin@knownonline.com",
      name: "Admin KO",
      hashedPassword,
      role: "ADMIN",
      organizationId: org.id,
    },
    update: {},
  });

  console.log("Admin user:", admin.email);

  // Create CCO user
  const cco = await prisma.user.upsert({
    where: { email: "cco@knownonline.com" },
    create: {
      email: "cco@knownonline.com",
      name: "CCO KO",
      hashedPassword,
      role: "CCO",
      organizationId: org.id,
    },
    update: {},
  });

  console.log("CCO user:", cco.email);

  // Create default ICP config
  const icp = await prisma.icpConfig.create({
    data: {
      organizationId: org.id,
      name: "LATAM Ecommerce Directors",
      isActive: true,
      countries: ["AR", "UY", "CL", "EC", "PE", "PA", "GT", "CR"],
      employeeRanges: ["51-200", "201-500", "501-1000", "1001-5000"],
      jobTitles: [
        "Director de Ecommerce",
        "Gerente de Marketing",
        "CMO",
        "CTO",
        "Director de Tecnología",
        "CEO",
        "Director Digital",
      ],
      industries: [],
      keywords: ["ecommerce", "transformación digital", "tienda online"],
      excludeKeywords: [],
    },
  });

  console.log("ICP config:", icp.name);

  // Seed some exclusions (competitors)
  const competitors = [
    "vtex.com",
    "tiendanube.com",
    "shopify.com",
    "mercadolibre.com",
    "globant.com",
    "accenture.com",
  ];

  for (const domain of competitors) {
    await prisma.exclusion.upsert({
      where: {
        organizationId_type_value: {
          organizationId: org.id,
          type: "DOMAIN",
          value: domain,
        },
      },
      create: {
        organizationId: org.id,
        type: "DOMAIN",
        value: domain,
        reason: "Competidor",
        source: "manual",
      },
      update: {},
    });
  }

  console.log(`${competitors.length} exclusiones de competidores creadas`);

  // Seed knowledge base with KO services
  const services = [
    {
      type: "SERVICE" as const,
      title: "VTEX Commerce",
      description:
        "Implementación y migración a VTEX Commerce Cloud. Experiencia en retailers de moda, alimentos, electrónica y B2B.",
      service: "VTEX",
    },
    {
      type: "SERVICE" as const,
      title: "Magento / Adobe Commerce",
      description:
        "Desarrollo y optimización de tiendas Magento. Especialidad en catálogos grandes y operaciones complejas.",
      service: "Magento",
    },
    {
      type: "SERVICE" as const,
      title: "SEO & Content Strategy",
      description:
        "Estrategia SEO técnico y de contenidos para ecommerce. Auditorías, implementación y monitoreo continuo.",
      service: "SEO",
    },
    {
      type: "SERVICE" as const,
      title: "Full Commerce Operations",
      description:
        "Gestión integral de operaciones ecommerce: logística, atención al cliente, marketplace, fulfillment.",
      service: "Full Commerce",
    },
    {
      type: "SERVICE" as const,
      title: "Analytics & Data",
      description:
        "Implementación de GA4, dashboards, attribution modeling y data-driven decision making para ecommerce.",
      service: "Analytics",
    },
  ];

  for (const svc of services) {
    await prisma.knowledgeItem.create({
      data: {
        organizationId: org.id,
        type: svc.type,
        title: svc.title,
        description: svc.description,
        service: svc.service,
        source: "seed",
      },
    });
  }

  console.log(`${services.length} servicios KO creados en Knowledge Base`);
  console.log("\nSeed completado. Credenciales: admin@knownonline.com / admin123");

  await pool.end();
}

main().catch(console.error);

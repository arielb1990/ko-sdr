import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { ApolloClient, type ApolloPerson } from "../services/apollo";
import { researchQueue } from "../lib/queue";

type DiscoveryJobData = {
  discoveryRunId: string;
  icpConfigId: string;
  organizationId: string;
  maxPages?: number;
};

function createPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function processDiscoveryJob(job: Job<DiscoveryJobData>) {
  const prisma = createPrisma();

  try {
    const { discoveryRunId, icpConfigId, organizationId, maxPages = 3 } = job.data;

    // Update run status
    await prisma.discoveryRun.update({
      where: { id: discoveryRunId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    // Load ICP config
    const icp = await prisma.icpConfig.findUnique({
      where: { id: icpConfigId },
    });

    if (!icp) throw new Error(`ICP config ${icpConfigId} not found`);

    // Load org API key
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { apolloApiKey: true },
    });

    if (!org?.apolloApiKey) throw new Error("Apollo API key not configured");

    // Load exclusions
    const exclusions = await prisma.exclusion.findMany({
      where: { organizationId },
      select: { type: true, value: true },
    });

    const excludedDomains = new Set(
      exclusions
        .filter((e) => e.type === "DOMAIN" || e.type === "HUBSPOT_CLIENT")
        .map((e) => e.value.toLowerCase())
    );
    const excludedEmails = new Set(
      exclusions
        .filter((e) => e.type === "EMAIL" || e.type === "HUBSPOT_CONTACT")
        .map((e) => e.value.toLowerCase())
    );
    const excludedCompanies = new Set(
      exclusions
        .filter((e) => e.type === "COMPANY_NAME")
        .map((e) => e.value.toLowerCase())
    );

    // Load existing leads to dedup
    const existingLeads = await prisma.lead.findMany({
      where: { organizationId },
      select: { apolloId: true, email: true },
    });
    const existingApolloIds = new Set(existingLeads.map((l) => l.apolloId).filter((id): id is string => id != null));
    const existingEmails = new Set(existingLeads.map((l) => l.email.toLowerCase()));

    // Search Apollo
    const apollo = new ApolloClient(org.apolloApiKey);
    const filters = apollo.icpToFilters({
      countries: icp.countries,
      employeeRanges: icp.employeeRanges,
      jobTitles: icp.jobTitles,
      industries: icp.industries,
      keywords: icp.keywords,
    });

    job.log(`Searching Apollo with filters: ${JSON.stringify(filters)}`);

    const { people, totalFound } = await apollo.searchAllPages(filters, maxPages);

    job.log(`Found ${totalFound} total, fetched ${people.length} people`);

    let totalNew = 0;
    let totalExcluded = 0;

    for (const person of people) {
      const excluded = isExcluded(
        person,
        excludedDomains,
        excludedEmails,
        excludedCompanies,
        existingApolloIds,
        existingEmails
      );

      if (excluded) {
        totalExcluded++;
        continue;
      }

      try {
        // Enrich to get email
        let email = person.email;
        if (!email && person.id) {
          try {
            const enriched = await apollo.enrichPerson(person.id);
            email = enriched.person.email;
          } catch {
            // Skip if enrichment fails
          }
        }

        if (!email) {
          totalExcluded++;
          continue;
        }

        // Check again after enrichment
        if (existingEmails.has(email.toLowerCase())) {
          totalExcluded++;
          continue;
        }

        const domain = email.split("@")[1]?.toLowerCase();
        if (domain && excludedDomains.has(domain)) {
          totalExcluded++;
          continue;
        }

        // Create or find company
        const companyDomain =
          person.organization?.primary_domain ||
          person.organization?.website_url?.replace(/^https?:\/\//, "").replace(/\/.*/, "") ||
          domain;

        const company = await prisma.company.upsert({
          where: {
            organizationId_domain: {
              organizationId,
              domain: companyDomain,
            },
          },
          create: {
            organizationId,
            apolloId: person.organization?.id || null,
            domain: companyDomain,
            name: person.organization?.name || companyDomain,
            industry: person.organization?.industry || null,
            employeeCount: person.organization?.estimated_num_employees || null,
            annualRevenue: person.organization?.annual_revenue_printed || null,
            country: person.organization?.country || null,
            city: person.organization?.city || null,
            website: person.organization?.website_url || null,
            linkedinUrl: person.organization?.linkedin_url || null,
            description: person.organization?.short_description || null,
            technologies: person.organization?.technologies || [],
            source: "APOLLO",
          },
          update: {
            // Update with latest data from Apollo
            industry: person.organization?.industry || undefined,
            employeeCount: person.organization?.estimated_num_employees || undefined,
          },
        });

        // Create lead
        const newLead = await prisma.lead.create({
          data: {
            organizationId,
            apolloId: person.id,
            email: email.toLowerCase(),
            firstName: person.first_name || "",
            lastName: person.last_name || "",
            jobTitle: person.title || null,
            seniority: person.seniority || null,
            department: person.departments?.[0] || null,
            linkedinUrl: person.linkedin_url || null,
            companyId: company.id,
            status: "DISCOVERED",
            discoveryRunId,
          },
        });

        // Enqueue AI research
        await researchQueue.add("research", {
          leadId: newLead.id,
          organizationId,
        });

        totalNew++;
        existingEmails.add(email.toLowerCase());
        if (person.id) existingApolloIds.add(person.id);
      } catch (err) {
        // Skip duplicates or other errors for individual leads
        job.log(`Error processing ${person.name}: ${err}`);
      }
    }

    // Update discovery run
    await prisma.discoveryRun.update({
      where: { id: discoveryRunId },
      data: {
        status: "COMPLETED",
        totalFound,
        totalNew,
        totalExcluded,
        completedAt: new Date(),
      },
    });

    job.log(`Discovery complete: ${totalNew} new leads, ${totalExcluded} excluded`);

    return { totalFound, totalNew, totalExcluded };
  } catch (error) {
    // Mark run as failed
    await prisma.discoveryRun
      .update({
        where: { id: job.data.discoveryRunId },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      })
      .catch(() => {});

    throw error;
  }
}

export function isExcluded(
  person: ApolloPerson,
  excludedDomains: Set<string>,
  excludedEmails: Set<string>,
  excludedCompanies: Set<string>,
  existingApolloIds: Set<string>,
  existingEmails: Set<string>
): boolean {
  // Check Apollo ID
  if (person.id && existingApolloIds.has(person.id)) return true;

  // Check email
  if (person.email && existingEmails.has(person.email.toLowerCase())) return true;
  if (person.email && excludedEmails.has(person.email.toLowerCase())) return true;

  // Check domain
  const domain = person.organization?.primary_domain?.toLowerCase();
  if (domain && excludedDomains.has(domain)) return true;

  // Check company name (fuzzy - lowercase contains)
  const companyName = person.organization?.name?.toLowerCase();
  if (companyName) {
    for (const excluded of excludedCompanies) {
      if (companyName.includes(excluded) || excluded.includes(companyName)) {
        return true;
      }
    }
  }

  return false;
}

export function createDiscoveryWorker() {
  const worker = new Worker<DiscoveryJobData>(
    "discovery",
    processDiscoveryJob,
    {
      connection: redis,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 10_000,
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[discovery] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[discovery] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

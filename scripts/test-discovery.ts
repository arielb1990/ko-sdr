import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { ApolloClient } from "../src/services/apollo";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const org = await prisma.organization.findFirst({
    select: { apolloApiKey: true, maxLeadsPerRun: true },
  });

  const icp = await prisma.icpConfig.findFirst();

  console.log("ICP config:", JSON.stringify(icp, null, 2));
  console.log("Max leads per run:", org?.maxLeadsPerRun);

  if (!org?.apolloApiKey || !icp) {
    console.log("Missing Apollo key or ICP config");
    await pool.end();
    return;
  }

  const apollo = new ApolloClient(org.apolloApiKey);
  const filters = apollo.icpToFilters({
    countries: icp.countries,
    employeeRanges: icp.employeeRanges,
    jobTitles: icp.jobTitles,
    industries: icp.industries,
    excludeIndustries: icp.excludeIndustries,
    keywords: icp.keywords,
  });

  console.log("\nTranslated filters:", JSON.stringify(filters, null, 2));

  console.log("\nCalling Apollo...");
  const response = await apollo.searchPeople(filters, 1, 5);
  console.log("Response keys:", Object.keys(response));
  console.log("Total entries:", response.total_entries ?? response.pagination?.total_entries);
  console.log("People count:", response.people?.length ?? 0);

  if (response.people?.length > 0) {
    console.log("\nFirst person:", JSON.stringify(response.people[0], null, 2));
  }

  await pool.end();
}

main().catch(console.error);

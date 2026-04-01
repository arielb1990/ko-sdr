import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  // Lead statuses
  const leads = await prisma.lead.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("Leads by status:", leads);

  // Check if Anthropic key is configured
  const org = await prisma.organization.findFirst({
    select: { anthropicApiKey: true },
  });
  console.log("\nAnthropic key configured:", org?.anthropicApiKey ? "YES (****" + org.anthropicApiKey.slice(-4) + ")" : "NO");

  // Check BullMQ queues - any stuck jobs?
  const { redis } = await import("../src/lib/redis");
  const researchWaiting = await redis.llen("bull:research:wait");
  const researchFailed = await redis.zcard("bull:research:failed");
  const scoringWaiting = await redis.llen("bull:scoring:wait");

  console.log("\nQueue status:");
  console.log("  research - waiting:", researchWaiting, "failed:", researchFailed);
  console.log("  scoring - waiting:", scoringWaiting);

  // Check a sample lead
  const sample = await prisma.lead.findFirst({
    orderBy: { createdAt: "desc" },
    include: { company: { select: { name: true, aiBrief: true, aiPainPoints: true } } },
  });
  console.log("\nLatest lead:", sample?.firstName, sample?.lastName, "- status:", sample?.status);
  console.log("  Company AI brief:", sample?.company.aiBrief ? "YES" : "NO");

  await redis.quit();
  await pool.end();
}

main().catch(console.error);

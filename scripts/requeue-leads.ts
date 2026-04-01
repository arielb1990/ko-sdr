import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { Queue } from "bullmq";
import IORedis from "ioredis";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const researchQueue = new Queue("research", { connection: redis });

  // Reset stuck leads back to DISCOVERED and re-enqueue
  const stuckLeads = await prisma.lead.findMany({
    where: { status: { in: ["RESEARCHING", "RESEARCHED", "SCORING"] } },
    select: { id: true, organizationId: true, firstName: true, lastName: true },
  });

  console.log(`Found ${stuckLeads.length} stuck leads, re-enqueueing...`);

  for (const lead of stuckLeads) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "DISCOVERED" },
    });

    await researchQueue.add("research", {
      leadId: lead.id,
      organizationId: lead.organizationId,
    });

    console.log(`  Re-enqueued: ${lead.firstName} ${lead.lastName}`);
  }

  // Clean failed jobs
  await researchQueue.clean(0, 100, "failed");
  console.log("Cleaned failed jobs from research queue");

  await redis.quit();
  await pool.end();
}

main().catch(console.error);

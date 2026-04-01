import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const id = "cmndocd2r0003r5f5xv4k9gao";

  console.log("Before update:");
  const before = await prisma.icpConfig.findUnique({ where: { id } });
  console.log("  keywords:", before?.keywords);
  console.log("  excludeIndustries:", before?.excludeIndustries);

  try {
    const updated = await prisma.icpConfig.update({
      where: { id },
      data: {
        keywords: ["test-keyword-1", "test-keyword-2"],
        excludeIndustries: ["Retail", "Banking"],
      },
    });

    console.log("\nAfter update:");
    console.log("  keywords:", updated.keywords);
    console.log("  excludeIndustries:", updated.excludeIndustries);
  } catch (err) {
    console.error("UPDATE FAILED:", err);
  }

  // Revert
  await prisma.icpConfig.update({
    where: { id },
    data: {
      keywords: before?.keywords,
      excludeIndustries: before?.excludeIndustries,
    },
  });
  console.log("\nReverted to original");

  await pool.end();
}

main().catch(console.error);

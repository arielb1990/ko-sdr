import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ExcelJS from "exceljs";

/**
 * Import exclusions from Excel/CSV.
 * Expected columns: type (DOMAIN|EMAIL|COMPANY_NAME), value, reason (optional)
 * Or a single column of values — auto-detects type:
 *   - Contains @ → EMAIL
 *   - Contains . and no spaces → DOMAIN
 *   - Otherwise → COMPANY_NAME
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".csv")) {
    const { Readable } = await import("stream");
    const stream = Readable.from(Buffer.from(arrayBuffer));
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(arrayBuffer as unknown as ExcelJS.Buffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return NextResponse.json({ error: "No worksheet found" }, { status: 400 });
  }

  // Detect columns from header row
  const headerRow = sheet.getRow(1);
  const headers = (headerRow.values as (string | undefined)[])
    .map((v) => v?.toString().toLowerCase().trim())
    .filter(Boolean);

  const hasTypeColumn = headers.includes("type") || headers.includes("tipo");
  const valueColIndex = headers.indexOf("value") + 1 || headers.indexOf("valor") + 1 || 1;
  const typeColIndex = hasTypeColumn
    ? (headers.indexOf("type") + 1 || headers.indexOf("tipo") + 1)
    : 0;
  const reasonColIndex = headers.indexOf("reason") + 1 || headers.indexOf("motivo") + 1 || headers.indexOf("razon") + 1;

  const orgId = session.user.organizationId;
  const rows: Array<{ type: string; value: string; reason: string | null }> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const rawValue = row.getCell(valueColIndex || 1).value?.toString().trim();
    if (!rawValue) return;

    const value = rawValue.toLowerCase();
    let type: string;

    if (typeColIndex) {
      const rawType = row.getCell(typeColIndex).value?.toString().trim().toUpperCase();
      type = rawType && ["DOMAIN", "EMAIL", "COMPANY_NAME"].includes(rawType)
        ? rawType
        : detectType(value);
    } else {
      type = detectType(value);
    }

    const reason = reasonColIndex
      ? row.getCell(reasonColIndex).value?.toString().trim() || null
      : null;

    rows.push({ type, value, reason });
  });

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      await prisma.exclusion.upsert({
        where: {
          organizationId_type_value: {
            organizationId: orgId,
            type: row.type as "DOMAIN" | "EMAIL" | "COMPANY_NAME",
            value: row.value,
          },
        },
        create: {
          organizationId: orgId,
          type: row.type as "DOMAIN" | "EMAIL" | "COMPANY_NAME",
          value: row.value,
          reason: row.reason,
          source: "excel_import",
        },
        update: {
          reason: row.reason || undefined,
        },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ imported, skipped, total: rows.length });
}

function detectType(value: string): string {
  if (value.includes("@")) return "EMAIL";
  if (value.includes(".") && !value.includes(" ")) return "DOMAIN";
  return "COMPANY_NAME";
}

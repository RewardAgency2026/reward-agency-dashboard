import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { suppliers, supplier_platform_fees, ad_accounts } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact_email: z.string().email("Invalid email").nullable().optional(),
});

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [allSuppliers, allFees, counts] = await Promise.all([
    db.select().from(suppliers).orderBy(desc(suppliers.created_at)),
    db.select().from(supplier_platform_fees),
    db
      .select({
        supplier_id: ad_accounts.supplier_id,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(ad_accounts)
      .groupBy(ad_accounts.supplier_id),
  ]);

  const feeMap = new Map<string, Record<string, number>>();
  for (const f of allFees) {
    if (!feeMap.has(f.supplier_id)) feeMap.set(f.supplier_id, {});
    feeMap.get(f.supplier_id)![f.platform] = parseFloat(f.fee_rate);
  }
  const countMap = new Map(counts.map((c) => [c.supplier_id, c.count]));

  return NextResponse.json(
    allSuppliers.map((s) => ({
      ...s,
      platform_fees: feeMap.get(s.id) ?? {},
      ad_accounts_count: countMap.get(s.id) ?? 0,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const [newSupplier] = await db
    .insert(suppliers)
    .values({ name: parsed.data.name, contact_email: parsed.data.contact_email ?? null })
    .returning();

  return NextResponse.json(newSupplier, { status: 201 });
}

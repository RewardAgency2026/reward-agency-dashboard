import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { suppliers, supplier_sub_accounts, supplier_platform_fees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "pinterest"] as const;

const platformFeesSchema = z.object({
  meta: z.number().min(0).max(100).optional(),
  google: z.number().min(0).max(100).optional(),
  tiktok: z.number().min(0).max(100).optional(),
  snapchat: z.number().min(0).max(100).optional(),
  pinterest: z.number().min(0).max(100).optional(),
}).optional();

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.enum(["active", "inactive"]).optional(),
  platform_fees: platformFeesSchema,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, params.id))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

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

  const { name, status = "active", platform_fees } = parsed.data;

  const [subAccount] = await db
    .insert(supplier_sub_accounts)
    .values({ supplier_id: params.id, name, status })
    .returning();

  // Insert platform fees for any provided value > 0
  const feeRows: { platform: string; fee_rate: string; supplier_sub_account_id: string; supplier_id: string }[] = [];
  if (platform_fees) {
    for (const p of PLATFORMS) {
      const rate = platform_fees[p];
      if (rate !== undefined && rate > 0) {
        feeRows.push({
          platform: p,
          fee_rate: String(rate),
          supplier_sub_account_id: subAccount.id,
          supplier_id: params.id,
        });
      }
    }
  }

  let fees: typeof supplier_platform_fees.$inferSelect[] = [];
  if (feeRows.length > 0) {
    fees = await db.insert(supplier_platform_fees).values(feeRows).returning();
  }

  return NextResponse.json({ ...subAccount, platform_fees: fees }, { status: 201 });
}

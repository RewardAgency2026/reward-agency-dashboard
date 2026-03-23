import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { supplier_sub_accounts, supplier_platform_fees } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "pinterest"] as const;

const platformFeesSchema = z.object({
  meta: z.number().min(0).max(100).optional(),
  google: z.number().min(0).max(100).optional(),
  tiktok: z.number().min(0).max(100).optional(),
  snapchat: z.number().min(0).max(100).optional(),
  pinterest: z.number().min(0).max(100).optional(),
}).optional();

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  platform_fees: platformFeesSchema,
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; subId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [subAccount] = await db
    .select()
    .from(supplier_sub_accounts)
    .where(and(
      eq(supplier_sub_accounts.id, params.subId),
      eq(supplier_sub_accounts.supplier_id, params.id)
    ))
    .limit(1);
  if (!subAccount) return NextResponse.json({ error: "Sub-account not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const { name, status, platform_fees } = parsed.data;

  // Update sub-account fields if provided
  let updated = subAccount;
  if (name !== undefined || status !== undefined) {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    const [u] = await db
      .update(supplier_sub_accounts)
      .set(updates)
      .where(eq(supplier_sub_accounts.id, params.subId))
      .returning();
    updated = u;
  }

  // Upsert platform fees if provided
  if (platform_fees) {
    for (const p of PLATFORMS) {
      const rate = platform_fees[p];
      if (rate !== undefined) {
        await db
          .insert(supplier_platform_fees)
          .values({
            supplier_sub_account_id: params.subId,
            supplier_id: params.id,
            platform: p,
            fee_rate: String(rate),
          })
          .onConflictDoUpdate({
            target: [supplier_platform_fees.supplier_sub_account_id, supplier_platform_fees.platform],
            set: { fee_rate: String(rate) },
          });
      }
    }
  }

  const fees = await db
    .select()
    .from(supplier_platform_fees)
    .where(eq(supplier_platform_fees.supplier_sub_account_id, params.subId));

  return NextResponse.json({ ...updated, platform_fees: fees });
}

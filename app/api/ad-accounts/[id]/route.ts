import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ad_accounts, clients, suppliers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  platform: z.enum(["meta", "google", "tiktok", "snapchat", "pinterest"]).optional(),
  account_id: z.string().min(1).optional(),
  account_name: z.string().min(1).optional(),
  supplier_id: z.string().uuid().optional(),
  top_up_fee_rate: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "paused", "closed"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({
      id: ad_accounts.id,
      platform: ad_accounts.platform,
      account_id: ad_accounts.account_id,
      account_name: ad_accounts.account_name,
      top_up_fee_rate: ad_accounts.top_up_fee_rate,
      status: ad_accounts.status,
      created_at: ad_accounts.created_at,
      client_id: ad_accounts.client_id,
      client_name: clients.name,
      client_code: clients.client_code,
      supplier_id: ad_accounts.supplier_id,
      supplier_name: suppliers.name,
    })
    .from(ad_accounts)
    .leftJoin(clients, eq(ad_accounts.client_id, clients.id))
    .leftJoin(suppliers, eq(ad_accounts.supplier_id, suppliers.id))
    .where(eq(ad_accounts.id, params.id))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.platform !== undefined) updates.platform = d.platform;
  if (d.account_id !== undefined) updates.account_id = d.account_id;
  if (d.account_name !== undefined) updates.account_name = d.account_name;
  if (d.supplier_id !== undefined) updates.supplier_id = d.supplier_id;
  if (d.top_up_fee_rate !== undefined) updates.top_up_fee_rate = String(d.top_up_fee_rate);
  if (d.status !== undefined) updates.status = d.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(ad_accounts)
    .set(updates)
    .where(eq(ad_accounts.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

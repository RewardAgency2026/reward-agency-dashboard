import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().min(1).optional(),
  commission_rate: z.number().min(0).max(100).optional(),
  billing_address: z.string().optional(),
  billing_vat: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [affiliate] = await db
    .select({
      id: affiliates.id,
      affiliate_code: affiliates.affiliate_code,
      name: affiliates.name,
      email: affiliates.email,
      company: affiliates.company,
      commission_rate: affiliates.commission_rate,
      referral_link: affiliates.referral_link,
      billing_address: affiliates.billing_address,
      billing_vat: affiliates.billing_vat,
      status: affiliates.status,
      created_at: affiliates.created_at,
      clients_count: sql<number>`(SELECT COUNT(*) FROM clients WHERE clients.affiliate_id = ${params.id}::uuid)`,
      commissions_paid: sql<string>`COALESCE((SELECT SUM(commission_amount) FROM affiliate_commissions WHERE affiliate_commissions.affiliate_id = ${affiliates.id} AND affiliate_commissions.status = 'paid'), 0)`,
    })
    .from(affiliates)
    .where(eq(affiliates.id, params.id))
    .limit(1);

  if (!affiliate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(affiliate);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [existing] = await db.select().from(affiliates).where(eq(affiliates.id, params.id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const data = parsed.data;

  // Duplicate email check if email is changing
  if (data.email && data.email !== existing.email) {
    const [dup] = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.email, data.email)).limit(1);
    if (dup) return NextResponse.json({ error: "Email already in use" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.company !== undefined) updateData.company = data.company;
  if (data.commission_rate !== undefined) updateData.commission_rate = String(data.commission_rate);
  if (data.billing_address !== undefined) updateData.billing_address = data.billing_address;
  if (data.billing_vat !== undefined) updateData.billing_vat = data.billing_vat;
  if (data.status !== undefined) updateData.status = data.status;

  const [updated] = await db.update(affiliates).set(updateData).where(eq(affiliates.id, params.id)).returning();

  await logAudit({
    userId: session.user.id,
    userName: session.user.name ?? "",
    action: "affiliate_updated",
    details: { affiliate_id: params.id, changes: updateData },
  });

  return NextResponse.json(updated);
}

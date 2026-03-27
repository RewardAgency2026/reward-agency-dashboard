import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  billing_address: z.string().optional(),
  billing_vat: z.string().optional(),
});

async function getAffiliate(affiliateId: string) {
  const [row] = await db
    .select({
      id: affiliates.id,
      affiliate_code: affiliates.affiliate_code,
      name: affiliates.name,
      email: affiliates.email,
      company: affiliates.company,
      billing_address: affiliates.billing_address,
      billing_vat: affiliates.billing_vat,
      commission_rate: affiliates.commission_rate,
      status: affiliates.status,
      created_at: affiliates.created_at,
    })
    .from(affiliates)
    .where(eq(affiliates.id, affiliateId))
    .limit(1);
  return row;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "affiliate") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const affiliate = await getAffiliate(session.user.id);
  if (!affiliate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(
    { ...affiliate, created_at: affiliate.created_at.toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "affiliate") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const { name, company, billing_address, billing_vat } = parsed.data;
  const updates: Record<string, string | undefined | null> = {};
  if (name !== undefined) updates.name = name;
  if (company !== undefined) updates.company = company;
  if (billing_address !== undefined) updates.billing_address = billing_address || null;
  if (billing_vat !== undefined) updates.billing_vat = billing_vat || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(affiliates)
    .set(updates)
    .where(eq(affiliates.id, session.user.id))
    .returning({
      id: affiliates.id,
      affiliate_code: affiliates.affiliate_code,
      name: affiliates.name,
      email: affiliates.email,
      company: affiliates.company,
      billing_address: affiliates.billing_address,
      billing_vat: affiliates.billing_vat,
      commission_rate: affiliates.commission_rate,
      status: affiliates.status,
      created_at: affiliates.created_at,
    });

  return NextResponse.json({ ...updated, created_at: updated.created_at.toISOString() });
}

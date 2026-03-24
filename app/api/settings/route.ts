import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { z } from "zod";

const patchSchema = z.object({
  agency_name: z.string().min(1).optional(),
  from_email: z.string().email().nullable().optional(),
  iban_usd: z.string().nullable().optional(),
  iban_eur: z.string().nullable().optional(),
  legal_mentions: z.string().nullable().optional(),
  agency_crypto_fee_rate: z.number().min(0).max(100).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.select().from(settings).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({
      agency_name: "Reward Agency",
      from_email: null,
      iban_usd: null,
      iban_eur: null,
      legal_mentions: null,
      agency_crypto_fee_rate: "0",
    });
  }

  return NextResponse.json(rows[0]);
}

export async function PATCH(req: NextRequest) {
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
  if (d.agency_name !== undefined) updates.agency_name = d.agency_name;
  if ("from_email" in d) updates.from_email = d.from_email ?? null;
  if ("iban_usd" in d) updates.iban_usd = d.iban_usd ?? null;
  if ("iban_eur" in d) updates.iban_eur = d.iban_eur ?? null;
  if ("legal_mentions" in d) updates.legal_mentions = d.legal_mentions ?? null;
  if (d.agency_crypto_fee_rate !== undefined) updates.agency_crypto_fee_rate = String(d.agency_crypto_fee_rate);
  updates.updated_at = new Date();

  // Check if row exists
  const existing = await db.select({ id: settings.id }).from(settings).limit(1);

  if (existing.length === 0) {
    const [inserted] = await db
      .insert(settings)
      .values({
        agency_name: (updates.agency_name as string) ?? "Reward Agency",
        from_email: (updates.from_email as string | null) ?? null,
        iban_usd: (updates.iban_usd as string | null) ?? null,
        iban_eur: (updates.iban_eur as string | null) ?? null,
        legal_mentions: (updates.legal_mentions as string | null) ?? null,
        agency_crypto_fee_rate: (updates.agency_crypto_fee_rate as string) ?? "0",
      })
      .returning();
    return NextResponse.json(inserted);
  }

  const [updated] = await db
    .update(settings)
    .set(updates)
    .returning();

  return NextResponse.json(updated);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { suppliers, supplier_payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const paymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.enum(["USD", "EUR", "USDT", "USDC"]).default("USD"),
  bank_fees: z.number().min(0).optional().default(0),
  bank_fees_note: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  status: z.enum(["pending", "paid"]).default("pending"),
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

  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;

  const [payment] = await db
    .insert(supplier_payments)
    .values({
      supplier_id: params.id,
      amount: String(d.amount),
      currency: d.currency,
      bank_fees: String(d.bank_fees),
      bank_fees_note: d.bank_fees_note ?? null,
      payment_method: d.payment_method ?? null,
      reference: d.reference ?? null,
      status: d.status,
      paid_at: d.status === "paid" ? new Date() : null,
      created_by: session.user.id,
    })
    .returning();

  return NextResponse.json(payment, { status: 201 });
}

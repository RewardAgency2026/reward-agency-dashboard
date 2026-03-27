import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions, affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendCommissionPaid } from "@/lib/email";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

const bodySchema = z.object({
  reference: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }
  const parsed = bodySchema.safeParse(body);
  const reference = parsed.success ? (parsed.data.reference ?? null) : null;

  const [existing] = await db
    .select()
    .from(affiliate_commissions)
    .where(eq(affiliate_commissions.id, params.id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "preview") {
    return NextResponse.json({ error: "Commission must be approved before marking as paid" }, { status: 400 });
  }
  if (existing.status === "pending_approval") {
    return NextResponse.json({ error: "Commission must be approved before marking as paid" }, { status: 400 });
  }
  if (existing.status === "paid") {
    return NextResponse.json({ error: "Already marked as paid" }, { status: 400 });
  }

  const [updated] = await db
    .update(affiliate_commissions)
    .set({ status: "paid", paid_at: new Date(), paid_reference: reference })
    .where(eq(affiliate_commissions.id, params.id))
    .returning();

  // Send email to affiliate
  const [affiliate] = await db
    .select({ name: affiliates.name, email: affiliates.email })
    .from(affiliates)
    .where(eq(affiliates.id, existing.affiliate_id))
    .limit(1);

  if (affiliate) {
    const monthLabel = `${MONTH_NAMES[existing.period_month - 1]} ${existing.period_year}`;
    await sendCommissionPaid({
      to: affiliate.email,
      affiliateName: affiliate.name,
      monthLabel,
      amount: parseFloat(existing.commission_amount).toFixed(2),
      reference,
    }).catch((e) => console.error("[mark-paid] email failed:", e));
  }

  return NextResponse.json(updated);
}

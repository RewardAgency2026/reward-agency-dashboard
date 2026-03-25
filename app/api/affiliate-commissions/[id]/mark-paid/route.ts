import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [existing] = await db
    .select()
    .from(affiliate_commissions)
    .where(eq(affiliate_commissions.id, params.id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status === "paid") return NextResponse.json({ error: "Already marked as paid" }, { status: 400 });

  const [updated] = await db
    .update(affiliate_commissions)
    .set({ status: "paid", paid_at: new Date() })
    .where(eq(affiliate_commissions.id, params.id))
    .returning();

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();

  const updated = await db
    .update(affiliate_commissions)
    .set({
      status: "approved",
      approved_at: now,
      approved_by: session.user.id,
    })
    .where(eq(affiliate_commissions.status, "pending_approval"))
    .returning({ id: affiliate_commissions.id });

  return NextResponse.json({ ok: true, approved: updated.length });
}

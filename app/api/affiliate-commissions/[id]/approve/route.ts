import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
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
  if (existing.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot approve: record has status '${existing.status}'. Only pending_approval records can be approved.` },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(affiliate_commissions)
    .set({
      status: "approved",
      approved_at: new Date(),
      approved_by: session.user.id,
    })
    .where(eq(affiliate_commissions.id, params.id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Reject (send back to preview) — admin only
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [existing] = await db
    .select()
    .from(affiliate_commissions)
    .where(eq(affiliate_commissions.id, params.id))
    .limit(1);

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot reject: record has status '${existing.status}'.` },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(affiliate_commissions)
    .set({ status: "preview", approved_at: null, approved_by: null })
    .where(eq(affiliate_commissions.id, params.id))
    .returning();

  return NextResponse.json(updated);
}

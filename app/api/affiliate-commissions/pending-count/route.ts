import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(affiliate_commissions)
    .where(eq(affiliate_commissions.status, "pending_approval"));

  return NextResponse.json({ count: row?.count ?? 0 });
}

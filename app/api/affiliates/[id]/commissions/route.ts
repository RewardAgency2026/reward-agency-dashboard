import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(affiliate_commissions)
    .where(eq(affiliate_commissions.affiliate_id, params.id))
    .orderBy(desc(affiliate_commissions.period_year), desc(affiliate_commissions.period_month));

  return NextResponse.json(rows);
}

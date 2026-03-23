import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests } from "@/db/schema";
import { inArray, sql } from "drizzle-orm";

/** Lightweight count of actionable requests (pending + approved + insufficient_funds) */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(topup_requests)
    .where(inArray(topup_requests.status, ["pending", "approved", "insufficient_funds"]));

  return NextResponse.json({ count: row?.count ?? 0 });
}

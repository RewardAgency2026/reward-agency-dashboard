import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({ id: affiliates.id, name: affiliates.name, affiliate_code: affiliates.affiliate_code })
    .from(affiliates)
    .where(eq(affiliates.status, "active"))
    .orderBy(affiliates.name);

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

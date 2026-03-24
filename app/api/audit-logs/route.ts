import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { audit_logs } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await db
    .select()
    .from(audit_logs)
    .orderBy(desc(audit_logs.created_at))
    .limit(500);

  return NextResponse.json(logs, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

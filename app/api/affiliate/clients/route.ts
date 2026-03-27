import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "affiliate") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: clients.id,
      client_code: clients.client_code,
      name: clients.name,
      company: clients.company,
      status: clients.status,
      onboarding_source: clients.onboarding_source,
      created_at: clients.created_at,
    })
    .from(clients)
    .where(eq(clients.affiliate_id, session.user.id))
    .orderBy(desc(clients.created_at));

  return NextResponse.json(
    rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() })),
    { headers: { "Cache-Control": "no-store" } }
  );
}

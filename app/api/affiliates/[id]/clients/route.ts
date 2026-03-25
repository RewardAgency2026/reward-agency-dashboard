import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: clients.id,
      client_code: clients.client_code,
      name: clients.name,
      email: clients.email,
      company: clients.company,
      status: clients.status,
      billing_currency: clients.billing_currency,
      created_at: clients.created_at,
    })
    .from(clients)
    .where(eq(clients.affiliate_id, params.id))
    .orderBy(desc(clients.created_at));

  return NextResponse.json(rows);
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ad_accounts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = session.user.id;

  const accounts = await db
    .select({
      id: ad_accounts.id,
      platform: ad_accounts.platform,
      account_id: ad_accounts.account_id,
      account_name: ad_accounts.account_name,
      status: ad_accounts.status,
      created_at: ad_accounts.created_at,
    })
    .from(ad_accounts)
    .where(eq(ad_accounts.client_id, clientId));

  return NextResponse.json(
    accounts.map((a) => ({ ...a, created_at: a.created_at.toISOString() }))
  );
}

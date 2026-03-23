import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { calculateWalletBalance } from "@/lib/balance";

const withdrawSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  type: z.enum(["withdraw", "refund"]),
  description: z.string().optional().default(""),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!["admin", "team"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const { amount, type, description } = parsed.data;

  const [client] = await db
    .select({ id: clients.id, balance_model: clients.balance_model })
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const [txn] = await db
    .insert(transactions)
    .values({
      client_id: params.id,
      type,
      amount: String(amount),
      currency: "USD",
      description: description || null,
      created_by: session.user.id,
    })
    .returning();

  const wallet_balance = await calculateWalletBalance(client.id, client.balance_model);

  return NextResponse.json({ transaction: txn, wallet_balance }, { status: 201 });
}

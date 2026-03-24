import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

const rejectSchema = z.object({
  notes: z.string().nullable().optional(),
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

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const parsed = rejectSchema.safeParse(body);
  const notes = parsed.success ? parsed.data.notes : undefined;

  const [request] = await db
    .select({
      id: topup_requests.id,
      status: topup_requests.status,
      client_id: topup_requests.client_id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
    })
    .from(topup_requests)
    .where(eq(topup_requests.id, params.id))
    .limit(1);

  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (request.status === "executed") return NextResponse.json({ error: "Cannot reject an executed request" }, { status: 409 });
  if (request.status === "rejected") return NextResponse.json({ error: "Already rejected" }, { status: 409 });

  const updateValues: Record<string, unknown> = { status: "rejected" };
  if (notes !== undefined && notes !== null) updateValues.notes = notes;

  const [updated] = await db
    .update(topup_requests)
    .set(updateValues)
    .where(eq(topup_requests.id, params.id))
    .returning();

  // Audit log (fire-and-forget)
  db.select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, request.client_id))
    .limit(1)
    .then(([c]) => {
      logAudit({
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? "Unknown",
        action: "topup_rejected",
        details: {
          topup_request_id: params.id,
          client_id: request.client_id,
          client_name: c?.name ?? null,
          amount: request.amount,
          currency: request.currency,
        },
      });
    })
    .catch(() => {});

  return NextResponse.json(updated);
}

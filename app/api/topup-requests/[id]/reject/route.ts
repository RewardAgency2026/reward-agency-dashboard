import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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
    .select({ id: topup_requests.id, status: topup_requests.status })
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

  return NextResponse.json(updated);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { executeTopup } from "@/lib/services/topup";

const executeSchema = z.object({
  force: z.boolean().optional().default(false),
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
  const parsed = executeSchema.safeParse(body);
  const force = parsed.success ? parsed.data.force : false;

  try {
    const result = await executeTopup({
      topupRequestId: params.id,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "Unknown",
      force,
    });
    return NextResponse.json(result);
  } catch (err) {
    const e = err as Error & { status?: number; wallet_balance?: number };
    const status = e.status ?? 500;
    const body = e.wallet_balance !== undefined
      ? { error: e.message, wallet_balance: e.wallet_balance }
      : { error: e.message };
    return NextResponse.json(body, { status });
  }
}

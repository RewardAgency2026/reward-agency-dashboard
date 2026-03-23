import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { suppliers, supplier_platform_fees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const feeSchema = z.object({
  platform: z.enum(["meta", "google", "tiktok", "snapchat", "pinterest"]),
  fee_rate: z.number().min(0).max(100),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [supplier] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, params.id))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const { platform, fee_rate } = parsed.data;

  const [fee] = await db
    .insert(supplier_platform_fees)
    .values({ supplier_id: params.id, platform, fee_rate: String(fee_rate) })
    .onConflictDoUpdate({
      target: [supplier_platform_fees.supplier_id, supplier_platform_fees.platform],
      set: { fee_rate: String(fee_rate) },
    })
    .returning();

  return NextResponse.json(fee);
}

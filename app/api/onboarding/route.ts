import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { clients, affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generateClientCode } from "@/lib/client-code";
import { logAudit } from "@/lib/audit";
import { sendClientOnboardingWelcome } from "@/lib/email";

const OnboardingSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  password: z.string().min(8),
  affiliate_code: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const data = parsed.data;

  // Duplicate email check
  const [existing] = await db.select({ id: clients.id }).from(clients).where(eq(clients.email, data.email)).limit(1);
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

  // Resolve affiliate if affiliate_code provided
  let affiliateId: string | null = null;
  if (data.affiliate_code) {
    const [affiliate] = await db
      .select({ id: affiliates.id })
      .from(affiliates)
      .where(eq(affiliates.affiliate_code, data.affiliate_code))
      .limit(1);
    if (affiliate) affiliateId = affiliate.id;
  }

  const clientCode = await generateClientCode();
  const passwordHash = await bcrypt.hash(data.password, 12);

  const [client] = await db.insert(clients).values({
    client_code: clientCode,
    name: data.name,
    email: data.email,
    company: data.company,
    balance_model: "classic",
    billing_currency: "USD",
    status: "active",
    onboarding_source: affiliateId ? "affiliate_link" : "manual",
    affiliate_id: affiliateId ?? undefined,
    password_hash: passwordHash,
  }).returning();

  await logAudit({
    userId: "system",
    userName: "System",
    action: "client_onboarded",
    details: {
      client_id: client.id,
      client_code: client.client_code,
      name: client.name,
      email: client.email,
      affiliate_id: affiliateId,
    },
  });

  sendClientOnboardingWelcome({ to: client.email, name: client.name, clientCode: client.client_code, password: data.password }).catch(() => {});

  return NextResponse.json({
    id: client.id,
    client_code: client.client_code,
    name: client.name,
    email: client.email,
  }, { status: 201 });
}

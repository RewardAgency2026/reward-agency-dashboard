import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliates, clients, affiliate_commissions } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { generateAffiliateCode } from "@/lib/affiliate-code";
import { logAudit } from "@/lib/audit";
import { sendAffiliateOnboardingWelcome } from "@/lib/email";

const CreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  commission_rate: z.number().min(0).max(100),
  billing_address: z.string().optional(),
  billing_vat: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const minimal = searchParams.get("minimal") === "true";

  if (minimal) {
    // For dropdowns — only active affiliates
    const rows = await db
      .select({ id: affiliates.id, name: affiliates.name, affiliate_code: affiliates.affiliate_code })
      .from(affiliates)
      .where(eq(affiliates.status, "active"))
      .orderBy(affiliates.name);
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  }

  // Full list — run 3 queries in parallel instead of N+1 correlated subqueries
  const [rows, clientCounts, commissionTotals] = await Promise.all([
    db
      .select({
        id: affiliates.id,
        affiliate_code: affiliates.affiliate_code,
        name: affiliates.name,
        email: affiliates.email,
        company: affiliates.company,
        commission_rate: affiliates.commission_rate,
        referral_link: affiliates.referral_link,
        status: affiliates.status,
        created_at: affiliates.created_at,
      })
      .from(affiliates)
      .orderBy(desc(affiliates.created_at)),
    db
      .select({ affiliate_id: clients.affiliate_id, count: sql<number>`COUNT(*)::int` })
      .from(clients)
      .groupBy(clients.affiliate_id),
    db
      .select({ affiliate_id: affiliate_commissions.affiliate_id, total: sql<string>`COALESCE(SUM(commission_amount), 0)` })
      .from(affiliate_commissions)
      .where(eq(affiliate_commissions.status, "paid"))
      .groupBy(affiliate_commissions.affiliate_id),
  ]);

  const clientCountMap = new Map(clientCounts.map((r) => [r.affiliate_id, r.count]));
  const commissionMap = new Map(commissionTotals.map((r) => [r.affiliate_id, r.total]));

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      clients_count: clientCountMap.get(r.id) ?? 0,
      commissions_paid: commissionMap.get(r.id) ?? "0",
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const data = parsed.data;

  // Duplicate email check
  const [existing] = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.email, data.email)).limit(1);
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

  const affiliateCode = await generateAffiliateCode();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const referralLink = `${appUrl}/onboarding?ref=${affiliateCode}`;

  const [affiliate] = await db.insert(affiliates).values({
    affiliate_code: affiliateCode,
    name: data.name,
    email: data.email,
    company: data.company,
    commission_rate: String(data.commission_rate),
    billing_address: data.billing_address,
    billing_vat: data.billing_vat,
    referral_link: referralLink,
    status: "active",
  }).returning();

  await logAudit({
    userId: session.user.id,
    userName: session.user.name ?? "",
    action: "affiliate_created",
    details: { affiliate_id: affiliate.id, name: affiliate.name, email: affiliate.email },
  });

  // Send welcome email (fire-and-forget)
  sendAffiliateOnboardingWelcome({
    to: affiliate.email,
    name: affiliate.name,
    affiliateCode: affiliate.affiliate_code,
    referralLink: referralLink,
  }).catch(() => {});

  return NextResponse.json(affiliate, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affiliate_commissions, affiliates, users } from "@/db/schema";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { sendCommissionReviewRequired } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Previous month
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  // Find all preview records for the previous month with commission > 0
  const previewRows = await db
    .select({
      id: affiliate_commissions.id,
      affiliate_id: affiliate_commissions.affiliate_id,
      commission_amount: affiliate_commissions.commission_amount,
    })
    .from(affiliate_commissions)
    .where(
      and(
        eq(affiliate_commissions.status, "preview"),
        eq(affiliate_commissions.period_year, prevYear),
        eq(affiliate_commissions.period_month, prevMonth),
        sql`${affiliate_commissions.commission_amount}::numeric > 0`
      )
    );

  if (previewRows.length === 0) {
    return NextResponse.json({ ok: true, finalized: 0, month: `${prevYear}-${prevMonth}` });
  }

  // Bulk update: preview → pending_approval, set calculated_at = now
  const ids = previewRows.map((r) => r.id);
  await db
    .update(affiliate_commissions)
    .set({ status: "pending_approval", calculated_at: now })
    .where(
      and(
        eq(affiliate_commissions.status, "preview"),
        eq(affiliate_commissions.period_year, prevYear),
        eq(affiliate_commissions.period_month, prevMonth),
        sql`${affiliate_commissions.commission_amount}::numeric > 0`
      )
    );

  // Fetch affiliate names for email
  const affiliateIds = [...new Set(previewRows.map((r) => r.affiliate_id))];
  const affiliateNames = await Promise.all(
    affiliateIds.map((id) =>
      db
        .select({ id: affiliates.id, name: affiliates.name })
        .from(affiliates)
        .where(eq(affiliates.id, id))
        .limit(1)
        .then(([r]) => r)
    )
  );
  const nameMap = new Map(affiliateNames.filter(Boolean).map((a) => [a.id, a.name]));

  const items = previewRows.map((r) => ({
    name: nameMap.get(r.affiliate_id) ?? r.affiliate_id,
    amount: parseFloat(r.commission_amount).toFixed(2),
  }));

  // Get all admin user emails
  const adminUsers = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "admin"));

  const adminEmails = adminUsers.map((u) => u.email);

  const monthLabel = new Date(prevYear, prevMonth - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (adminEmails.length > 0) {
    await sendCommissionReviewRequired({
      to: adminEmails,
      monthLabel,
      pendingCount: previewRows.length,
      items,
    });
  }

  return NextResponse.json({
    ok: true,
    finalized: previewRows.length,
    month: `${prevYear}-${prevMonth}`,
    notified: adminEmails,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affiliate_commissions, affiliates, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendCommissionReminder } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all pending_approval commissions
  const pendingRows = await db
    .select({
      id: affiliate_commissions.id,
      affiliate_id: affiliate_commissions.affiliate_id,
      commission_amount: affiliate_commissions.commission_amount,
      calculated_at: affiliate_commissions.calculated_at, // set when moved to pending_approval
    })
    .from(affiliate_commissions)
    .where(eq(affiliate_commissions.status, "pending_approval"));

  if (pendingRows.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 });
  }

  // Calculate days pending for each
  const now = new Date();
  const itemsWithDays = pendingRows.map((r) => {
    const pendingSince = r.calculated_at ? new Date(r.calculated_at) : now;
    const daysPending = Math.floor((now.getTime() - pendingSince.getTime()) / (1000 * 60 * 60 * 24));
    return { ...r, daysPending };
  });

  // Fetch affiliate names
  const affiliateIds = [...new Set(pendingRows.map((r) => r.affiliate_id))];
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

  const maxDaysPending = Math.max(...itemsWithDays.map((r) => r.daysPending));

  const items = itemsWithDays.map((r) => ({
    name: nameMap.get(r.affiliate_id) ?? r.affiliate_id,
    amount: parseFloat(r.commission_amount).toFixed(2),
    daysPending: r.daysPending,
  }));

  // Get all admin emails
  const adminUsers = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "admin"));

  const adminEmails = adminUsers.map((u) => u.email);

  if (adminEmails.length > 0) {
    await sendCommissionReminder({
      to: adminEmails,
      pendingCount: pendingRows.length,
      maxDaysPending,
      items,
    });
  }

  return NextResponse.json({
    ok: true,
    reminded: pendingRows.length,
    maxDaysPending,
    notified: adminEmails,
  });
}

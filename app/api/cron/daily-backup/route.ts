import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, clients, ad_accounts, topup_requests, suppliers, users as usersTable } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Resend } from "resend";
import { calculateWalletBalances, balanceFromData } from "@/lib/balance";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ].join("\n");
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Vercel sends: Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const backupEmail = process.env.BACKUP_EMAIL;

  if (!backupEmail) {
    console.error("[backup] BACKUP_EMAIL env var not set");
    return NextResponse.json({ error: "BACKUP_EMAIL not configured" }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0]!; // YYYY-MM-DD

  // ── Report 1: All Transactions ─────────────────────────────────────────────
  const txnRows = await db
    .select({
      created_at: transactions.created_at,
      client_code: clients.client_code,
      client_name: clients.name,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      description: transactions.description,
      ad_account_name: ad_accounts.account_name,
      platform: ad_accounts.platform,
      created_by_name: usersTable.name,
      is_crypto: transactions.is_crypto,
      crypto_fee_amount: transactions.crypto_fee_amount,
      supplier_fee_amount: transactions.supplier_fee_amount,
      top_up_fee_amount: transactions.top_up_fee_amount,
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.client_id, clients.id))
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .leftJoin(usersTable, eq(transactions.created_by, usersTable.id))
    .orderBy(desc(transactions.created_at));

  const txnCsv = toCsv(
    ["Date", "Client Code", "Client Name", "Type", "Amount", "Currency", "Description", "Ad Account", "Platform", "Created By", "Is Crypto", "Crypto Fee Amount", "Supplier Fee Amount", "Commission Fee Amount"],
    txnRows.map((r) => [
      r.created_at.toISOString(),
      r.client_code,
      r.client_name,
      r.type,
      r.amount,
      r.currency,
      r.description,
      r.ad_account_name,
      r.platform,
      r.created_by_name,
      r.is_crypto ? "Yes" : "No",
      r.crypto_fee_amount,
      r.supplier_fee_amount,
      r.top_up_fee_amount,
    ])
  );

  // ── Report 2: Client Balances ──────────────────────────────────────────────
  const allClients = await db
    .select({
      id: clients.id,
      client_code: clients.client_code,
      name: clients.name,
      company: clients.company,
      balance_model: clients.balance_model,
      billing_currency: clients.billing_currency,
      status: clients.status,
    })
    .from(clients)
    .orderBy(clients.client_code);

  const clientIds = allClients.map((c) => c.id);
  const balanceMap = await calculateWalletBalances(clientIds);

  // Get last transaction date per client
  const lastTxnRows = await db
    .select({ client_id: transactions.client_id, last_at: transactions.created_at })
    .from(transactions)
    .orderBy(desc(transactions.created_at));

  const lastTxnMap = new Map<string, string>();
  for (const r of lastTxnRows) {
    if (!lastTxnMap.has(r.client_id)) {
      lastTxnMap.set(r.client_id, r.last_at.toISOString());
    }
  }

  const balancesCsv = toCsv(
    ["Client Code", "Client Name", "Company", "Balance Model", "Wallet Balance", "Currency", "Status", "Last Transaction Date"],
    allClients.map((c) => {
      const bal = balanceFromData(balanceMap.get(c.id), c.balance_model);
      return [
        c.client_code,
        c.name,
        c.company,
        c.balance_model,
        bal.toFixed(2),
        c.billing_currency,
        c.status,
        lastTxnMap.get(c.id) ?? "",
      ];
    })
  );

  // ── Report 3: Top Ups Summary ──────────────────────────────────────────────
  const executedByAlias = usersTable;

  const topupRows = await db
    .select({
      created_at: topup_requests.created_at,
      client_code: clients.client_code,
      client_name: clients.name,
      ad_account_name: ad_accounts.account_name,
      platform: ad_accounts.platform,
      supplier_name: suppliers.name,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
      // Fee amounts from the linked topup transaction (populated after FIX C1/C2 migration)
      top_up_fee_amount: transactions.top_up_fee_amount,
      supplier_fee_amount: transactions.supplier_fee_amount,
      status: topup_requests.status,
      executed_by_name: executedByAlias.name,
    })
    .from(topup_requests)
    .leftJoin(clients, eq(topup_requests.client_id, clients.id))
    .leftJoin(ad_accounts, eq(topup_requests.ad_account_id, ad_accounts.id))
    .leftJoin(suppliers, eq(topup_requests.supplier_id, suppliers.id))
    .leftJoin(
      transactions,
      and(
        eq(transactions.topup_request_id, topup_requests.id),
        eq(transactions.type, "topup")
      )
    )
    .leftJoin(executedByAlias, eq(topup_requests.executed_by, executedByAlias.id))
    .orderBy(desc(topup_requests.created_at));

  const topupsCsv = toCsv(
    ["Date", "Client Code", "Client Name", "Ad Account", "Platform", "Supplier", "Amount", "Currency", "Commission", "Provider Fee", "Gross Margin", "Status", "Executed By"],
    topupRows.map((r) => {
      const commission = parseFloat(r.top_up_fee_amount ?? "0");
      const providerFee = parseFloat(r.supplier_fee_amount ?? "0");
      const grossMargin = commission - providerFee;
      return [
        r.created_at.toISOString(),
        r.client_code,
        r.client_name,
        r.ad_account_name,
        r.platform,
        r.supplier_name,
        r.amount,
        r.currency,
        commission > 0 ? commission.toFixed(2) : "",
        providerFee > 0 ? providerFee.toFixed(2) : "",
        commission > 0 || providerFee > 0 ? grossMargin.toFixed(2) : "",
        r.status,
        r.executed_by_name,
      ];
    })
  );

  // ── Send email ─────────────────────────────────────────────────────────────
  const summary = `Daily financial backup — ${txnRows.length} transactions, ${allClients.length} clients, ${topupRows.length} top ups`;

  if (!resend) {
    // Log to console when Resend is not configured (development)
    console.log(`[backup] ${summary}`);
    console.log("[backup] RESEND_API_KEY not configured — skipping email");
    return NextResponse.json({ ok: true, dry_run: true, summary, date: today });
  }

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "backups@reward-agency.com",
      to: backupEmail,
      subject: `Reward Agency — Daily Backup ${today}`,
      html: `<p style="font-family:sans-serif;font-size:14px;">${summary}</p><p style="font-family:sans-serif;font-size:12px;color:#6b7280;">3 CSV files attached: transactions, client balances, top-ups.</p>`,
      attachments: [
        {
          filename: `transactions_${today}.csv`,
          content: Buffer.from(txnCsv, "utf-8"),
        },
        {
          filename: `balances_${today}.csv`,
          content: Buffer.from(balancesCsv, "utf-8"),
        },
        {
          filename: `topups_${today}.csv`,
          content: Buffer.from(topupsCsv, "utf-8"),
        },
      ],
    });
  } catch (err) {
    console.error("[backup] Failed to send backup email:", err);
    return NextResponse.json({ error: "Failed to send backup email" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    date: today,
    transactions: txnRows.length,
    clients: allClients.length,
    topups: topupRows.length,
  });
}

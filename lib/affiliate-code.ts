import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function generateAffiliateCode(): Promise<string> {
  const [row] = await db.select({
    max_num: sql<number>`COALESCE(MAX(CAST(SUBSTRING(affiliate_code, 5) AS INTEGER)), 0)`,
  }).from(affiliates);
  const next = (row?.max_num ?? 0) + 1;
  return `AFF-${String(next).padStart(4, "0")}`;
}

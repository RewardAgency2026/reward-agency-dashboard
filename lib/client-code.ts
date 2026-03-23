import { db } from "@/db";
import { clients } from "@/db/schema";
import { sql } from "drizzle-orm";

/** Generate the next RWD-XXXX client code based on current max */
export async function generateClientCode(): Promise<string> {
  const [row] = await db
    .select({
      max_num: sql<number>`COALESCE(MAX(CAST(SUBSTRING(client_code, 5) AS INTEGER)), 0)`,
    })
    .from(clients);

  const next = (row?.max_num ?? 0) + 1;
  return `RWD-${String(next).padStart(4, "0")}`;
}

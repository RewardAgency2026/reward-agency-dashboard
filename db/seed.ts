import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // Hash passwords
  const [adminHash, teamHash, accountantHash, affiliateHash] = await Promise.all([
    bcrypt.hash("Admin2026!", 12),
    bcrypt.hash("Team2026!", 12),
    bcrypt.hash("Accountant2026!", 12),
    bcrypt.hash("Affiliate2026!", 12),
  ]);

  // Agency users
  await db
    .insert(schema.users)
    .values([
      { email: "admin@reward-agency.com", name: "Marc", password_hash: adminHash, role: "admin" },
      { email: "team@reward-agency.com", name: "Sophie", password_hash: teamHash, role: "team" },
      { email: "accountant@reward-agency.com", name: "Julien", password_hash: accountantHash, role: "accountant" },
    ])
    .onConflictDoNothing();

  console.log("✅ Agency users seeded");

  // Test affiliate user
  await db
    .insert(schema.affiliates)
    .values({
      affiliate_code: "AFF-0001",
      name: "Alice Affiliate",
      email: "affiliate@reward-agency.com",
      company: "Alice Media",
      commission_rate: "10.00",
      password_hash: affiliateHash,
      status: "active",
    })
    .onConflictDoNothing();

  console.log("✅ Test affiliate seeded (affiliate@reward-agency.com / Affiliate2026!)");

  // Default settings
  await db
    .insert(schema.settings)
    .values({ agency_name: "Reward Agency", agency_crypto_fee_rate: "0" })
    .onConflictDoNothing();

  console.log("✅ Settings seeded");
  console.log("🎉 Done!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

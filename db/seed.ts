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
  const [adminHash, teamHash, accountantHash] = await Promise.all([
    bcrypt.hash("Admin2026!", 12),
    bcrypt.hash("Team2026!", 12),
    bcrypt.hash("Accountant2026!", 12),
  ]);

  // Insert agency users (upsert on email conflict)
  await db
    .insert(schema.users)
    .values([
      {
        email: "admin@reward-agency.com",
        name: "Marc",
        password_hash: adminHash,
        role: "admin",
      },
      {
        email: "team@reward-agency.com",
        name: "Sophie",
        password_hash: teamHash,
        role: "team",
      },
      {
        email: "accountant@reward-agency.com",
        name: "Julien",
        password_hash: accountantHash,
        role: "accountant",
      },
    ])
    .onConflictDoNothing();

  console.log("✅ Users seeded");

  // Insert default settings row
  await db
    .insert(schema.settings)
    .values({
      agency_name: "Reward Agency",
      agency_crypto_fee_rate: "0",
    })
    .onConflictDoNothing();

  console.log("✅ Settings seeded");
  console.log("🎉 Done!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

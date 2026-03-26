import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, users, password_reset_tokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";

// GET — validate token (used on page load)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ valid: false, error: "Missing token" }, { status: 400 });
  }

  const [record] = await db
    .select()
    .from(password_reset_tokens)
    .where(eq(password_reset_tokens.token, token))
    .limit(1);

  if (!record) {
    return NextResponse.json({ valid: false, error: "Invalid or expired link" }, { status: 400 });
  }

  if (record.used) {
    return NextResponse.json({ valid: false, error: "This link has already been used" }, { status: 400 });
  }

  if (new Date() > record.expires_at) {
    return NextResponse.json({ valid: false, error: "This link has expired" }, { status: 400 });
  }

  return NextResponse.json({ valid: true, email: record.email });
}

const resetSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// POST — perform the actual password reset
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation error" }, { status: 400 });
  }

  const { token, newPassword } = parsed.data;

  const [record] = await db
    .select()
    .from(password_reset_tokens)
    .where(eq(password_reset_tokens.token, token))
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  if (record.used) {
    return NextResponse.json({ error: "This link has already been used" }, { status: 400 });
  }

  if (new Date() > record.expires_at) {
    return NextResponse.json({ error: "This link has expired" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { email } = record;

  // Update password in clients or users table
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);

  if (client) {
    await db.update(clients).set({ password_hash: passwordHash }).where(eq(clients.id, client.id));
  } else {
    const [agencyUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (agencyUser) {
      await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, agencyUser.id));
    }
  }

  // Mark token as used
  await db
    .update(password_reset_tokens)
    .set({ used: true })
    .where(eq(password_reset_tokens.id, record.id));

  return NextResponse.json({ success: true });
}

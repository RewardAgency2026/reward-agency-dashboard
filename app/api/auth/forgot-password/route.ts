import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients, users, password_reset_tokens } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { sendPasswordReset } from "@/lib/email";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const SUCCESS_RESPONSE = NextResponse.json({
  message: "If this email is registered, you will receive a reset link shortly.",
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Check if email belongs to a client or agency user
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.email, email))
    .limit(1);

  const [agencyUser] = !client
    ? await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    : [null];

  // If not found, return the same success message (don't reveal existence)
  if (!client && !agencyUser) {
    return SUCCESS_RESPONSE;
  }

  // Generate token and store it
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(password_reset_tokens).values({
    email,
    token,
    expires_at: expiresAt,
  });

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  await sendPasswordReset({ to: email, resetUrl });

  return SUCCESS_RESPONSE;
}

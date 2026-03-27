import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, affiliates, clients } from "@/db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        // 1. Agency user (admin / team / accountant)
        const [agencyUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (agencyUser) {
          const valid = await bcrypt.compare(password, agencyUser.password_hash);
          if (!valid) return null;
          return {
            id: agencyUser.id,
            email: agencyUser.email,
            name: agencyUser.name,
            role: agencyUser.role,
            userType: "agency" as const,
          };
        }

        // 2. Affiliate
        const [affiliate] = await db
          .select()
          .from(affiliates)
          .where(eq(affiliates.email, email))
          .limit(1);

        if (affiliate?.password_hash) {
          const valid = await bcrypt.compare(password, affiliate.password_hash);
          if (!valid) return null;
          return {
            id: affiliate.id,
            email: affiliate.email,
            name: affiliate.name,
            role: "affiliate",
            userType: "affiliate" as const,
          };
        }

        // 3. Client
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.email, email))
          .limit(1);

        if (client?.password_hash) {
          const valid = await bcrypt.compare(password, client.password_hash);
          if (!valid) return null;
          return {
            id: client.id,
            email: client.email,
            name: client.name,
            role: "client",
            userType: "client" as const,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? undefined;
        token.userType = (user as { userType?: string }).userType ?? "agency";
        // FIX C9: Per-user-type JWT expiry — agency 8h, clients/affiliates 24h
        const now = Math.floor(Date.now() / 1000);
        token.exp = now + (token.userType === "agency" ? 8 * 60 * 60 : 24 * 60 * 60);
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.userType = token.userType as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24h ceiling; per-user-type expiry set in JWT callback
  },
});

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, affiliates } from "@/db/schema";
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
  },
});

import { NextAuthOptions, getServerSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import type { SystemRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      systemRole: SystemRole;
    };
  }
  interface User {
    systemRole: SystemRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    systemRole: SystemRole;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Request offline access so Google issues a refresh_token, which the
            // Classroom import relies on for long-lived API access. Classroom/Drive
            // scopes are NOT requested here — they are granted on demand via an
            // incremental "Connect Google Classroom" sign-in (see src/lib/google.ts).
            authorization: {
              params: { access_type: "offline", prompt: "consent" },
            },
            // Link Google logins to an existing user by verified email. This lets
            // students imported as roster placeholders (passwordHash null) claim
            // their account on first Google sign-in instead of hitting
            // OAuthAccountNotLinked.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase();
        // Throttle password guessing per account. Returning null surfaces as a
        // normal "invalid credentials" error, so an attacker can't distinguish
        // a lockout from a wrong password.
        const limit = rateLimit(`login:${email}`, {
          limit: 10,
          windowMs: 5 * 60 * 1000,
        });
        if (!limit.ok) return null;
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user?.passwordHash || user.suspended) return null;
        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          systemRole: user.systemRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.systemRole = user.systemRole;
      }
      if (trigger === "update" && session?.systemRole) {
        token.systemRole = session.systemRole;
      }
      if (token.email && !token.systemRole) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, systemRole: true, suspended: true },
        });
        if (dbUser && !dbUser.suspended) {
          token.id = dbUser.id;
          token.systemRole = dbUser.systemRole;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.systemRole = token.systemRole;
      }
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

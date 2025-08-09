import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { comparePasswords } from "@/lib/password";

// Define enum types manually to avoid Prisma import issues
type UserRole = "MR" | "LEAD_MR" | "ADMIN";
type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username: string;
      role: UserRole;
      status: UserStatus;
      region?: {
        id: string;
        name: string;
      } | null;
      leadMr?: {
        id: string;
        name: string;
        username: string;
      } | null;
      phone: string | null;
      lastLoginAt: string;
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    username: string;
    role: UserRole;
    status: UserStatus;
    region?: {
      id: string;
      name: string;
    } | null;
    leadMr?: {
      id: string;
      name: string;
      username: string;
    } | null;
    phone: string | null;
    createdAt: string;
    lastLoginAt: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: UserRole;
    status: UserStatus;
    region?: {
      id: string;
      name: string;
    } | null;
    leadMr?: {
      id: string;
      name: string;
      username: string;
    } | null;
    phone: string | null;
    lastLoginAt: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: {
          label: "Username",
          type: "text",
          placeholder: "Enter your username",
        },
        password: {
          label: "Password",
          type: "password",
          placeholder: "Enter your password",
        },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) {
            throw new Error("Username and password are required");
          }

          // Find user by username
          const user = await prisma.user.findUnique({
            where: {
              username: credentials.username,
            },
            include: {
              region: {
                select: {
                  id: true,
                  name: true,
                },
              },
              leadMr: {
                select: {
                  id: true,
                  name: true,
                  username: true,
                },
              },
            },
          });

          if (!user) {
            throw new Error("Invalid username or password");
          }

          // Check if user is active
          if (user.status !== "ACTIVE") {
            throw new Error(
              "Account is inactive. Please contact your administrator."
            );
          }

          // Verify password
          const isPasswordValid = await comparePasswords(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            throw new Error("Invalid username or password");
          }

          // Update last login time
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          // Return user data for session
          return {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            region: user.region,
            leadMr: user.leadMr,
            phone: user.phone,
            createdAt: user.createdAt.toISOString(),
            lastLoginAt: new Date().toISOString(),
          };
        } catch (error) {
          console.error("Authentication error:", error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.status = user.status;
        token.region = user.region;
        token.leadMr = user.leadMr;
        token.phone = user.phone;
        token.lastLoginAt = user.lastLoginAt;
      }

      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.region = token.region;
        session.user.leadMr = token.leadMr;
        session.user.phone = token.phone;
        session.user.lastLoginAt = token.lastLoginAt;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async signIn({ user }) {
      console.log("User signed in:", {
        userId: user.id,
        username: user.username,
        role: user.role,
      });
    },
    async signOut({ session, token }) {
      console.log("User signed out:", {
        userId: token?.id || session?.user?.id,
      });
    },
  },
  debug: process.env.NODE_ENV === "development",
};

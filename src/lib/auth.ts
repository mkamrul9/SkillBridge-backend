import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

const defaultFrontendUrl = "https://skillbridge-frontend-phi.vercel.app";

// Debug: print effective auth cookie config at startup to help verify deployed settings
const _debugNodeEnv = process.env.NODE_ENV;
const _debugTrustedOrigins =
  process.env.TRUSTED_ORIGINS ||
  process.env.FRONTEND_URL ||
  process.env.APP_URL ||
  (process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : defaultFrontendUrl);

if (process.env.NODE_ENV !== "production") {
  console.log(
    `[AuthDebug] NODE_ENV=${_debugNodeEnv} TRUSTED_ORIGINS=${_debugTrustedOrigins}`,
  );
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  // Allow multiple trusted origins via TRUSTED_ORIGINS (comma-separated),
  // fallback to APP_URL, and include localhost in development for local testing.
  trustedOrigins: (() => {
    if (process.env.TRUSTED_ORIGINS) {
      return process.env.TRUSTED_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (process.env.FRONTEND_URL) return [process.env.FRONTEND_URL];
    if (process.env.APP_URL) return [process.env.APP_URL];
    if (process.env.NODE_ENV !== "production") return ["http://localhost:3000"];
    return [defaultFrontendUrl];
  })(),
  advanced: {
    useSecureCookies: true,
    redirectOnLogin:
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === "production"
        ? defaultFrontendUrl
        : process.env.APP_URL || "http://localhost:3000"),
  },
  session: {
    cookie: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-better-auth.session_token"
          : "better-auth.session_token",
      // Use Lax for same-site (proxy) or None for cross-site
      // If using Next.js proxy (recommended), use Lax for better security
      // If calling backend directly from different domain, use None
      sameSite: "none" as const, // Changed back to 'none' for OAuth compatibility
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // Don't set domain - let it default to the current domain
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "STUDENT",
        required: false,
      },
      phone: {
        type: "string",
        required: false,
      },
      status: {
        type: "string",
        defaultValue: "ACTIVE",
        required: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true, // Auto sign-in after successful signup
    requireEmailVerification: false, // Set to false - users auto-verified
  },
  emailVerification: {
    sendOnSignUp: false, // Do not send verification email on signup
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      prompt: "select_account consent",
      accessType: "offline",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirectURI: `${process.env.BETTER_AUTH_URL || "http://localhost:5000"}/api/auth/callback/google`,
    },
  },
});

//
// GOOGLE_CLIENT_ID
// GOOGLE_CLIENT_SECRET

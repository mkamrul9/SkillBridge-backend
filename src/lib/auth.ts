import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

const defaultFrontendUrl = "https://skillbridge-frontend-phi.vercel.app";
const localFrontendUrl = "http://localhost:3000";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

// Debug: print effective auth cookie config at startup to help verify deployed settings
const _debugNodeEnv = process.env.NODE_ENV;
const _debugTrustedOrigins =
  process.env.TRUSTED_ORIGINS ||
  process.env.FRONTEND_URL ||
  process.env.APP_URL ||
  (process.env.NODE_ENV !== "production"
    ? localFrontendUrl
    : defaultFrontendUrl);

const resolvedFrontendUrl = trimTrailingSlash(
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV !== "production" ? localFrontendUrl : defaultFrontendUrl),
);
const resolvedBackendUrl = trimTrailingSlash(
  process.env.BETTER_AUTH_URL || "http://localhost:5000",
);
const googleRedirectUri = trimTrailingSlash(
  process.env.GOOGLE_REDIRECT_URI || `${resolvedFrontendUrl}/api/auth/callback/google`,
);
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const facebookRedirectUri = trimTrailingSlash(
  process.env.FACEBOOK_REDIRECT_URI || `${resolvedFrontendUrl}/api/auth/callback/facebook`,
);

if (process.env.NODE_ENV !== "production") {
  console.log(
    `[AuthDebug] NODE_ENV=${_debugNodeEnv} TRUSTED_ORIGINS=${_debugTrustedOrigins}`,
  );
}

console.log(`[AuthDebug] Google redirect URI: ${googleRedirectUri}`);
console.log(
  `[AuthDebug] Google client ID: ${googleClientId ? `${googleClientId.slice(0, 16)}...` : "MISSING"}`,
);
if (!process.env.GOOGLE_REDIRECT_URI) {
  console.log("[AuthDebug] GOOGLE_REDIRECT_URI not set, using computed default");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: resolvedBackendUrl,
  // Allow multiple trusted origins via TRUSTED_ORIGINS (comma-separated),
  // fallback to APP_URL, and include localhost in development for local testing.
  trustedOrigins: (() => {
    const origins = new Set<string>();

    if (process.env.TRUSTED_ORIGINS) {
      process.env.TRUSTED_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((origin) => origins.add(origin));
    }

    origins.add(resolvedFrontendUrl);
    origins.add(defaultFrontendUrl);

    if (process.env.NODE_ENV !== "production") {
      origins.add(localFrontendUrl);
    }

    return Array.from(origins);
  })(),
  advanced: {
    useSecureCookies: true,
    redirectOnLogin:
      resolvedFrontendUrl,
  },
  session: {
    cookie: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-better-auth.session_token"
          : "better-auth.session_token",
      // OAuth now uses frontend-domain callback through Next.js proxy.
      sameSite: "lax" as const,
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
      redirectURI: googleRedirectUri,
    },
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? {
        facebook: {
          clientId: process.env.FACEBOOK_CLIENT_ID,
          clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          redirectURI: facebookRedirectUri,
        },
      }
      : {}),
  },
});

//
// GOOGLE_CLIENT_ID
// GOOGLE_CLIENT_SECRET

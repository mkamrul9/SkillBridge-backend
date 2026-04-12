import express, { Application } from "express";
import cors from "cors";
import { auth } from "./lib/auth";
import { toNodeHandler } from "better-auth/node";
import errorHandler from "./middlewares/globalErrorHandler";
import { notFound } from "./middlewares/notFound";

import tutorRoutes from "./modules/tutors/tutor.route";
import bookingRoutes from "./modules/bookings/booking.route";
import authRoutes from "./modules/auth/auth.route";

import categoryRoutes from "./modules/categories/category.route";
import reviewRoutes from "./modules/reviews/review.route";
import adminRoutes from "./modules/admin/admin.route";
import studentRoutes from "./modules/students/student.route";
import newsletterRoutes from "./modules/newsletter/newsletter.route";

const defaultFrontendUrl = "https://skillbridge-frontend-phi.vercel.app";
const localFrontendUrl = "http://localhost:3000";

const app: Application = express();

// Configure CORS to only allow trusted origins (from env TRUSTED_ORIGINS or APP_URL)
const trustedOrigins = (() => {
  const origins = new Set<string>();

  if (process.env.TRUSTED_ORIGINS) {
    process.env.TRUSTED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((origin) => origins.add(origin));
  }

  if (process.env.FRONTEND_URL) {
    origins.add(process.env.FRONTEND_URL);
  }

  origins.add(defaultFrontendUrl);

  if (process.env.NODE_ENV !== "production") {
    origins.add(localFrontendUrl);
  }

  return Array.from(origins);
})();

app.use(
  cors({
    origin: (origin, cb) => {
      // allow non-browser requests with no origin
      if (!origin) return cb(null, true);
      if (trustedOrigins.length === 0) return cb(null, true);
      if (trustedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Log auth-related requests for debugging origin/cookie issues
app.use((req, res, next) => {
  if (req.path.startsWith("/api/auth") || req.path === "/api/user/me") {
    console.log(
      `[AuthDebug] ${req.method} ${req.path} origin=${req.headers.origin} cookie=${req.headers.cookie}`,
    );

    // Handle duplicate session tokens by keeping only the last one
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(";").map((c) => c.trim());
      const sessionCookies = cookies.filter((c) =>
        c.startsWith("__Secure-better-auth.session_token="),
      );

      if (sessionCookies.length > 1) {
        console.log(
          `[AuthDebug] Found ${sessionCookies.length} session tokens, using the last one`,
        );
        // Remove duplicate session tokens, keep only the last one
        const otherCookies = cookies.filter(
          (c) => !c.startsWith("__Secure-better-auth.session_token="),
        );
        req.headers.cookie = [
          ...otherCookies,
          sessionCookies[sessionCookies.length - 1],
        ].join("; ");
        console.log(`[AuthDebug] Cleaned cookie header: ${req.headers.cookie}`);
      }
    }
  }
  next();
});

app.use(express.json());

// Mount custom auth routes at /api/user for /api/user/me
app.use("/api/user", authRoutes);

// better-auth routes - let Better Auth handle cookies (SameSite=Lax for proxy)
app.use("/api/auth", (req, res, next) => {
  return toNodeHandler(auth)(req, res).catch((err) => {
    next(err);
  });
});

app.use("/api/tutors", tutorRoutes); // Public & Student routes
app.use("/api/bookings", bookingRoutes); // Student routes
app.use("/api/categories", categoryRoutes); // Public routes
app.use("/api/reviews", reviewRoutes); // Public & Student routes
app.use("/api/admin", adminRoutes); // Admin routes
app.use("/api/students", studentRoutes); // Student profile routes
app.use("/api/newsletter", newsletterRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SkillBridge API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth/*",
      tutors: "/api/tutors",
      bookings: "/api/bookings",
      categories: "/api/categories",
      admin: "/api/admin",
      reviews: "/api/reviews",
      students: "/api/students",
      newsletter: "/api/newsletter",
    },
  });
});

// 404 handler
app.use(notFound);

// Global error handling middleware
app.use(errorHandler);

export default app;

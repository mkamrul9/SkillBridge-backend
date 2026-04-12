import "dotenv/config";

type DemoUser = {
  name: string;
  email: string;
  password: string;
  role: "STUDENT" | "TUTOR" | "ADMIN";
};

const backendUrl =
  process.env.BETTER_AUTH_URL ||
  "https://skillbridge-backend-evdp.onrender.com";
const frontendUrl =
  process.env.FRONTEND_URL ||
  "https://skillbridge-frontend-phi.vercel.app";

const demoUsers: DemoUser[] = [
  {
    name: "Demo Student",
    email: process.env.DEMO_STUDENT_EMAIL || "student.demo@skillbridge.com",
    password: process.env.DEMO_STUDENT_PASSWORD || "DemoUser123!",
    role: "STUDENT",
  },
  {
    name: "Demo Tutor",
    email: process.env.DEMO_TUTOR_EMAIL || "tutor.demo@skillbridge.com",
    password: process.env.DEMO_TUTOR_PASSWORD || "DemoTutor123!",
    role: "TUTOR",
  },
  {
    name: "Demo Admin",
    email: process.env.DEMO_ADMIN_EMAIL || "admin.demo@skillbridge.com",
    password: process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin123!",
    role: "ADMIN",
  },
];

function getCookieHeader(res: Response): string {
  const headersAny = res.headers as any;
  const setCookies: string[] =
    headersAny.getSetCookie?.() ||
    (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);

  return setCookies
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function signUpIfNeeded(user: DemoUser) {
  const signUpRes = await fetch(`${backendUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: frontendUrl,
    },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
    }),
  });

  if (signUpRes.ok) {
    return;
  }

  const text = (await signUpRes.text()).toLowerCase();
  if (
    text.includes("already") ||
    text.includes("exist") ||
    text.includes("duplicate")
  ) {
    return;
  }

  throw new Error(`Sign-up failed for ${user.email}: ${text}`);
}

async function signInAndGetCookie(user: DemoUser): Promise<string> {
  const signInRes = await fetch(`${backendUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: frontendUrl,
    },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });

  if (!signInRes.ok) {
    const text = await signInRes.text();
    throw new Error(`Sign-in failed for ${user.email}: ${text}`);
  }

  const cookieHeader = getCookieHeader(signInRes);
  if (!cookieHeader) {
    throw new Error(`No auth cookie received for ${user.email}`);
  }

  return cookieHeader;
}

async function ensureTutorProfile(cookieHeader: string) {
  const becomeRes = await fetch(`${backendUrl}/api/tutors/become-tutor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: frontendUrl,
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      bio: "Demo tutor profile for platform testing.",
      subjects: ["Mathematics", "Science"],
      hourlyRate: 30,
      experience: 4,
      availability: "Mon-Fri 6PM-9PM",
      categoryIds: [],
    }),
  });

  if (becomeRes.ok) {
    return;
  }

  const text = (await becomeRes.text()).toLowerCase();
  if (
    text.includes("already") ||
    text.includes("exists") ||
    text.includes("has a tutor profile")
  ) {
    return;
  }

  throw new Error(`Tutor profile creation failed: ${text}`);
}

async function verifyRole(cookieHeader: string, expectedRole: string) {
  const meRes = await fetch(`${backendUrl}/api/user/me`, {
    headers: {
      Origin: frontendUrl,
      Cookie: cookieHeader,
    },
  });

  if (!meRes.ok) {
    const text = await meRes.text();
    throw new Error(`Failed role verification: ${text}`);
  }

  const me: any = await meRes.json();
  const actual = me?.data?.role;
  if (actual !== expectedRole) {
    throw new Error(`Role mismatch. expected=${expectedRole}, actual=${actual}`);
  }
}

async function seedRemote() {
  console.log("***** Remote demo seeding started *****");
  console.log(`Backend URL: ${backendUrl}`);
  console.log(`Frontend Origin Header: ${frontendUrl}`);

  for (const user of demoUsers) {
    await signUpIfNeeded(user);
    const cookie = await signInAndGetCookie(user);

    if (user.role === "TUTOR") {
      await ensureTutorProfile(cookie);
    }

    await verifyRole(cookie, user.role);
    console.log(`Ready: ${user.role} -> ${user.email}`);
  }

  console.log("***** Remote demo users verified *****");
  for (const user of demoUsers) {
    console.log(`${user.role}: ${user.email} / ${user.password}`);
  }
}

seedRemote().catch((error) => {
  console.error("Remote seeding failed:", error);
  process.exit(1);
});

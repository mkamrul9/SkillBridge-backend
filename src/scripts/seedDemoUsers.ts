import "dotenv/config";

import { prisma } from "../lib/prisma";
import { UserRole } from "../middlewares/auth";

const backendUrl =
    process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`;

const DEMO_USERS = {
    admin: {
        name: "Demo Admin",
        email: process.env.DEMO_ADMIN_EMAIL || "admin.demo@skillbridge.com",
        password: process.env.DEMO_ADMIN_PASSWORD || "DemoAdmin123!",
        role: UserRole.ADMIN,
    },
    student: {
        name: "Demo Student",
        email: process.env.DEMO_STUDENT_EMAIL || "student.demo@skillbridge.com",
        password: process.env.DEMO_STUDENT_PASSWORD || "DemoUser123!",
        role: UserRole.STUDENT,
    },
    tutor: {
        name: "Demo Tutor",
        email: process.env.DEMO_TUTOR_EMAIL || "tutor.demo@skillbridge.com",
        password: process.env.DEMO_TUTOR_PASSWORD || "DemoTutor123!",
        role: UserRole.TUTOR,
    },
};

async function signUpIfNeeded(name: string, email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return existing;
    }

    const response = await fetch(`${backendUrl}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Origin: backendUrl,
        },
        body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed creating user ${email}: ${err}`);
    }

    const created = await prisma.user.findUnique({ where: { email } });
    if (!created) {
        throw new Error(`User ${email} was created but not found in database`);
    }

    return created;
}

async function resetDemoUserIfExists(email: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
        return;
    }

    const tutorProfile = await prisma.tutorProfile.findFirst({
        where: { userId: existing.id },
        select: { id: true },
    });

    if (tutorProfile) {
        await prisma.review.deleteMany({ where: { tutorId: tutorProfile.id } });
        await prisma.booking.deleteMany({ where: { tutorId: tutorProfile.id } });
        await prisma.tutorProfile.delete({ where: { id: tutorProfile.id } });
    }

    await prisma.review.deleteMany({ where: { studentId: existing.id } });
    await prisma.booking.deleteMany({ where: { studentId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
}

async function ensureRole(email: string, role: UserRole) {
    await prisma.user.update({
        where: { email },
        data: {
            role,
            emailVerified: true,
            status: "ACTIVE",
        },
    });
}

async function ensureTutorProfile(tutorEmail: string) {
    const tutorUser = await prisma.user.findUnique({ where: { email: tutorEmail } });
    if (!tutorUser) {
        throw new Error("Tutor user not found while creating tutor profile");
    }

    const existing = await prisma.tutorProfile.findFirst({ where: { userId: tutorUser.id } });
    if (existing) {
        return;
    }

    const categoryNames = ["Mathematics", "Science", "English"];
    const categoryIds: string[] = [];

    for (const name of categoryNames) {
        const category = await prisma.category.upsert({
            where: { name },
            create: {
                name,
                description: `${name} sessions and practice`,
            },
            update: {},
        });
        categoryIds.push(category.id);
    }

    await prisma.tutorProfile.create({
        data: {
            userId: tutorUser.id,
            bio: "I am a demo tutor profile for testing student bookings and dashboards.",
            subjects: ["Mathematics", "Science"],
            hourlyRate: 30,
            experience: 4,
            availability: "Mon-Fri 6PM-9PM, Sat 10AM-1PM",
            categories: {
                connect: categoryIds.map((id) => ({ id })),
            },
        },
    });
}

async function seedDemoUsers() {
    console.log("***** Demo user seeding started *****");
    console.log(`Using backend auth endpoint: ${backendUrl}`);

    // Ensure fixed demo credentials by rebuilding these seeded identities.
    await resetDemoUserIfExists(DEMO_USERS.admin.email);
    await resetDemoUserIfExists(DEMO_USERS.student.email);
    await resetDemoUserIfExists(DEMO_USERS.tutor.email);

    await signUpIfNeeded(
        DEMO_USERS.admin.name,
        DEMO_USERS.admin.email,
        DEMO_USERS.admin.password,
    );
    await ensureRole(DEMO_USERS.admin.email, DEMO_USERS.admin.role);

    await signUpIfNeeded(
        DEMO_USERS.student.name,
        DEMO_USERS.student.email,
        DEMO_USERS.student.password,
    );
    await ensureRole(DEMO_USERS.student.email, DEMO_USERS.student.role);

    await signUpIfNeeded(
        DEMO_USERS.tutor.name,
        DEMO_USERS.tutor.email,
        DEMO_USERS.tutor.password,
    );
    await ensureRole(DEMO_USERS.tutor.email, DEMO_USERS.tutor.role);
    await ensureTutorProfile(DEMO_USERS.tutor.email);

    console.log("***** Demo users ready *****");
    console.log(`Admin   -> ${DEMO_USERS.admin.email} / ${DEMO_USERS.admin.password}`);
    console.log(`Student -> ${DEMO_USERS.student.email} / ${DEMO_USERS.student.password}`);
    console.log(`Tutor   -> ${DEMO_USERS.tutor.email} / ${DEMO_USERS.tutor.password}`);
}

seedDemoUsers()
    .catch((error) => {
        console.error("Demo seeding failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

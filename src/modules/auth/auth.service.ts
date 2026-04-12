import { prisma } from "../../lib/prisma";

const normalizePhone = (value: unknown): string | null => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  const placeholderTokens = [
    "dummy",
    "not provided",
    "n/a",
    "na",
    "none",
    "null",
    "undefined",
    "test",
  ];

  if (placeholderTokens.some((token) => lowered.includes(token))) {
    return null;
  }

  return raw;
};

// Get current user with their profile information
const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      tutorProfile: {
        select: {
          id: true,
          bio: true,
          subjects: true,
          hourlyRate: true,
          experience: true,
          availability: true,
          categories: true, // Add categories to the response
          reviews: {
            select: {
              rating: true,
            },
          },
        },
      },
    },
  });

  // Check if user is banned
  if (user && user.status === "BANNED") {
    throw new Error("Your account has been banned. Please contact support.");
  }

  if (user) {
    return {
      ...user,
      phone: normalizePhone(user.phone),
    };
  }

  return user;
};

// Update user's phone number
const updatePhone = async (userId: string, phone: string) => {
  const safePhone = normalizePhone(phone);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { phone: safePhone },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
  });

  return {
    ...user,
    phone: normalizePhone(user.phone),
  };
};

export const authService = {
  getCurrentUser,
  updatePhone,
};

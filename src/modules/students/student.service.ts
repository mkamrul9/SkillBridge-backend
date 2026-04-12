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

// Get student profile
const getMyProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return {
    ...user,
    phone: normalizePhone(user.phone),
  };
};

// Update student profile
const updateMyProfile = async (
  userId: string,
  data: { name?: string; phone?: string; image?: string },
) => {
  const safePhone = data.phone !== undefined ? normalizePhone(data.phone) : undefined;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(safePhone !== undefined && { phone: safePhone }),
      ...(data.image !== undefined && { image: data.image }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ...updatedUser,
    phone: normalizePhone(updatedUser.phone),
  };
};

export const studentService = {
  getMyProfile,
  updateMyProfile,
};

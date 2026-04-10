import { prisma } from "../../lib/prisma";

// Get dashboard statistics
const getDashboardStats = async () => {
  const [
    totalUsers,
    totalTutors,
    totalBookings,
    totalCategories,
    totalReviews,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.tutorProfile.count(),
    prisma.booking.count(),
    prisma.category.count(),
    prisma.review.count(),
  ]);

  const [usersByRole, bookingsByStatus, recentBookings, recentUsers] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: {
        role: true,
      },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    }),
    prisma.booking.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        student: {
          select: {
            name: true,
            email: true,
          },
        },
        tutor: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    totals: {
      users: totalUsers,
      tutors: totalTutors,
      bookings: totalBookings,
      categories: totalCategories,
      reviews: totalReviews,
    },
    usersByRole,
    bookingsByStatus,
    recentBookings,
    recentUsers,
  };
};

// Get all users
const getAllUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
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
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return users;
};

// Update user status (role or other fields)
const updateUserStatus = async (
  userId: string,
  data: { role?: string; emailVerified?: boolean },
) => {
  // Validate role if provided
  if (data.role) {
    const validRoles = ["STUDENT", "TUTOR", "ADMIN"];
    if (!validRoles.includes(data.role)) {
      throw new Error("Invalid role. Must be STUDENT, TUTOR, or ADMIN");
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tutorProfile: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // If changing from TUTOR to another role, delete the tutor profile
  if (
    data.role &&
    user.role === "TUTOR" &&
    data.role !== "TUTOR" &&
    user.tutorProfile
  ) {
    // Check if tutor has any bookings or reviews
    const [bookingsCount, reviewsCount] = await Promise.all([
      prisma.booking.count({ where: { tutorId: user.tutorProfile.id } }),
      prisma.review.count({ where: { tutorId: user.tutorProfile.id } }),
    ]);

    if (bookingsCount > 0 || reviewsCount > 0) {
      throw new Error(
        `Cannot change role from TUTOR to ${data.role}. This tutor has ${bookingsCount} booking(s) and ${reviewsCount} review(s). Please delete or reassign them first.`,
      );
    }

    // Safe to delete tutor profile
    await prisma.tutorProfile.delete({
      where: { userId: userId },
    });
  }

  // If changing TO TUTOR from another role, create a default tutor profile
  if (
    data.role &&
    data.role === "TUTOR" &&
    user.role !== "TUTOR" &&
    !user.tutorProfile
  ) {
    await prisma.tutorProfile.create({
      data: {
        userId: userId,
        bio: "Experienced tutor ready to help students succeed",
        subjects: ["General"],
        hourlyRate: 25.0,
        experience: 1,
      },
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.role && { role: data.role }),
      ...(data.emailVerified !== undefined && {
        emailVerified: data.emailVerified,
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

// Ban or unban a user
const updateUserBanStatus = async (userId: string, status: string) => {
  const validStatuses = ["ACTIVE", "BANNED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status. Must be ACTIVE or BANNED");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

export const adminService = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  updateUserBanStatus,
};

// Get tutor profile by userId (for authenticated tutor profile page)
const getTutorByUserId = async (userId: string) => {
  const tutor = await prisma.tutorProfile.findFirst({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      },
      categories: true,
      reviews: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
  return tutor;
};
import { prisma } from "../../lib/prisma";

// Get all tutors with optional filters
const getAllTutors = async (filters: {
  subjects?: string[];
  minRate?: number;
  maxRate?: number;
  minExperience?: number;
  categoryId?: string;
  minRating?: number;
  search?: string;
  sortBy?: "newest" | "price" | "experience" | "rating" | "name";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}) => {
  const tutors = await prisma.tutorProfile.findMany({
    where: {
      ...(filters.subjects?.length && {
        subjects: { hasSome: filters.subjects },
      }),
      ...(filters.categoryId && {
        categories: {
          some: {
            id: filters.categoryId,
          },
        },
      }),
      ...(filters.search && {
        OR: [
          {
            user: {
              name: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          },
          {
            user: {
              email: {
                contains: filters.search,
                mode: "insensitive",
              },
            },
          },
          {
            bio: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
        ],
      }),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      },
      categories: true,
      reviews: {
        select: {
          rating: true,
        },
      },
    },
    orderBy: {
      user: {
        createdAt: "desc",
      },
    },
  });

  // Filter by rate and experience
  const filteredTutors = tutors.filter((tutor) => {
    if (filters.minRate && Number(tutor.hourlyRate) < filters.minRate)
      return false;
    if (filters.maxRate && Number(tutor.hourlyRate) > filters.maxRate)
      return false;
    if (filters.minExperience && tutor.experience < filters.minExperience)
      return false;

    // Filter by minimum rating
    if (filters.minRating && tutor.reviews.length > 0) {
      const avgRating =
        tutor.reviews.reduce((sum, r) => sum + r.rating, 0) /
        tutor.reviews.length;
      if (avgRating < filters.minRating) return false;
    }

    return true;
  });

  const withAverageRating = filteredTutors.map((tutor) => {
    const averageRating = tutor.reviews.length
      ? tutor.reviews.reduce((sum, r) => sum + r.rating, 0) / tutor.reviews.length
      : 0;
    return {
      ...tutor,
      averageRating,
    };
  });

  const sortBy = filters.sortBy || "newest";
  const sortOrder = filters.sortOrder || "desc";

  const sortedTutors = [...withAverageRating].sort((a, b) => {
    let compareValue = 0;

    if (sortBy === "price") {
      compareValue = Number(a.hourlyRate) - Number(b.hourlyRate);
    } else if (sortBy === "experience") {
      compareValue = a.experience - b.experience;
    } else if (sortBy === "rating") {
      compareValue = a.averageRating - b.averageRating;
    } else if (sortBy === "name") {
      compareValue = a.user.name.localeCompare(b.user.name);
    } else {
      compareValue =
        new Date(a.user.createdAt).getTime() - new Date(b.user.createdAt).getTime();
    }

    return sortOrder === "asc" ? compareValue : -compareValue;
  });

  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 12));
  const total = sortedTutors.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const pagedTutors = sortedTutors.slice(start, start + limit);

  return {
    data: pagedTutors,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

// Get featured tutors (top rated with reviews)
const getFeaturedTutors = async (limit: number = 6) => {
  const tutors = await prisma.tutorProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          status: true,
        },
      },
      categories: true,
      reviews: {
        select: {
          rating: true,
        },
      },
    },
  });

  // Calculate average rating and filter active tutors
  const tutorsWithRating = tutors
    .filter(
      (tutor) => tutor.user.status === "ACTIVE" && tutor.reviews.length > 0,
    )
    .map((tutor) => {
      const avgRating =
        tutor.reviews.reduce((sum, review) => sum + review.rating, 0) /
        tutor.reviews.length;
      return {
        ...tutor,
        averageRating: parseFloat(avgRating.toFixed(2)),
        reviewCount: tutor.reviews.length,
      };
    })
    .sort((a, b) => {
      // Sort by rating first, then by review count
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return b.reviewCount - a.reviewCount;
    })
    .slice(0, limit);

  return tutorsWithRating;
};

// Get all tutors who have availability
const getAvailableTutors = async () => {
  const allTutors = await prisma.tutorProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      categories: true,
      reviews: {
        select: {
          rating: true,
        },
      },
    },
    orderBy: {
      user: {
        createdAt: "desc",
      },
    },
  });

  // Filter tutors who have availability set
  return allTutors.filter((tutor) => tutor.availability !== null);
};

// Get single tutor by ID
const getTutorById = async (tutorId: string) => {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        },
      },
      categories: true,
      reviews: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!tutor) {
    return null;
  }

  return tutor;
};

// Get tutor's availability
const getTutorAvailability = async (tutorId: string) => {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorId },
    select: {
      availability: true,
    },
  });

  return tutor?.availability || null;
};

// Create tutor profile for a user
const createTutorProfile = async (
  userId: string,
  data: {
    bio: string;
    subjects: string[];
    hourlyRate: number;
    experience: number;
    availability?: any;
    categoryIds?: string[];
  },
) => {
  // Check if user already has a tutor profile
  const existingProfile = await prisma.tutorProfile.findFirst({
    where: { userId },
  });

  if (existingProfile) {
    throw new Error("User already has a tutor profile");
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Create tutor profile and update user role in a transaction, so that if middle of the process aborts whole process rolls back
  return await prisma.$transaction(async (tx) => {
    const profile = await tx.tutorProfile.create({
      data: {
        userId,
        bio: data.bio,
        subjects: data.subjects,
        hourlyRate: data.hourlyRate,
        experience: data.experience,
        availability: data.availability || null,
        ...(data.categoryIds &&
          data.categoryIds.length > 0 && {
            categories: {
              connect: data.categoryIds.map((id) => ({ id })),
            },
          }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        categories: true,
      },
    });

    // Update user role to TUTOR
    await tx.user.update({
      where: { id: userId },
      data: { role: "TUTOR" },
    });

    return profile;
  });
};

// Update tutor profile by tutorId
const updateTutorProfile = async (
  tutorId: string,
  userId: string,
  userRole: string,
  data: {
    bio?: string;
    subjects?: string[];
    hourlyRate?: number;
    experience?: number;
    availability?: any;
  },
) => {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorId },
  });

  if (!tutor) {
    throw new Error("Tutor profile not found");
  }

  // only tutor himself and admin can update the profile
  if (userRole !== "ADMIN" && tutor.userId !== userId) {
    throw new Error("You don't have permission to update this tutor profile");
  }

  const updateData: any = {};

  if (data.bio) updateData.bio = data.bio;
  if (data.subjects) updateData.subjects = data.subjects;
  if (data.hourlyRate) updateData.hourlyRate = data.hourlyRate;
  if (data.experience !== undefined) updateData.experience = data.experience;
  if (data.availability !== undefined)
    updateData.availability = data.availability;

  return await prisma.tutorProfile.update({
    where: { id: tutorId },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
};

// Update tutor profile by userId
const updateMyProfileByUserId = async (
  userId: string,
  data: {
    bio?: string;
    subjects?: string[];
    hourlyRate?: number;
    experience?: number;
    availability?: any;
    categoryIds?: string[];
  },
) => {
  // Find tutor profile by userId
  const tutor = await prisma.tutorProfile.findFirst({
    where: { userId },
  });

  if (!tutor) {
    throw new Error("Tutor profile not found");
  }

  const updateData: any = {};

  if (data.bio) updateData.bio = data.bio;
  if (data.subjects) updateData.subjects = data.subjects;
  if (data.hourlyRate) updateData.hourlyRate = data.hourlyRate;
  if (data.experience !== undefined) updateData.experience = data.experience;
  if (data.availability !== undefined)
    updateData.availability = data.availability;

  // Handle category updates
  if (data.categoryIds !== undefined) {
    // Disconnect all existing categories and connect new ones
    const currentTutor = await prisma.tutorProfile.findUnique({
      where: { id: tutor.id },
      include: { categories: true },
    });

    if (currentTutor) {
      updateData.categories = {
        disconnect: currentTutor.categories.map((c) => ({ id: c.id })),
        ...(data.categoryIds.length > 0 && {
          connect: data.categoryIds.map((id) => ({ id })),
        }),
      };
    }
  }

  return await prisma.tutorProfile.update({
    where: { id: tutor.id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      categories: true,
    },
  });
};

// Update tutor's availability only
const updateMyAvailability = async (userId: string, availability: any) => {
  // Find tutor profile by userId
  const tutor = await prisma.tutorProfile.findFirst({
    where: { userId },
  });

  if (!tutor) {
    throw new Error("Tutor profile not found");
  }

  return await prisma.tutorProfile.update({
    where: { id: tutor.id },
    data: { availability },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
};

// Delete tutor profile
const deleteTutorProfile = async (
  tutorId: string,
  userId: string,
  userRole: string,
) => {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorId },
  });

  if (!tutor) {
    throw new Error("Tutor profile not found");
  }

  if (userRole !== "ADMIN" && tutor.userId !== userId) {
    throw new Error("You don't have permission to delete this tutor profile");
  }

  // Delete profile
  return await prisma.$transaction(async (tx) => {
    await tx.tutorProfile.delete({
      where: { id: tutorId },
    });
  });
};

export const tutorService = {
  getAllTutors,
  getFeaturedTutors,
  getAvailableTutors,
  getTutorById,
  getTutorAvailability,
  createTutorProfile,
  getTutorByUserId,
  updateTutorProfile: updateMyProfileByUserId,
  updateMyProfileByUserId,
  updateMyAvailability,
  deleteTutorProfile,
};

# SkillBridge - Tutoring Platform Backend

A backend API for a tutoring platform that connects students with tutors. Built with Node.js, Express, TypeScript, Prisma and PostgreSQL.

## 🔗 Links

- **Live API**: [https://skillbridge-backend-evdp.onrender.com](https://skillbridge-backend-evdp.onrender.com)
- **Frontend Application**: [https://skillbridge-frontend-phi.vercel.app](https://skillbridge-frontend-phi.vercel.app)

## ✨ Features

### Student Features

- Register and login (email/password)
- Browse tutors with filters - subject, category, price, rating, experience
- View top-rated tutors
- Book sessions instantly
- Manage and cancel bookings
- Leave reviews after completing sessions (1-5 stars)
- Update profile info

### Tutor Features

- Create tutor profile with bio, subjects and hourly rates
- Set availability using flexible JSON format
- Update profile anytime
- View all teaching sessions
- Mark sessions as completed
- See all ratings and reviews

### Admin Features

- Dashboard with stats
- Manage users - update roles, ban/unban
- CRUD operations for categories
- View all bookings

## 🛠️ Tech Stack

**Backend**: Node.js, Express.js, TypeScript  
**Database**: PostgreSQL with Prisma ORM  
**Auth**: Better-Auth (session-based with OAuth support)  
**Security**: Role-based access control

## 📊 Database Schema

```mermaid
erDiagram
    User ||--o{ Session : has
    User ||--o{ Account : has
    User ||--o| TutorProfile : "has one"
    User ||--o{ Booking : creates
    User ||--o{ Review : writes
    TutorProfile ||--o{ Booking : receives
    TutorProfile ||--o{ Review : receives
    TutorProfile }o--o{ Category : "belongs to"

    User {
        string id PK
        string name
        string email
        boolean emailVerified
        string image
        string role
        string phone
        string status
        datetime createdAt
        datetime updatedAt
    }

    TutorProfile {
        string id PK
        string userId FK
        string bio
        string subjects
        decimal hourlyRate
        int experience
        json availability
    }

    Category {
        string id PK
        string name
        string description
    }

    Booking {
        string id PK
        string studentId FK
        string tutorId FK
        datetime startTime
        datetime endTime
        string status
        datetime createdAt
        datetime updatedAt
    }

    Review {
        string id PK
        string studentId FK
        string tutorId FK
        int rating
        string comment
        datetime createdAt
    }

    Session {
        string id PK
        string userId FK
        datetime expiresAt
        string token
    }

    Account {
        string id PK
        string userId FK
        string accountId
        string providerId
        string password
    }
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL v14+
- npm or yarn

### Installation

1. **Clone and install**

   ```bash
   git clone [Your Repository URL]
   cd Backend
   npm install
   ```

2. **Setup environment variables** - Create `.env`:

   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/skillbridge"
   BETTER_AUTH_SECRET="your-secret-key"
   BETTER_AUTH_URL="http://localhost:5000"
    FRONTEND_URL="http://localhost:3000"
   TRUSTED_ORIGINS="http://localhost:3000"
   PORT=5000
   NODE_ENV="development"

   # For production (Render):
   # BETTER_AUTH_URL="https://skillbridge-backend-evdp.onrender.com"
    # FRONTEND_URL="https://skillbridge-frontend-phi.vercel.app"
    # TRUSTED_ORIGINS="https://skillbridge-frontend-phi.vercel.app"
   # NODE_ENV="production"
   ```

3. **Setup database**

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npm run seed:admin  # creates admin@admin.com / admin1234
   ```

4. **Run the server**
   ```bash
   npm run dev  # Development
   npm run build && npm start  # Production
   ```

## API Endpoints

### Authentication

- `POST /api/auth/sign-up/email` - Register
- `POST /api/auth/sign-in/email` - Login
- `GET /api/auth/get-session` - Get current session

### Public

- `GET /api/tutors?subjects=&minRate=&maxRate=&categoryId=` - Browse tutors
- `GET /api/tutors/featured` - Top rated tutors
- `GET /api/tutors/:id` - Tutor details
- `GET /api/categories` - All categories
- `GET /api/reviews/tutor/:tutorId` - Reviews for tutor

### Student (Protected)

- `GET/PATCH /api/students/profile` - Manage profile
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - My bookings
- `DELETE /api/bookings/:id` - Cancel booking
- `POST /api/reviews` - Create review (needs completed session)

### Tutor (Protected)

- `POST /api/tutors/become-tutor` - Create profile
- `PUT /api/tutors/profile` - Update profile
- `PUT /api/tutors/availability` - Update availability
- `PATCH /api/bookings/:id/status` - Mark as completed

### Admin (Protected)

- `GET /api/admin/dashboard` - Stats
- `GET /api/admin/users` - All users
- `PATCH /api/admin/users/:id` - Update role/verification
- `PATCH /api/admin/users/:id/ban-status` - Ban/unban
- `POST/PATCH/DELETE /api/categories` - Manage categories

## Challenges & Solutions

### 1. Authentication & Authorization

Used Better-Auth which handles everything - password hashing, sessions. Built custom middleware on top for role-based access.

### 2. Booking Status Flow

Made bookings instantly confirmed instead of pending approval. Only tutors can mark sessions as completed, only students can cancel. Added proper validation so status transitions make sense.

### 3. Review System

Students can only review after completing a session with a tutor. Also made sure one student can only leave one review per tutor.

## 👨‍💻 Author

blue9kamrul

# SDP Ayurveda Dashboard

**Production-ready field management solution** with GPS tracking, client visit management, task assignment, and real-time performance analytics for Marketing Representatives.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- MongoDB database (MongoDB Atlas recommended)

### 2. Installation
```bash
# Clone the repository
git clone <repository-url>
cd sdp-ayurveda-dashboard

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate
```

### 3. Database Setup
**⚠️ Required:** You need to set up a MongoDB database before running the application.

See **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** for detailed instructions.

**Quick setup with MongoDB Atlas (Free):**
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free account and cluster
3. Get connection string
4. Update `.env.local` with your connection string:
   ```
   DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/sdp-ayurveda-dev"
   ```

### 4. Run the Application
```bash
# Push database schema
npm run db:push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 🧪 Testing & Development

### Database Testing
```bash
# Test database connection and schema
visit: http://localhost:3000/api/db-test

# Health check
visit: http://localhost:3000/api/health

# Seed with sample data
curl -X POST http://localhost:3000/api/seed
```

### Database Management
```bash
# Visual database editor
npm run db:studio

# Regenerate Prisma client
npm run db:generate

# Push schema changes
npm run db:push
```

## 🏗️ Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: MongoDB with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod validation
- **State Management**: TanStack Query + Zustand
- **Authentication**: NextAuth.js (ready)
- **Charts**: Recharts
- **Icons**: Lucide React

## 📊 Features

### ✅ Completed (Stories 1.1 & 1.2)
- **Project Setup**: Next.js 15 + TypeScript + Prisma
- **Database Schema**: 10 models with relationships
- **User Management**: Role-based access (MR, LEAD_MR, ADMIN)
- **Geographic Data**: Regions and Areas
- **Client Management**: Healthcare facilities tracking
- **Business Entries**: Transaction recording
- **Task Management**: Assignment and tracking
- **GPS Tracking**: Session and coordinate logging
- **Notifications**: In-app messaging system
- **Performance Analytics**: Daily summaries

### 🚧 In Progress
- **Authentication System** (Story 1.3)
- **API Endpoints** (Story 1.4)
- **Dashboard UI** (Story 1.5)

## 🗂️ Project Structure

```
src/
├── app/              # Next.js App Router
│   ├── api/          # API endpoints
│   ├── globals.css   # Global styles
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── components/       # Reusable UI components
├── lib/              # Utilities and configurations
│   ├── prisma.ts     # Database client
│   ├── utils.ts      # Helper functions
│   ├── validations.ts # Zod schemas
│   ├── db-test.ts    # Database testing
│   └── seed.ts       # Sample data
└── types/            # TypeScript definitions

prisma/
└── schema.prisma     # Database schema
```

## 🔐 Environment Variables

Copy `.env.local` and configure:

```bash
# Database (Required)
DATABASE_URL="mongodb://localhost:27017/sdp-ayurveda-dev"

# NextAuth (For authentication)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Application
NODE_ENV="development"
APP_NAME="SDP Ayurveda Dashboard"
```

## 📋 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## 🧪 API Endpoints

- **Health Check**: `GET /api/health`
- **Database Test**: `GET /api/db-test`
- **Sample Data**: `POST /api/seed`

## 📈 Development Progress

- ✅ **Story 1.1**: Next.js Project Setup
- ✅ **Story 1.2**: MongoDB Schema Implementation
- 🚧 **Story 1.3**: User Authentication System
- ⏳ **Story 1.4**: Core API Endpoints
- ⏳ **Story 1.5**: Admin User Management Dashboard

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Use Prisma for database operations
3. Follow Next.js 15 App Router patterns
4. Use shadcn/ui for components
5. Write tests for new features

## 📚 Documentation

- [Database Setup Guide](./DATABASE_SETUP.md)
- [Project Architecture](./docs/architecture/)
- [User Stories](./stories/)
- [Next.js Best Practices](./nextjs.mdc)

## 🆘 Troubleshooting

### Database Connection Issues
1. Check MongoDB is running (local) or accessible (Atlas)
2. Verify DATABASE_URL format
3. Run `npm run db:generate` after schema changes

### Build Issues
1. Ensure all environment variables are set
2. Run `npm run db:generate`
3. Check for TypeScript errors

---

**Built with ❤️ for SDP Ayurveda field management**

# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**SDP Ayurveda Dashboard** - Production-ready field management solution with GPS tracking, client visit management, task assignment, and real-time performance analytics for Marketing Representatives.

- **Framework**: Next.js 15 with App Router and TypeScript (strict mode)
- **Database**: MongoDB with Prisma ORM (schema-driven development)
- **Authentication**: NextAuth.js with role-based access (MR, LEAD_MR, ADMIN)
- **Mobile Integration**: REST API with CORS configured for mobile app consumption

## Common Development Commands

### Database Operations
```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database (development)
npm run db:push

# Open visual database editor
npm run db:studio

# Seed database with sample data
npm run db:seed
```

### Development Workflow
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
npm run test:watch

# Lint code
npm run lint
```

### API Testing & Verification
```bash
# Health check
curl http://localhost:3000/api/health

# Database connection test
curl http://localhost:3000/api/db-test

# Seed with sample data
curl -X POST http://localhost:3000/api/seed
```

## Architecture & Key Components

### Database Schema (Prisma)
The system uses MongoDB with a comprehensive 10-model schema designed for field management:

**Core Entities:**
- `User` - Role-based users (MR → LEAD_MR → ADMIN hierarchy)
- `Region` + `Area` - Geographic data management
- `Client` - Healthcare facilities with GPS coordinates
- `BusinessEntry` - Transaction recording with location validation
- `Task` - Assignment and tracking with status management
- `GPSSession` + `GPSLog` - Field tracking with coordinate logging
- `DailySummary` - Performance analytics aggregation

**Key Relationships:**
- Users belong to Regions and have Lead MR assignments
- Clients are geo-located within Areas/Regions
- All business activities are GPS-tracked and user-attributed
- Role-based data access (Users see only their assigned regions/areas)

### API Structure (`/src/app/api/`)
RESTful endpoints with consistent response format:
- `/users` - User management with role filtering
- `/clients` - Client management with geo-search
- `/business` - Business entry recording with GPS validation
- `/tasks` - Task assignment and status tracking
- `/regions` & `/areas` - Geographic data management
- `/reports` - Analytics and performance data

### Frontend Components (`/src/components/`)
shadcn/ui-based components with:
- Admin management forms (region-form.tsx, area-form.tsx)
- Report dashboards (dashboard-overview.tsx, regional-performance.tsx)
- Hydration-safe wrappers for SSR compatibility

### Utilities (`/src/lib/`)
- `prisma.ts` - Database client with connection pooling
- `auth.ts` - NextAuth configuration with JWT
- `validations.ts` - Zod schemas for type-safe API validation
- `gps-*.ts` - GPS tracking utilities and analytics
- `api-*.ts` - API client helpers and utilities

## Environment Configuration

**Required Variables:**
```env
DATABASE_URL="mongodb+srv://user:pass@cluster.mongodb.net/sdp-ayurveda-dev"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
```

**Database Setup Priority:**
MongoDB connection is required before any development. Use MongoDB Atlas (free tier) or local MongoDB instance. Run `npm run db:push` after setting DATABASE_URL.

## Development Patterns

### API Response Format
All APIs return consistent structure:
```typescript
{
  success: boolean,
  data?: any,
  error?: string,
  message?: string,
  pagination?: PaginationInfo
}
```

### Role-Based Access Control
- **MR**: Can only access own region/area data
- **LEAD_MR**: Can access team members' data within region
- **ADMIN**: Full system access across all regions

### GPS Integration
Business entries and user sessions require GPS coordinates. Mobile apps should capture location during API calls to `/api/business` and GPS tracking endpoints.

### Database-First Development
1. Modify `prisma/schema.prisma` for any data model changes
2. Run `npm run db:generate` to update client
3. Run `npm run db:push` to apply to database
4. Update API routes and validations accordingly
5. Run comprehensive database tests via `npm run db:test` endpoint

### API Development Workflow
1. Create API endpoint files in `/src/app/api/` following REST conventions
2. Implement required HTTP methods (GET, POST, PUT, DELETE)
3. Add authentication, rate limiting, and error handling patterns
4. Create validation schemas in `/src/lib/validations.ts`
5. Verify endpoint completeness with `node api-verification-test.js`

## Mobile Integration Notes

- CORS pre-configured for mobile app origins
- Authentication requires session management or JWT tokens
- All business operations expect GPS coordinates
- API documentation available at `/API_DOCUMENTATION.md`
- Mobile quick start guide at `/MOBILE_DEVELOPER_QUICK_START.md`

## Testing & Debugging

### Test Configuration
- Jest configured with TypeScript support and jsdom environment
- Custom test setup in `jest.setup.ts` with mocking for Next.js components
- Path mapping configured (`@/` points to `src/`)
- Coverage collection for API routes and lib utilities

### Database Testing
- Comprehensive database test utilities in `/src/lib/db-test.ts`
- Test functions for all model creation and relationships
- Unique constraints validation testing
- Sample data generation and cleanup utilities

### API Verification
- Production-level API verification script (`api-verification-test.js`)
- Comprehensive endpoint structure validation
- Production readiness scoring system
- Automated checks for authentication, validation, and error handling patterns
- Detailed JSON reports with recommendations

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Verify API endpoints structure
node api-verification-test.js

# Test database models and relationships
curl http://localhost:3000/api/db-test
```

### Error Monitoring
- Sentry integration for production error monitoring
- Development server includes detailed error logging
- Custom API error handling patterns in utilities

## Key Files for Context

When working on this project, these files provide essential context:
- `prisma/schema.prisma` - Complete data model
- `src/lib/validations.ts` - API validation schemas
- `API_DOCUMENTATION.md` - Complete API reference
- `package.json` - All available scripts and dependencies
- `next.config.ts` - CORS and deployment configuration

import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  logError,
  rateLimit,
  parseQueryParams
} from '@/lib/api-utils';

// GET /api/clients/[id]/business - Get client business history
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  let user;

  try {
    // Rate limiting
    if (!rateLimit(request)) {
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
        429
      );
    }

    // Authentication
    user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { page, limit } = parseQueryParams(request);
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // First, verify the client exists and user has access
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        mrId: true,
        regionId: true,
        mr: {
          select: {
            leadMrId: true
          }
        }
      }
    });

    if (!client) {
      return errorResponse('NOT_FOUND', 'Client not found', 404);
    }

    // Apply role-based access control
    switch (user.role) {
      case UserRole.MR:
        if (client.mrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access business history for your own clients', 403);
        }
        break;
      case UserRole.LEAD_MR:
        if (client.regionId !== user.regionId && client.mr.leadMrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access business history for clients in your region or assigned to your team', 403);
        }
        break;
      case UserRole.ADMIN:
        // Admin can access all client business history
        break;
    }

    // Build query for business entries
    const whereClause: Record<string, unknown> = {
      clientId: id
    };

    // Date range filtering
    if (dateFrom || dateTo) {
      whereClause.createdAt = {} as Record<string, Date>;
      if (dateFrom) {
        (whereClause.createdAt as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (whereClause.createdAt as Record<string, Date>).lte = new Date(dateTo);
      }
    }

    // Get total count for pagination
    const total = await prisma.businessEntry.count({ where: whereClause });

    // Get business entries with related data
    const businessEntries = await prisma.businessEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        notes: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
        mr: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    // Calculate business statistics
    const businessStats = await prisma.businessEntry.aggregate({
      where: whereClause,
      _sum: { amount: true },
      _avg: { amount: true },
      _count: { amount: true },
      _min: { amount: true },
      _max: { amount: true }
    });

    // Get business entries by month for trend analysis
    // Since we can't use raw SQL easily, we'll aggregate manually
    const allBusinessEntries = await prisma.businessEntry.findMany({
      where: whereClause,
      select: {
        amount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group by month manually
    const monthlyData = new Map<string, { count: number; total_amount: number; amounts: number[] }>();
    
    allBusinessEntries.forEach(entry => {
      const monthKey = entry.createdAt.toISOString().substr(0, 7); // YYYY-MM
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { count: 0, total_amount: 0, amounts: [] });
      }
      const monthData = monthlyData.get(monthKey)!;
      monthData.count++;
      monthData.total_amount += entry.amount;
      monthData.amounts.push(entry.amount);
    });

    const businessByMonth = Array.from(monthlyData.entries())
      .map(([monthKey, data]) => ({
        month: new Date(monthKey + '-01'),
        count: data.count,
        total_amount: data.total_amount,
        avg_amount: data.amounts.length > 0 ? data.total_amount / data.amounts.length : 0
      }))
      .sort((a, b) => b.month.getTime() - a.month.getTime())
      .slice(0, 12);

    // Calculate growth rate (comparing last month to previous month)
    let growthRate = 0;
    if (businessByMonth.length >= 2) {
      const currentMonth = businessByMonth[0];
      const previousMonth = businessByMonth[1];
      if (previousMonth.total_amount > 0) {
        growthRate = ((currentMonth.total_amount - previousMonth.total_amount) / previousMonth.total_amount) * 100;
      }
    }

    // Get recent activity summary
    const recentActivity = {
      last30Days: await prisma.businessEntry.count({
        where: {
          clientId: id,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      last7Days: await prisma.businessEntry.count({
        where: {
          clientId: id,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      lastEntry: businessEntries.length > 0 ? businessEntries[0] : null
    };

    const response = {
      client: {
        id: client.id,
        name: client.name
      },
      businessEntries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      statistics: {
        totalAmount: businessStats._sum.amount || 0,
        averageAmount: businessStats._avg.amount || 0,
        totalEntries: businessStats._count.amount || 0,
        minAmount: businessStats._min.amount || 0,
        maxAmount: businessStats._max.amount || 0,
        growthRate: parseFloat(growthRate.toFixed(2))
      },
      trends: {
        monthlyData: businessByMonth.map(month => ({
          month: month.month.toISOString().substr(0, 7), // YYYY-MM format
          count: month.count,
          totalAmount: parseFloat(month.total_amount.toFixed(2)),
          avgAmount: parseFloat(month.avg_amount.toFixed(2))
        }))
      },
      recentActivity,
      filters: {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      }
    };

    return successResponse(response);

  } catch (error) {
    logError(error, `GET /api/clients/${id}/business`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch client business history', 500);
  }
}

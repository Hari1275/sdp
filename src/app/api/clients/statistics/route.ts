import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  logError,
  rateLimit
} from '@/lib/api-utils';

// GET /api/clients/statistics - Get client statistics
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get('regionId');
    const areaId = searchParams.get('areaId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build base query with role-based filtering
    const whereClause: Record<string, unknown> = {};

    // Apply role-based data access
    switch (user.role) {
      case UserRole.MR:
        whereClause.mrId = user.id;
        break;
      case UserRole.LEAD_MR:
        whereClause.OR = [
          { regionId: user.regionId },
          { mr: { leadMrId: user.id } }
        ];
        break;
      case UserRole.ADMIN:
        // Admin can see all client statistics
        break;
    }

    // Apply additional filters
    if (regionId && (user.role === UserRole.ADMIN || user.regionId === regionId)) {
      whereClause.regionId = regionId;
    }
    if (areaId) {
      whereClause.areaId = areaId;
    }

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

    // Get basic client statistics
    const [
      totalClients,
      activeClients,
      clientsByBusinessType,
      clientsByRegion,
      clientsByArea,
      topMRsByClients,
      recentClients,
      clientsWithBusinessEntries
    ] = await Promise.all([
      // Total clients
      prisma.client.count({ where: whereClause }),

      // Active clients (with business entries in the last 30 days)
      prisma.client.count({
        where: {
          ...whereClause,
          businessEntries: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            }
          }
        }
      }),

      // Clients grouped by business type
      prisma.client.groupBy({
        by: ['businessType'],
        where: whereClause,
        _count: { businessType: true },
        orderBy: { _count: { businessType: 'desc' } }
      }),

      // Clients grouped by region (for admin only)
      user.role === UserRole.ADMIN ? 
        prisma.client.groupBy({
          by: ['regionId'],
          where: whereClause,
          _count: { regionId: true },
          orderBy: { _count: { regionId: 'desc' } }
        }) : [],

      // Clients grouped by area
      prisma.client.groupBy({
        by: ['areaId'],
        where: whereClause,
        _count: { areaId: true },
        orderBy: { _count: { areaId: 'desc' } },
        take: 10
      }),

      // Top MRs by client count (for Lead MR and Admin)
      user.role !== UserRole.MR ?
        prisma.client.groupBy({
          by: ['mrId'],
          where: whereClause,
          _count: { mrId: true },
          orderBy: { _count: { mrId: 'desc' } },
          take: 10
        }) : [],

      // Recent clients (last 30 days)
      prisma.client.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Clients with business entries
      prisma.client.count({
        where: {
          ...whereClause,
          businessEntries: {
            some: {}
          }
        }
      })
    ]);

    // Get region names for region statistics
    let regionStatistics: Array<{
      regionId: string;
      regionName: string;
      count: number;
    }> = [];
    if (user.role === UserRole.ADMIN && clientsByRegion.length > 0) {
      const regionIds = clientsByRegion.map(r => r.regionId).filter(Boolean) as string[];
      const regions = await prisma.region.findMany({
        where: { id: { in: regionIds } },
        select: { id: true, name: true }
      });

      regionStatistics = clientsByRegion.map(stat => ({
        regionId: stat.regionId,
        regionName: regions.find(r => r.id === stat.regionId)?.name || 'Unknown',
        count: stat._count.regionId
      }));
    }

    // Get area names for area statistics
    const areaIds = clientsByArea.map(a => a.areaId).filter(Boolean) as string[];
    const areas = await prisma.area.findMany({
      where: { id: { in: areaIds } },
      select: { id: true, name: true, region: { select: { name: true } } }
    });

    const areaStatistics = clientsByArea.map(stat => ({
      areaId: stat.areaId,
      areaName: areas.find(a => a.id === stat.areaId)?.name || 'Unknown',
      regionName: areas.find(a => a.id === stat.areaId)?.region.name || 'Unknown',
      count: stat._count.areaId
    }));

    // Get MR names for MR statistics
    let mrStatistics: Array<{
      mrId: string;
      mrName: string;
      mrUsername: string;
      count: number;
    }> = [];
    if (user.role !== UserRole.MR && topMRsByClients.length > 0) {
      const mrIds = topMRsByClients.map(m => m.mrId).filter(Boolean) as string[];
      const mrs = await prisma.user.findMany({
        where: { id: { in: mrIds } },
        select: { id: true, name: true, username: true }
      });

      mrStatistics = topMRsByClients.map(stat => ({
        mrId: stat.mrId,
        mrName: mrs.find(m => m.id === stat.mrId)?.name || 'Unknown',
        mrUsername: mrs.find(m => m.id === stat.mrId)?.username || 'Unknown',
        count: stat._count.mrId
      }));
    }

    // Calculate growth (comparing with previous period)
    const previousPeriodStart = new Date();
    const currentPeriodStart = new Date();
    
    if (dateFrom && dateTo) {
      const periodLength = new Date(dateTo).getTime() - new Date(dateFrom).getTime();
      previousPeriodStart.setTime(new Date(dateFrom).getTime() - periodLength);
      currentPeriodStart.setTime(new Date(dateFrom).getTime());
    } else {
      // Default to last 30 days
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 60);
      currentPeriodStart.setDate(currentPeriodStart.getDate() - 30);
    }

    const previousPeriodClients = await prisma.client.count({
      where: {
        ...whereClause,
        createdAt: {
          gte: previousPeriodStart,
          lt: currentPeriodStart
        }
      }
    });

    const currentPeriodClients = await prisma.client.count({
      where: {
        ...whereClause,
        createdAt: {
          gte: currentPeriodStart
        }
      }
    });

    const growthRate = previousPeriodClients > 0 
      ? ((currentPeriodClients - previousPeriodClients) / previousPeriodClients) * 100
      : currentPeriodClients > 0 ? 100 : 0;

    const statistics = {
      overview: {
        totalClients,
        activeClients,
        inactiveClients: totalClients - activeClients,
        recentClients,
        clientsWithBusiness: clientsWithBusinessEntries,
        clientsWithoutBusiness: totalClients - clientsWithBusinessEntries,
        activityRate: totalClients > 0 ? ((activeClients / totalClients) * 100).toFixed(2) : '0.00'
      },
      growth: {
        currentPeriodClients,
        previousPeriodClients,
        growthRate: parseFloat(growthRate.toFixed(2)),
        growthTrend: growthRate > 0 ? 'up' : growthRate < 0 ? 'down' : 'stable'
      },
      businessTypes: clientsByBusinessType.map(stat => ({
        businessType: stat.businessType,
        count: stat._count.businessType,
        percentage: totalClients > 0 ? ((stat._count.businessType / totalClients) * 100).toFixed(2) : '0.00'
      })),
      regions: regionStatistics,
      areas: areaStatistics.slice(0, 10), // Top 10 areas
      topMRs: mrStatistics.slice(0, 10), // Top 10 MRs
      filters: {
        regionId: regionId || null,
        areaId: areaId || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        userRole: user.role
      }
    };

    return successResponse(statistics);

  } catch (error) {
    logError(error, 'GET /api/clients/statistics', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch client statistics', 500);
  }
}

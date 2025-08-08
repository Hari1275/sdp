import { NextRequest } from 'next/server';
import { UserRole, BusinessType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  logError,
  rateLimit,
  parseQueryParams
} from '@/lib/api-utils';

// GET /api/clients/search - Advanced client search
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

    const { page, limit, search } = parseQueryParams(request);
    const { searchParams } = new URL(request.url);
    
    // Advanced search parameters
    const businessType = searchParams.get('businessType');
    const regionId = searchParams.get('regionId');
    const areaId = searchParams.get('areaId');
    const mrId = searchParams.get('mrId');
    const latitude = searchParams.get('latitude');
    const longitude = searchParams.get('longitude');
    const radius = parseFloat(searchParams.get('radius') || '10'); // Default 10km radius

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
        // Admin can search all clients
        break;
    }

    // Build search conditions
    const searchConditions: Array<Record<string, unknown>> = [];

    // Text search in name, phone, and address
    if (search) {
      searchConditions.push(
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      );
    }

    // Business type filter
    if (businessType && Object.values(BusinessType).includes(businessType as BusinessType)) {
      whereClause.businessType = businessType;
    }

    // Region filter (only for admin)
    if (regionId && user.role === UserRole.ADMIN) {
      whereClause.regionId = regionId;
    }

    // Area filter
    if (areaId) {
      whereClause.areaId = areaId;
    }

    // MR filter (only for admin)
    if (mrId && user.role === UserRole.ADMIN) {
      whereClause.mrId = mrId;
    }

    // Apply text search conditions
    if (searchConditions.length > 0) {
      if (whereClause.OR) {
        // If we already have OR conditions for role-based access, we need to combine them properly
        whereClause.AND = [
          { OR: whereClause.OR },
          { OR: searchConditions }
        ];
        delete whereClause.OR;
      } else {
        whereClause.OR = searchConditions;
      }
    }

    // Get clients
    const clients = await prisma.client.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true,
        businessType: true,
        address: true,
        latitude: true,
        longitude: true,
        notes: true,
        regionId: true,
        areaId: true,
        mrId: true,
        createdAt: true,
        region: {
          select: {
            id: true,
            name: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        },
        mr: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            businessEntries: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    let filteredClients = clients;

    // Apply location-based filtering if coordinates provided
    if (latitude && longitude) {
      const userLat = parseFloat(latitude);
      const userLng = parseFloat(longitude);

      filteredClients = clients.filter(client => {
        const distance = calculateDistance(
          userLat,
          userLng,
          client.latitude,
          client.longitude
        );
        return distance <= radius;
      }).sort((a, b) => {
        // Sort by distance
        const distanceA = calculateDistance(userLat, userLng, a.latitude, a.longitude);
        const distanceB = calculateDistance(userLat, userLng, b.latitude, b.longitude);
        return distanceA - distanceB;
      });
    }

    // Apply pagination to filtered results
    const total = filteredClients.length;
    const paginatedClients = filteredClients.slice((page - 1) * limit, page * limit);

    // Add distance to results if location search was performed
    const clientsWithDistance = paginatedClients.map(client => {
      if (latitude && longitude) {
        const distance = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          client.latitude,
          client.longitude
        );
        return {
          ...client,
          distance: parseFloat(distance.toFixed(2)) // Distance in kilometers
        };
      }
      return client;
    });

    const response = {
      data: clientsWithDistance,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      searchMetadata: {
        searchTerm: search || null,
        businessType: businessType || null,
        regionId: regionId || null,
        areaId: areaId || null,
        mrId: mrId || null,
        locationSearch: !!(latitude && longitude),
        radius: latitude && longitude ? radius : null
      }
    };

    return successResponse(response);
  } catch (error) {
    logError(error, 'GET /api/clients/search', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to search clients', 500);
  }
}

// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

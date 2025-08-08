import { NextRequest, NextResponse } from 'next/server';
import { UserRole, BusinessType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  hasPermission,
  errorResponse,
  logError,
  rateLimit
} from '@/lib/api-utils';

// POST /api/clients/export - Export client data
export async function POST(request: NextRequest) {
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

    // Authorization - Lead MR and Admin can export data
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to export data', 403);
    }

    const body = await request.json();
    const { 
      format = 'csv', 
      filters = {}, 
      fields = [] 
    } = body;

    // Validate format
    if (!['csv', 'excel'].includes(format)) {
      return errorResponse('INVALID_FORMAT', 'Format must be csv or excel');
    }

    // Build base query with role-based filtering
    const whereClause: Record<string, unknown> = {};

    // Apply role-based data access
    switch (user.role) {
      case UserRole.LEAD_MR:
        whereClause.OR = [
          { regionId: user.regionId },
          { mr: { leadMrId: user.id } }
        ];
        break;
      case UserRole.ADMIN:
        // Admin can export all client data
        break;
    }

    // Apply filters
    if (filters.regionId && (user.role === UserRole.ADMIN || user.regionId === filters.regionId)) {
      whereClause.regionId = filters.regionId;
    }
    if (filters.areaId) {
      whereClause.areaId = filters.areaId;
    }
    if (filters.businessType && Object.values(BusinessType).includes(filters.businessType as BusinessType)) {
      whereClause.businessType = filters.businessType;
    }
    if (filters.mrId && user.role === UserRole.ADMIN) {
      whereClause.mrId = filters.mrId;
    }
    if (filters.search) {
      whereClause.OR = [
        ...(whereClause.OR as Array<Record<string, unknown>> || []),
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    // Date range filtering
    if (filters.dateFrom || filters.dateTo) {
      whereClause.createdAt = {} as Record<string, Date>;
      if (filters.dateFrom) {
        (whereClause.createdAt as Record<string, Date>).gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        (whereClause.createdAt as Record<string, Date>).lte = new Date(filters.dateTo);
      }
    }

    // Get clients data
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
        createdAt: true,
        updatedAt: true,
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
            name: true,
            username: true
          }
        },
        _count: {
          select: {
            businessEntries: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (clients.length === 0) {
      return errorResponse('NO_DATA', 'No client data found for the specified filters');
    }

    // Determine which fields to include in export
    const defaultFields = [
      'name', 'phone', 'businessType', 'address', 'regionName', 
      'areaName', 'mrName', 'businessEntriesCount', 'createdAt'
    ];
    const exportFields = fields.length > 0 ? fields : defaultFields;

    // Transform data for export
    const exportData = clients.map((client) => {
      const row: Record<string, unknown> = {};
      
      if (exportFields.includes('id')) row['ID'] = client.id;
      if (exportFields.includes('name')) row['Client Name'] = client.name;
      if (exportFields.includes('phone')) row['Phone'] = client.phone || '';
      if (exportFields.includes('businessType')) row['Business Type'] = client.businessType;
      if (exportFields.includes('address')) row['Address'] = client.address || '';
      if (exportFields.includes('regionName')) row['Region'] = client.region.name;
      if (exportFields.includes('areaName')) row['Area'] = client.area.name;
      if (exportFields.includes('mrName')) row['Marketing Representative'] = client.mr.name;
      if (exportFields.includes('mrUsername')) row['MR Username'] = client.mr.username;
      if (exportFields.includes('businessEntriesCount')) row['Business Entries'] = client._count.businessEntries;
      if (exportFields.includes('latitude')) row['Latitude'] = client.latitude;
      if (exportFields.includes('longitude')) row['Longitude'] = client.longitude;
      if (exportFields.includes('notes')) row['Notes'] = client.notes || '';
      if (exportFields.includes('createdAt')) row['Created Date'] = client.createdAt.toISOString().split('T')[0];
      if (exportFields.includes('updatedAt')) row['Last Updated'] = client.updatedAt.toISOString().split('T')[0];
      
      return row;
    });

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `clients_export_${timestamp}.${format}`;

    if (format === 'csv') {
      // Generate CSV
      if (exportData.length === 0) {
        return errorResponse('NO_DATA', 'No data to export');
      }

      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header]?.toString() || '';
            // Escape quotes and wrap in quotes if contains comma or quote
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': csvContent.length.toString(),
        },
      });
    } else if (format === 'excel') {
      // For Excel format, we'll return JSON that can be processed by frontend
      // In a production app, you might want to use a library like ExcelJS
      return NextResponse.json({
        success: true,
        message: 'Export data prepared',
        data: {
          filename,
          format,
          records: exportData.length,
          data: exportData,
          exportedAt: new Date().toISOString(),
          filters: {
            regionId: filters.regionId || null,
            areaId: filters.areaId || null,
            businessType: filters.businessType || null,
            mrId: filters.mrId || null,
            search: filters.search || null,
            dateFrom: filters.dateFrom || null,
            dateTo: filters.dateTo || null
          }
        }
      });
    }

  } catch (error) {
    logError(error, 'POST /api/clients/export', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to export client data', 500);
  }
}

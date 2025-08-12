import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateGPSErrorData } from '@/lib/gps-validation';


export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      sessionId,
      errorType,
      errorMessage,
      errorData,
      // deviceInfo, // unused for now
      timestamp,
      // coordinates, // unused for now
    } = body;

    // Validate error data
    const errorInput = {
      sessionId,
      userId: session.user.id,
      errorType,
      errorMessage,
      errorData,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const validation = validateGPSErrorData(errorInput);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Prepare device info (omitted for now; add back when needed)
    // const _deviceData = { ...deviceInfo, userAgent, ...(coordinates && { coordinates }) };

    // Create error log entry (using a simple table structure for now)
    // In a real implementation, you'd want a dedicated errors table
    // const _errorLog = {
    //   sessionId: sessionId || null,
    //   userId: session.user.id,
    //   errorType,
    //   errorMessage,
    //   errorData: errorData ? JSON.stringify(errorData) : null,
    //   deviceInfo: deviceData ? JSON.stringify(deviceData) : null,
    //   timestamp: errorInput.timestamp,
    //   resolved: false
    // };

    // For now, we'll store errors in the database as a JSON field
    // You might want to create a dedicated GPSError model in production
  // console.log('GPS Error logged:', errorLog);

    // Try to create a temporary solution using existing models
    // This is a workaround - in production you'd want a proper error logging table
    try {
      // We can use the notification system as a temporary error log
      await prisma.notification.create({
        data: {
          title: `GPS Error: ${errorType}`,
          message: `${errorMessage}\n\nSession: ${sessionId || 'N/A'}\nUser: ${session.user.id}\nTimestamp: ${errorInput.timestamp.toISOString()}`,
          type: 'SYSTEM_ALERT',
          targetUserId: session.user.id,
          isRead: false
        }
      });
    } catch {
      // console.error('Failed to log error as notification:', _notificationError);
    }

    // Provide immediate troubleshooting suggestions
    const troubleshootingTips = generateTroubleshootingTips(errorType, errorMessage);

    return NextResponse.json({
      success: true,
      errorId: `gps_error_${Date.now()}`, // In production, use actual error ID
      message: 'GPS error logged successfully',
      troubleshooting: troubleshootingTips,
      timestamp: errorInput.timestamp,
      nextSteps: [
        'Error has been logged for investigation',
        'Continue using GPS tracking if possible',
        'Contact support if problem persists'
      ]
    }, { status: 201 });

  } catch (error) {
    console.error('GPS error logging error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to log GPS error'
      },
      { status: 500 }
    );
  }
}

// GET method to retrieve GPS errors for troubleshooting
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const errorType = searchParams.get('errorType');
    const resolved = searchParams.get('resolved');
    const limit = parseInt(searchParams.get('limit') || '50');

    // For now, retrieve from notifications as a workaround
    // In production, you'd query a proper error logging table
    const whereConditions: Record<string, unknown> = {
      type: 'SYSTEM_ALERT',
      title: { startsWith: 'GPS Error:' }
    };

    // Only admins can see all errors, users see their own
    if (session.user.role !== 'ADMIN') {
      whereConditions.targetUserId = session.user.id;
    }

    if (resolved !== null) {
      // This is a simple workaround - in production you'd have proper resolved status
      whereConditions.isRead = resolved === 'true';
    }

    const errorLogs = await prisma.notification.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200)
    });

    // Transform notifications back to error format
    const errors = errorLogs.map(log => ({
      id: log.id,
      errorType: log.title.replace('GPS Error: ', ''),
      errorMessage: log.message.split('\n')[0],
      userId: log.targetUserId || 'unknown',
      timestamp: log.createdAt,
      resolved: log.isRead,
      details: log.message
    }));

    // Generate error statistics
    const stats = {
      total: errors.length,
      resolved: errors.filter(e => e.resolved).length,
      unresolved: errors.filter(e => !e.resolved).length,
      byType: errors.reduce((acc, error) => {
        acc[error.errorType] = (acc[error.errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // Common troubleshooting guide
    const troubleshootingGuide = {
      'GPS_PERMISSION_DENIED': [
        'Check app permissions in device settings',
        'Ensure location services are enabled',
        'Restart the app and grant permissions'
      ],
      'GPS_TIMEOUT': [
        'Move to an area with better GPS signal',
        'Check if device GPS is enabled',
        'Try restarting location services'
      ],
      'GPS_ACCURACY_LOW': [
        'Move away from buildings or covered areas',
        'Wait for GPS signal to improve',
        'Check GPS settings for high accuracy mode'
      ],
      'NETWORK_ERROR': [
        'Check internet connection',
        'Try switching between WiFi and mobile data',
        'Retry the operation after network is stable'
      ],
      'SESSION_NOT_FOUND': [
        'Start a new GPS session',
        'Check if previous session was properly closed',
        'Contact support if problem persists'
      ]
    };

    return NextResponse.json({
      errors,
      stats,
      troubleshootingGuide,
      metadata: {
        totalCount: errors.length,
        filters: {
          sessionId,
          errorType,
          resolved
        },
        generatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('GPS error retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve GPS errors'
      },
      { status: 500 }
    );
  }
}

// PATCH method to mark errors as resolved (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can resolve GPS errors' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { errorIds, resolution } = body;

    if (!Array.isArray(errorIds) || errorIds.length === 0) {
      return NextResponse.json(
        { error: 'Error IDs array is required' },
        { status: 400 }
      );
    }

    // Mark notifications as read (resolved) - this is a workaround
    const updatedErrors = await prisma.notification.updateMany({
      where: {
        id: { in: errorIds },
        type: 'SYSTEM_ALERT',
        title: { startsWith: 'GPS Error:' }
      },
      data: {
        isRead: true,
        updatedAt: new Date()
      }
    });

  // console.log(`GPS errors resolved by admin ${session.user.id}:`, {
  //   errorIds,
  //   resolution,
  //   count: updatedErrors.count
  // });

    return NextResponse.json({
      success: true,
      resolvedCount: updatedErrors.count,
      resolution: resolution || 'Marked as resolved',
      resolvedBy: session.user.id,
      resolvedAt: new Date()
    });

  } catch (error) {
    console.error('GPS error resolution error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to resolve GPS errors'
      },
      { status: 500 }
    );
  }
}

// Helper function to generate troubleshooting tips
function generateTroubleshootingTips(
  errorType: string,
  errorMessage: string
): string[] {
  const tips = [];

  switch (errorType) {
    case 'GPS_PERMISSION_DENIED':
      tips.push('Enable location permissions for this app in your device settings');
      tips.push('Make sure location services are turned on');
      break;

    case 'GPS_TIMEOUT':
      tips.push('Move to an area with clear view of the sky');
      tips.push('Wait a few moments for GPS to acquire signal');
      tips.push('Ensure GPS is enabled in device settings');
      break;

    case 'GPS_ACCURACY_LOW':
      tips.push('Move away from tall buildings or covered areas');
      tips.push('Enable high-accuracy GPS mode in device settings');
      tips.push('Wait for GPS accuracy to improve');
      break;

    case 'NETWORK_ERROR':
      tips.push('Check your internet connection');
      tips.push('Try switching between WiFi and mobile data');
      tips.push('Retry after network connection is stable');
      break;

    case 'SESSION_NOT_FOUND':
      tips.push('Start a new GPS tracking session');
      tips.push('Check if previous session was properly closed');
      break;

    case 'COORDINATE_VALIDATION_FAILED':
      tips.push('GPS coordinates appear to be invalid');
      tips.push('Wait for GPS signal to improve');
      tips.push('Try restarting location services');
      break;

    case 'DATABASE_ERROR':
      tips.push('Temporary server issue - please retry');
      tips.push('Check internet connection');
      tips.push('Contact support if problem persists');
      break;

    default:
      tips.push('Try restarting the GPS tracking session');
      tips.push('Check device location settings');
      tips.push('Contact support with error details');
  }

  // Add specific tips based on error message content
  if (errorMessage.includes('accuracy')) {
    tips.push('GPS accuracy is below threshold - move to open area');
  }

  if (errorMessage.includes('timeout')) {
    tips.push('GPS signal acquisition timed out - try again in a few moments');
  }

  return tips;
}

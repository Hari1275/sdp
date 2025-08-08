/*
  Tests for POST /api/tracking/coordinates
  - rejects unauthenticated
  - rejects closed session
  - saves batch of valid coordinates and updates distance & daily summary
*/
import * as CoordinatesRoute from '@/app/api/tracking/coordinates/route';
import { makeRequest } from '../../../tests/helpers/request';
import { prisma } from '../../../__mocks__/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

// For deterministic distance, stub gps-utils
jest.mock('@/lib/gps-utils', () => ({
  calculateTotalDistance: jest.fn(() => 1.234),
  filterByAccuracy: (arr: any[]) => arr,
}));

jest.mock('@/lib/gps-validation', () => ({
  validateCoordinateData: () => ({ isValid: true, errors: [], warnings: [] }),
  sanitizeCoordinate: (c: any) => c,
}));

describe('POST /api/tracking/coordinates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when not authenticated', async () => {
const nextAuth = require('../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce(null);

    const req = makeRequest('POST', '/api/tracking/coordinates', { sessionId: 'sess', coordinates: [] });
    const res: any = await (CoordinatesRoute as any).POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects when session is closed', async () => {
    prisma.gPSSession.findUnique.mockResolvedValueOnce({ id: 'sess', userId: 'user_1', checkOut: new Date(), gpsLogs: [] });

    const req = makeRequest('POST', '/api/tracking/coordinates', { sessionId: 'sess', coordinates: [{ latitude: 1, longitude: 2, accuracy: 5 }] });
    const res: any = await (CoordinatesRoute as any).POST(req);
    expect(res.status).toBe(400);
  });

  it('saves batch and updates totals', async () => {
    prisma.gPSSession.findUnique.mockResolvedValueOnce({ id: 'sess', userId: 'user_1', checkOut: null, gpsLogs: [] });
    prisma.gPSLog.createMany.mockResolvedValueOnce({ count: 1 });
    prisma.gPSSession.update.mockResolvedValueOnce({ id: 'sess', totalKm: 1.234 });
    prisma.dailySummary.upsert.mockResolvedValueOnce({});

    const req = makeRequest('POST', '/api/tracking/coordinates', {
      sessionId: 'sess',
      coordinates: [
        { latitude: 1, longitude: 2, accuracy: 5 },
        { latitude: 1.1, longitude: 2.1, accuracy: 5 },
      ],
    });
    const res: any = await (CoordinatesRoute as any).POST(req);
    expect(prisma.gPSLog.createMany).toHaveBeenCalled();
    expect(prisma.gPSSession.update).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});


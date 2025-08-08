/*
  Tests for GET /api/tracking/live
  - rejects unauthenticated
  - returns live session data for current user
*/
import * as LiveRoute from '@/app/api/tracking/live/route';
import { makeRequest } from '../../../tests/helpers/request';
import { prisma } from '../../../__mocks__/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

// Stub calculateDistance used in movement analysis
jest.mock('@/lib/gps-utils', () => ({
  calculateDistance: () => 0.1,
}));

describe('GET /api/tracking/live', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when not authenticated', async () => {
    const nextAuth = require('../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce(null);

    const req = makeRequest('GET', '/api/tracking/live');
    const res: any = await (LiveRoute as any).GET(req);
    expect(res.status).toBe(401);
  });

  it('returns live data for active sessions', async () => {
    prisma.gPSSession.findMany.mockResolvedValueOnce([
      {
        id: 'sess',
        userId: 'user_1',
        checkIn: new Date(Date.now() - 30 * 60 * 1000),
        totalKm: 3.2,
        user: { id: 'user_1', name: 'User One', username: 'u1', role: 'MR', region: { id: 'r1', name: 'Region 1' } },
        gpsLogs: [
          { latitude: 1, longitude: 1, timestamp: new Date(), accuracy: 5, speed: 10 },
          { latitude: 1, longitude: 1, timestamp: new Date(Date.now() - 2 * 60 * 1000), accuracy: 5, speed: 12 },
        ],
        _count: { gpsLogs: 2 },
      },
    ]);

    const req = makeRequest('GET', '/api/tracking/live');
    const res: any = await (LiveRoute as any).GET(req);
    expect(prisma.gPSSession.findMany).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});


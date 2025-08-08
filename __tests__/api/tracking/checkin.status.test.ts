/*
  Tests for GET /api/tracking/checkin (status)
  - rejects unauthenticated
  - returns active session summary when one exists
*/
import * as CheckinRoute from '@/app/api/tracking/checkin/route';
import { makeRequest } from '../../../tests/helpers/request';
import { prisma } from '../../../__mocks__/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

describe('GET /api/tracking/checkin (status)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when not authenticated', async () => {
    const nextAuth = require('../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce(null);

    const req = makeRequest('GET', '/api/tracking/checkin');
    const res: any = await (CheckinRoute as any).GET(req);
    expect(res.status).toBe(401);
  });

  it('returns active session status', async () => {
    prisma.gPSSession.findFirst.mockResolvedValueOnce({
      id: 'sess_active',
      userId: 'user_1',
      checkIn: new Date(Date.now() - 60 * 60 * 1000),
      totalKm: 5.5,
      _count: { gpsLogs: 10 },
      startLat: 12.34,
      startLng: 56.78,
    });
    const req = makeRequest('GET', '/api/tracking/checkin');
    const res: any = await (CheckinRoute as any).GET(req);
    expect(prisma.gPSSession.findFirst).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});


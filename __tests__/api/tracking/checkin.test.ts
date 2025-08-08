/*
  Tests for POST /api/tracking/checkin
  - rejects unauthenticated
  - creates a new session and optional starting GPSLog
  - auto-closes unclosed previous session
*/
import * as CheckinRoute from '@/app/api/tracking/checkin/route';
import { makeRequest } from '../../../tests/helpers/request';
import { prisma } from '../../../__mocks__/prisma';

// Mock prisma and next-auth modules used by route
jest.mock('@/lib/prisma', () => ({ prisma: require('../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

describe('POST /api/tracking/checkin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when not authenticated', async () => {
    // Override getServerSession to return null
const nextAuth = require('../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce(null);

    const req = makeRequest('POST', '/api/tracking/checkin', { latitude: 10, longitude: 10, accuracy: 5 });
    const res: any = await (CheckinRoute as any).POST(req);
    expect(res.status).toBe(401);
  });

  it('creates a new session and logs start coordinate', async () => {
    // Arrange prisma mocks
    prisma.gPSSession.findMany.mockResolvedValueOnce([]); // no conflicts
    prisma.gPSSession.create.mockResolvedValueOnce({ id: 'sess_1', checkIn: new Date(), totalKm: 0 });
    prisma.gPSLog.create.mockResolvedValueOnce({ id: 'log_1' });

    const req = makeRequest('POST', '/api/tracking/checkin', { latitude: 12.34, longitude: 56.78, accuracy: 5 });
    const res: any = await (CheckinRoute as any).POST(req);

    expect(prisma.gPSSession.create).toHaveBeenCalled();
    expect(prisma.gPSLog.create).toHaveBeenCalled();
    expect(res.status).toBe(201);
  });

  it('auto-closes previous unclosed session', async () => {
    const now = new Date();
    prisma.gPSSession.findMany.mockResolvedValueOnce([
      { id: 'old', checkIn: new Date(now.getTime() - 3600_000), checkOut: null },
    ]);
    prisma.gPSSession.update.mockResolvedValueOnce({ id: 'old', checkOut: new Date(now.getTime() - 1000) });
    prisma.gPSSession.create.mockResolvedValueOnce({ id: 'sess_2', checkIn: now, totalKm: 0 });

    const req = makeRequest('POST', '/api/tracking/checkin', { latitude: 1, longitude: 2, accuracy: 5 });
    const res: any = await (CheckinRoute as any).POST(req);

    expect(prisma.gPSSession.update).toHaveBeenCalled();
    expect(res.status).toBe(201);
  });
});


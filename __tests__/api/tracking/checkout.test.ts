/*
  Tests for POST /api/tracking/checkout
  - rejects unauthenticated
  - rejects missing sessionId
  - completes checkout, appends end coordinate and updates totals
*/
import * as CheckoutRoute from '@/app/api/tracking/checkout/route';
import { makeRequest } from '../../../tests/helpers/request';
import { prisma } from '../../../__mocks__/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('@/lib/gps-validation', () => ({
  sanitizeCoordinate: (c: any) => c,
  validateSessionData: () => ({ isValid: true, errors: [], warnings: [] }),
}));

jest.mock('@/lib/gps-utils', () => ({
  calculateTotalDistance: () => 2.5,
}));

describe('POST /api/tracking/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when not authenticated', async () => {
    const nextAuth = require('../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce(null);

    const req = makeRequest('POST', '/api/tracking/checkout', { sessionId: 'sess' });
    const res: any = await (CheckoutRoute as any).POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects when sessionId missing', async () => {
    const req = makeRequest('POST', '/api/tracking/checkout', { latitude: 1, longitude: 2, accuracy: 5 });
    const res: any = await (CheckoutRoute as any).POST(req);
    expect(res.status).toBe(400);
  });

  it('completes checkout and returns summary', async () => {
    const checkIn = new Date(Date.now() - 60 * 60 * 1000);
    prisma.gPSSession.findUnique.mockResolvedValueOnce({
      id: 'sess', userId: 'user_1', checkIn, checkOut: null, totalKm: 0,
      gpsLogs: [{ latitude: 1, longitude: 2, timestamp: checkIn }], startLat: 1, startLng: 2,
    });
    prisma.gPSLog.create.mockResolvedValueOnce({ id: 'log_end' });
    prisma.gPSSession.update.mockResolvedValueOnce({ id: 'sess', checkOut: new Date(), totalKm: 2.5 });
    prisma.dailySummary.upsert.mockResolvedValueOnce({});

    const req = makeRequest('POST', '/api/tracking/checkout', { sessionId: 'sess', latitude: 1.1, longitude: 2.1, accuracy: 5 });
    const res: any = await (CheckoutRoute as any).POST(req);
    expect(prisma.gPSLog.create).toHaveBeenCalled();
    expect(prisma.gPSSession.update).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});


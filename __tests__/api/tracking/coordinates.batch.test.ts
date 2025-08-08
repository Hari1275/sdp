/*
  Tests for POST /api/tracking/coordinates/batch
  - rejects unauthenticated
  - rejects empty or too large batches
  - processes a valid batch in chunks and updates totals
*/
import * as BatchRoute from '@/app/api/tracking/coordinates/batch/route';
import { makeRequest } from '../../../../tests/helpers/request';
import { prisma } from '../../../../__mocks__/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('@/lib/gps-validation', () => ({
  validateCoordinateData: () => ({ isValid: true, errors: [], warnings: [] }),
  sanitizeCoordinate: (c: any) => c,
}));

jest.mock('@/lib/gps-utils', () => ({
  calculateTotalDistance: (coords: any[]) => coords.length > 1 ? 1.0 : 0,
  filterByAccuracy: (arr: any[]) => arr,
  compressGPSData: (arr: any[]) => arr,
}));

describe('POST /api/tracking/coordinates/batch', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when not authenticated', async () => {
    const nextAuth = require('../../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce(null);

    const req = makeRequest('POST', '/api/tracking/coordinates/batch', { sessionId: 'sess', coordinates: [{ latitude: 1, longitude: 2, accuracy: 5 }] });
    const res: any = await (BatchRoute as any).POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects empty and too-large batches', async () => {
    // empty
    let req = makeRequest('POST', '/api/tracking/coordinates/batch', { sessionId: 'sess', coordinates: [] });
    let res: any = await (BatchRoute as any).POST(req);
    expect(res.status).toBe(400);

    // too large
    const big = Array.from({ length: 5001 }, (_, i) => ({ latitude: i, longitude: i, accuracy: 5 }));
    req = makeRequest('POST', '/api/tracking/coordinates/batch', { sessionId: 'sess', coordinates: big });
    res = await (BatchRoute as any).POST(req);
    expect(res.status).toBe(413);
  });

  it('processes a valid batch and updates totals', async () => {
    prisma.gPSSession.findUnique.mockResolvedValueOnce({ id: 'sess', userId: 'user_1', checkOut: null, gpsLogs: [] });
    prisma.gPSLog.createMany.mockResolvedValue({ count: 2 });
    prisma.gPSSession.update.mockResolvedValueOnce({ id: 'sess', totalKm: 2.0 });
    prisma.dailySummary.upsert.mockResolvedValueOnce({});

    const coords = [
      { latitude: 1, longitude: 2, accuracy: 5 },
      { latitude: 1.1, longitude: 2.1, accuracy: 5 },
      { latitude: 1.2, longitude: 2.2, accuracy: 5 },
    ];

    const req = makeRequest('POST', '/api/tracking/coordinates/batch', { sessionId: 'sess', coordinates: coords });
    const res: any = await (BatchRoute as any).POST(req);

    expect(prisma.gPSLog.createMany).toHaveBeenCalled();
    expect(prisma.gPSSession.update).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});


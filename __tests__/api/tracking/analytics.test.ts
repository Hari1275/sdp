/*
  Tests for GET analytics endpoints: daily, weekly, monthly
  - rejects unauthenticated
  - returns analytics summaries (happy path)
*/
import * as Daily from '@/app/api/tracking/analytics/daily/route';
import * as Weekly from '@/app/api/tracking/analytics/weekly/route';
import * as Monthly from '@/app/api/tracking/analytics/monthly/route';
import { makeRequest } from '../../../../tests/helpers/request';
import { prisma } from '../../../../__mocks__/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('@/lib/gps-validation', () => ({
  validateAnalyticsQuery: () => ({ isValid: true, errors: [], warnings: [] }),
}));

jest.mock('@/lib/gps-analytics', () => ({
  calculateDailyGPSStats: () => ({ totalKm: 10, totalActiveHours: 2, sessions: 1, qualityScore: 0.9 }),
  calculateWeeklyGPSStats: () => ({ totalKm: 50, totalActiveHours: 12, dailyStats: Array(7).fill({ totalKm: 5, totalActiveHours: 1.7 }), weekStart: new Date(), weekEnd: new Date() }),
  calculateMonthlyGPSStats: () => ({ totalKm: 200, totalActiveHours: 40, weeklyStats: [], qualityScore: 0.85 }),
}));

describe('GET analytics endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('daily rejects unauthenticated', async () => {
    const nextAuth = require('../../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce(null);
    const req = makeRequest('GET', '/api/tracking/analytics/daily');
    const res: any = await (Daily as any).GET(req);
    expect(res.status).toBe(401);
  });

  it('daily returns analytics', async () => {
    prisma.gPSSession.findMany.mockResolvedValueOnce([]);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1', name: 'User One', username: 'u1' });

    const req = makeRequest('GET', '/api/tracking/analytics/daily?date=2025-01-01');
    const res: any = await (Daily as any).GET(req);
    expect(res.status).toBe(200);
  });

  it('weekly returns analytics', async () => {
    prisma.gPSSession.findMany.mockResolvedValueOnce([]);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1', name: 'User One', username: 'u1' });

    const req = makeRequest('GET', '/api/tracking/analytics/weekly');
    const res: any = await (Weekly as any).GET(req);
    expect(res.status).toBe(200);
  });

  it('monthly returns analytics', async () => {
    prisma.gPSSession.findMany.mockResolvedValueOnce([]);
    prisma.gPSSession.findMany.mockResolvedValueOnce([]); // previous month query
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user_1', name: 'User One', username: 'u1' });

    const req = makeRequest('GET', '/api/tracking/analytics/monthly?month=1&year=2025');
    const res: any = await (Monthly as any).GET(req);
    expect(res.status).toBe(200);
  });
});


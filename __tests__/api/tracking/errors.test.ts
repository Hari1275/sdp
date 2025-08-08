/*
  Tests for GPS error logging endpoints
  - POST logs an error (201)
  - GET retrieves errors (200)
  - PATCH resolves errors only for ADMIN
*/
import * as Errors from '@/app/api/tracking/errors/route';
import { makeRequest } from '../../../tests/helpers/request';
import { prisma } from '../../../__mocks__/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../__mocks__/prisma').prisma }));
jest.mock('next-auth', () => require('../../../__mocks__/next-auth'));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));

jest.mock('@/lib/gps-validation', () => ({
  validateGPSErrorData: () => ({ isValid: true, errors: [], warnings: [] }),
}));

describe('GPS Error endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POST /api/tracking/errors logs an error', async () => {
    prisma.notification = prisma.notification || ({} as any);
    prisma.notification.create = jest.fn().mockResolvedValue({ id: 'n1' });

    const req = makeRequest('POST', '/api/tracking/errors', { errorType: 'GPS_TIMEOUT', errorMessage: 'Timeout' });
    const res: any = await (Errors as any).POST(req);
    expect(res.status).toBe(201);
  });

  it('GET /api/tracking/errors returns list', async () => {
    prisma.notification = prisma.notification || ({} as any);
    prisma.notification.findMany = jest.fn().mockResolvedValue([
      { id: 'n1', title: 'GPS Error: GPS_TIMEOUT', message: 'Timeout', createdAt: new Date(), isRead: false, targetUserId: 'user_1' },
    ]);

    const req = makeRequest('GET', '/api/tracking/errors');
    const res: any = await (Errors as any).GET(req);
    expect(res.status).toBe(200);
  });

  it('PATCH /api/tracking/errors rejects for non-admin', async () => {
    // Change role to MR temporarily
    const nextAuth = require('../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce({ user: { id: 'user_1', role: 'MR' } });

    const req = makeRequest('PATCH', '/api/tracking/errors', { errorIds: ['n1'] });
    const res: any = await (Errors as any).PATCH(req);
    expect(res.status).toBe(403);
  });

  it('PATCH /api/tracking/errors resolves for admin', async () => {
    const nextAuth = require('../../../__mocks__/next-auth');
    nextAuth.getServerSession.mockResolvedValueOnce({ user: { id: 'admin_1', role: 'ADMIN' } });

    prisma.notification = prisma.notification || ({} as any);
    prisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 1 });

    const req = makeRequest('PATCH', '/api/tracking/errors', { errorIds: ['n1'] });
    const res: any = await (Errors as any).PATCH(req);
    expect(res.status).toBe(200);
  });
});


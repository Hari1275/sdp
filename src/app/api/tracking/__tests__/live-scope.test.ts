/* eslint-disable @typescript-eslint/no-require-imports */
// Ensure NextResponse.json uses global Response
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }) as unknown as Response,
  },
}))

import { GET } from '../live/route'
import * as prismaModule from '../../../../../__mocks__/prisma'

// Mock prisma client used by the route (sync require for Jest)
jest.mock('@/lib/prisma', () => require('../../../../../__mocks__/prisma'))

// Mutable mock for getAuthenticatedUser
const getAuthenticatedUserMock: jest.Mock<Promise<{ id: string; role: string; regionId?: string | null } | null>> = jest.fn()

// Mock api-utils minimal
jest.mock('@/lib/api-utils', () => {
  const real = jest.requireActual('@/lib/api-utils')
  return {
    ...real,
    getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
    successResponse: (data?: unknown, message?: string) => new Response(JSON.stringify({ success: true, data, message }), { status: 200, headers: { 'content-type': 'application/json' } }) as unknown as Response,
    errorResponse: (error: string, message: string, status = 400) => new Response(JSON.stringify({ success: false, error, message }), { status, headers: { 'content-type': 'application/json' } }) as unknown as Response,
  }
})

const { prisma } = prismaModule

describe('tracking live scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Lead MR filters allowed users to self + team only', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'lead-1', role: 'LEAD_MR', regionId: 'r1' })

    // Capture where used
    const findManySpy = prisma.user.findMany as jest.Mock
    findManySpy.mockResolvedValueOnce([{ id: 'lead-1' }, { id: 'mr-1' }])
    ;(prisma.gPSSession.findMany as jest.Mock).mockResolvedValueOnce([])

    const req = new Request('http://localhost:3000/api/tracking/live')
    const res = await GET(req as unknown as Request)
    expect(res.status).toBe(200)

    const callArgs = findManySpy.mock.calls[0]?.[0]
    expect(callArgs).toEqual({ where: { OR: [{ id: 'lead-1' }, { leadMrId: 'lead-1' }] }, select: { id: true, name: true, username: true } })
  })
})



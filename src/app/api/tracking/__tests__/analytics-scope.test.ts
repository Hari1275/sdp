// Mock NextResponse.json to global Response
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }) as unknown as Response,
  },
}))

import { GET as GET_DAILY } from '../analytics/daily/route'
import { GET as GET_WEEKLY } from '../analytics/weekly/route'
import { GET as GET_MONTHLY } from '../analytics/monthly/route'
import * as prismaModule from '../../../../../__mocks__/prisma'

/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/lib/prisma', () => require('../../../../../__mocks__/prisma'))

const getAuthenticatedUserMock: jest.Mock<Promise<{ id: string; role: string } | null>> = jest.fn()

jest.mock('@/lib/api-utils', () => {
  const real = jest.requireActual('@/lib/api-utils')
  return {
    ...real,
    getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  }
})

const { prisma } = prismaModule

describe('tracking analytics scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Lead MR can request self', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'lead-1', role: 'LEAD_MR' })
    ;(prisma.gPSSession.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'lead-1', name: 'Lead' })

    const res = await GET_DAILY(new Request('http://localhost:3000/api/tracking/analytics/daily?userId=lead-1') as unknown as Request)
    expect(res.status).toBe(200)
  })

  it('Lead MR can request direct team member but not others', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'lead-1', role: 'LEAD_MR' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ leadMrId: 'lead-1' })
    ;(prisma.gPSSession.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.gPSSession.findMany as jest.Mock).mockResolvedValueOnce([]) // previousWeekSessions
    const ok = await GET_WEEKLY(new Request('http://localhost:3000/api/tracking/analytics/weekly?userId=mr-1') as unknown as Request)
    expect(ok.status).toBe(200)

    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'lead-1', role: 'LEAD_MR' })
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ leadMrId: 'other-lead' })
    const forbidden = await GET_MONTHLY(new Request('http://localhost:3000/api/tracking/analytics/monthly?userId=mr-2') as unknown as Request)
    expect(forbidden.status).toBe(403)
  })
})



/* eslint-disable @typescript-eslint/no-require-imports */
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

import { POST as COORDS_POST, GET as COORDS_GET } from '../coordinates/route'
import * as prismaModule from '../../../../../__mocks__/prisma'

// Mock prisma client
jest.mock('@/lib/prisma', () => require('../../../../../__mocks__/prisma'))

// Mock api utils: we'll control getAuthenticatedUser (for POST)
const getAuthenticatedUserMock: jest.Mock<Promise<{ id: string; role: string } | null>> = jest.fn()
jest.mock('@/lib/api-utils', () => {
  const real = jest.requireActual('@/lib/api-utils')
  return {
    ...real,
    getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
  }
})

// Mock next-auth getServerSession (for GET)
const getServerSessionMock = jest.fn()
jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

const { prisma } = prismaModule

describe('tracking coordinates scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('POST allows only session owner (MR) to upload coordinates', async () => {
    // Auth as MR user-1
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'user-1', role: 'MR' })

    // Session belongs to user-1 and is open with last log
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 's1',
      userId: 'user-1',
      checkOut: null,
      gpsLogs: [{ latitude: 10, longitude: 20, timestamp: new Date() }],
    })
    ;(prisma.gPSLog.createMany as jest.Mock).mockResolvedValueOnce({ count: 2 })
    ;(prisma.gPSSession.update as jest.Mock).mockResolvedValueOnce({})
    ;(prisma.dailySummary.upsert as jest.Mock).mockResolvedValueOnce({})

    const body = {
      sessionId: 's1',
      coordinates: [
        { latitude: 10.001, longitude: 20.001, accuracy: 5, timestamp: new Date() },
        { latitude: 10.002, longitude: 20.002, accuracy: 5, timestamp: new Date() },
      ],
    }
    const reqOk = new Request('http://localhost:3000/api/tracking/coordinates', {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify(body),
    })

    const resOk = await COORDS_POST(reqOk as unknown as Request)
    expect(resOk.status).toBe(200)

    // Auth as MR user-2 (not owner) should be forbidden
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'user-2', role: 'MR' })
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 's1',
      userId: 'user-1',
      checkOut: null,
      gpsLogs: [],
    })

    const reqForbidden = new Request('http://localhost:3000/api/tracking/coordinates', {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify(body),
    })
    const resForbidden = await COORDS_POST(reqForbidden as unknown as Request)
    expect(resForbidden.status).toBe(403)
  })

  it('GET allows Admin, MR owner, and Lead MR for team sessions', async () => {
    // Prepare gps session lookup for GET: include user.leadMrId
    ;(prisma.gPSSession.findUnique as jest.Mock).mockReset()

    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      user: { leadMrId: 'lead-1' },
    })
    ;(prisma.gPSLog.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.gPSLog.count as jest.Mock).mockResolvedValueOnce(0)

    const makeGetReq = (userId: string, role: string) => {
      getServerSessionMock.mockResolvedValueOnce({ user: { id: userId, role } })
      const url = 'http://localhost:3000/api/tracking/coordinates?sessionId=s1'
      return new Request(url)
    }

    // MR owner
    let res = await COORDS_GET(makeGetReq('mr-1', 'MR') as unknown as Request)
    expect(res.status).toBe(200)

    // Admin
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      user: { leadMrId: 'lead-1' },
    })
    ;(prisma.gPSLog.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.gPSLog.count as jest.Mock).mockResolvedValueOnce(0)
    res = await COORDS_GET(makeGetReq('admin-1', 'ADMIN') as unknown as Request)
    expect(res.status).toBe(200)

    // Lead MR of team member
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      user: { leadMrId: 'lead-1' },
    })
    ;(prisma.gPSLog.findMany as jest.Mock).mockResolvedValueOnce([])
    ;(prisma.gPSLog.count as jest.Mock).mockResolvedValueOnce(0)
    res = await COORDS_GET(makeGetReq('lead-1', 'LEAD_MR') as unknown as Request)
    expect(res.status).toBe(200)

    // Lead MR not of team member -> 403
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      user: { leadMrId: 'other-lead' },
    })
    res = await COORDS_GET(makeGetReq('lead-2', 'LEAD_MR') as unknown as Request)
    expect(res.status).toBe(403)
  })
})



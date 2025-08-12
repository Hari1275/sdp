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

import { POST as BATCH_POST, GET as BATCH_GET } from '../coordinates/batch/route'
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

describe('tracking coordinates/batch scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const body = {
    sessionId: 's1',
    coordinates: [
      { latitude: 10.001, longitude: 20.001, accuracy: 5, timestamp: new Date() },
      { latitude: 10.002, longitude: 20.002, accuracy: 5, timestamp: new Date() },
    ],
  }

  function makePostReq() {
    return new Request('http://localhost:3000/api/tracking/coordinates/batch', {
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify(body),
    })
  }

  function mockOpenSession(ownerId: string, leadMrId?: string | null) {
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 's1',
      userId: ownerId,
      checkOut: null,
      user: { leadMrId: leadMrId ?? null },
      gpsLogs: [{ latitude: 10, longitude: 20, timestamp: new Date() }],
    })
    ;(prisma.gPSLog.createMany as jest.Mock).mockResolvedValueOnce({ count: body.coordinates.length })
    ;(prisma.gPSSession.update as jest.Mock).mockResolvedValueOnce({})
    ;(prisma.dailySummary.upsert as jest.Mock).mockResolvedValueOnce({})
  }

  it('POST RBAC: MR owner, Admin, Lead MR(team) allowed; unrelated Lead MR forbidden', async () => {
    // MR owner
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'mr-1', role: 'MR' })
    mockOpenSession('mr-1')
    let res = await BATCH_POST(makePostReq() as unknown as Request)
    expect(res.status).toBe(200)

    // Admin
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' })
    mockOpenSession('mr-1')
    res = await BATCH_POST(makePostReq() as unknown as Request)
    expect(res.status).toBe(200)

    // Lead MR of team
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'lead-1', role: 'LEAD_MR' })
    mockOpenSession('mr-1', 'lead-1')
    res = await BATCH_POST(makePostReq() as unknown as Request)
    expect(res.status).toBe(200)

    // Unrelated Lead MR
    getAuthenticatedUserMock.mockResolvedValueOnce({ id: 'lead-2', role: 'LEAD_MR' })
    mockOpenSession('mr-1', 'lead-1')
    res = await BATCH_POST(makePostReq() as unknown as Request)
    expect(res.status).toBe(403)
  })

  it('GET RBAC: MR owner, Admin, Lead MR(team) allowed; unrelated Lead MR forbidden', async () => {
    const makeGetReq = (userId: string, role: string) => {
      getServerSessionMock.mockResolvedValueOnce({ user: { id: userId, role } })
      const url = 'http://localhost:3000/api/tracking/coordinates/batch?sessionId=s1'
      return new Request(url)
    }

    // Owner
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      gpsLogs: [],
      _count: { gpsLogs: 0 },
    })
    let res = await BATCH_GET(makeGetReq('mr-1', 'MR') as unknown as Request)
    expect(res.status).toBe(200)

    // Admin
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      gpsLogs: [],
      _count: { gpsLogs: 0 },
    })
    res = await BATCH_GET(makeGetReq('admin-1', 'ADMIN') as unknown as Request)
    expect(res.status).toBe(200)

    // Lead MR of team
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      user: { leadMrId: 'lead-1' },
      gpsLogs: [],
      _count: { gpsLogs: 0 },
    })
    res = await BATCH_GET(makeGetReq('lead-1', 'LEAD_MR') as unknown as Request)
    expect(res.status).toBe(200)

    // Unrelated Lead MR
    ;(prisma.gPSSession.findUnique as jest.Mock).mockResolvedValueOnce({
      userId: 'mr-1',
      checkIn: new Date(),
      checkOut: null,
      user: { leadMrId: 'lead-1' },
      gpsLogs: [],
      _count: { gpsLogs: 0 },
    })
    res = await BATCH_GET(makeGetReq('lead-2', 'LEAD_MR') as unknown as Request)
    expect(res.status).toBe(403)
  })
})



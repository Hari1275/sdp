import { NextRequest, NextResponse } from 'next/server'
import { POST } from '../checkout/route'
import * as prismaModule from '../../../../../__mocks__/prisma'

// Mock prisma client used by the route
jest.mock('@/lib/prisma', () => prismaModule)

// Mutable mock for getAuthenticatedUser
const getAuthenticatedUserMock = jest.fn()

// Mock only the pieces we use from api-utils
jest.mock('@/lib/api-utils', () => {
  const real = jest.requireActual('@/lib/api-utils')
  return {
    ...real,
    getAuthenticatedUser: (...args: unknown[]) => getAuthenticatedUserMock(...args),
    errorResponse: (code: string, message?: string, status = 400) =>
      NextResponse.json({ error: code, message }, { status }),
  }
})

// Bring prisma mock into scope for configuring return values
const { prisma } = prismaModule

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/tracking/checkout')
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  }
  return new NextRequest(url, init)
}

describe('checkout auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null)

    const req = makeRequest({ sessionId: 's1', checkOut: new Date().toISOString() })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('allows checkout with JWT-authenticated mobile user', async () => {
    // Mock authenticated user
    const user = { id: 'user-1', role: 'MR' }
    getAuthenticatedUserMock.mockResolvedValueOnce(user)

    // Mock prisma session + logs
    const checkIn = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
    prisma.gPSSession.findUnique.mockResolvedValueOnce({
      id: 's1',
      userId: user.id,
      checkIn,
      checkOut: null,
      startLat: 10,
      startLng: 20,
      totalKm: 0,
      gpsLogs: [
        { latitude: 10, longitude: 20, timestamp: new Date(checkIn.getTime() + 5 * 60 * 1000) },
        { latitude: 10.1, longitude: 20.1, timestamp: new Date(checkIn.getTime() + 10 * 60 * 1000) },
      ],
    })

    prisma.gPSLog.create.mockResolvedValueOnce({})
    prisma.gPSSession.update.mockResolvedValueOnce({ id: 's1', checkOut: new Date().toISOString() })
    prisma.dailySummary.upsert.mockResolvedValueOnce({})

    const req = makeRequest(
      {
        sessionId: 's1',
        checkOut: new Date().toISOString(),
        latitude: 10.2,
        longitude: 20.2,
        accuracy: 5,
      },
      { authorization: 'Bearer test-token' }
    )

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveProperty('sessionId', 's1')
    expect(json).toHaveProperty('status', 'completed')
    expect(prisma.gPSSession.findUnique).toHaveBeenCalled()
    expect(prisma.gPSSession.update).toHaveBeenCalled()
    expect(prisma.dailySummary.upsert).toHaveBeenCalled()
  })
})



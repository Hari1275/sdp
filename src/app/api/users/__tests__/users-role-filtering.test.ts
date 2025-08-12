/* eslint-disable @typescript-eslint/no-require-imports */
// Use standard Request to avoid NextRequest polyfill issues in Jest
import { GET } from '../route'
import * as prismaModule from '../../../../../__mocks__/prisma'

// Mock prisma client used by the route
jest.mock('@/lib/prisma', () => require('../../../../../__mocks__/prisma'))

// Mutable mock for getAuthenticatedUser
const getAuthenticatedUserMock = jest.fn()

// Mock only the pieces we use from api-utils: wrap NextResponse.json to use global Response
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

function makeRequest(url: string) {
  return new Request(url)
}

describe('GET /api/users role filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('MR sees only themselves', async () => {
    const user = { id: 'mr-1', role: 'MR' }
    getAuthenticatedUserMock.mockResolvedValueOnce(user)

    prisma.user.count.mockResolvedValueOnce(1)
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'mr-1', username: 'u', name: 'Mr One', role: 'MR' },
    ])

    const res = await GET(makeRequest('http://localhost:3000/api/users'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.data).toHaveLength(1)
    expect(json.data.data[0].id).toBe('mr-1')
  })

  it('Lead MR sees themselves and team members', async () => {
    const user = { id: 'lead-1', role: 'LEAD_MR' }
    getAuthenticatedUserMock.mockResolvedValueOnce(user)

    prisma.user.count.mockResolvedValueOnce(2)
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'lead-1', username: 'lead', name: 'Lead', role: 'LEAD_MR' },
      { id: 'mr-2', username: 'mr2', name: 'Mr Two', role: 'MR', leadMrId: 'lead-1' },
    ])

    const res = await GET(makeRequest('http://localhost:3000/api/users'))
    const json = await res.json()

    expect(res.status).toBe(200)
    const ids = (json.data.data as Array<{ id: string }>).map((u) => u.id)
    expect(ids).toEqual(expect.arrayContaining(['lead-1', 'mr-2']))
  })

  it('Admin sees all', async () => {
    const user = { id: 'admin-1', role: 'ADMIN' }
    getAuthenticatedUserMock.mockResolvedValueOnce(user)

    prisma.user.count.mockResolvedValueOnce(3)
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 'admin-1', username: 'a', name: 'Admin', role: 'ADMIN' },
      { id: 'lead-1', username: 'lead', name: 'Lead', role: 'LEAD_MR' },
      { id: 'mr-2', username: 'mr2', name: 'Mr Two', role: 'MR' },
    ])

    const res = await GET(makeRequest('http://localhost:3000/api/users'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.data).toHaveLength(3)
  })
})



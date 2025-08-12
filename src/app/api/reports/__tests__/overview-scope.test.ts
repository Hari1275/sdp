/* eslint-disable @typescript-eslint/no-require-imports */
// Avoid NextRequest constructor; use standard Request
import { GET } from '../overview/route'
import * as prismaModule from '../../../../../__mocks__/prisma'

jest.mock('@/lib/prisma', () => require('../../../../../__mocks__/prisma'))

const getAuthenticatedUserMock = jest.fn()

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

function makeReq(): Request {
  return new Request('http://localhost:3000/api/reports/overview')
}

describe('reports overview scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    prisma.user.count.mockResolvedValue(0)
    prisma.client.count.mockResolvedValue(0)
    prisma.task.findMany.mockResolvedValue([])
    prisma.gPSSession.findMany.mockResolvedValue([])
  })

  it('Lead MR restricts to self and team (users query)', async () => {
    const user = { id: 'lead-1', role: 'LEAD_MR', regionId: 'r1' }
    getAuthenticatedUserMock.mockResolvedValueOnce(user)

    prisma.user.findMany.mockResolvedValueOnce([{ id: 'lead-1' }, { id: 'mr-1' }])

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: 'lead-1' }, { leadMrId: 'lead-1' }] },
      select: { id: true },
    })
  })
})



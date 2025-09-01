/* eslint-disable @typescript-eslint/no-require-imports */
// Similar test style as overview-scope.test.ts
import * as prismaModule from "../../../../../__mocks__/prisma";

// Use standard Request instead of NextRequest for tests
import { GET } from "../admin-overview/route";

jest.mock("@/lib/prisma", () => require("../../../../../__mocks__/prisma"));

const getAuthenticatedUserMock = jest.fn();

jest.mock("@/lib/api-utils", () => {
  const real = jest.requireActual("@/lib/api-utils");
  return {
    ...real,
    getAuthenticatedUser: (...args: unknown[]) =>
      getAuthenticatedUserMock(...args),
    successResponse: (data?: unknown, message?: string) =>
      new Response(JSON.stringify({ success: true, data, message }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }) as unknown as Response,
    errorResponse: (error: string, message: string, status = 400) =>
      new Response(JSON.stringify({ success: false, error, message }), {
        status,
        headers: { "content-type": "application/json" },
      }) as unknown as Response,
  };
});

const { prisma } = prismaModule;

function makeReq(): Request {
  return new Request("http://localhost:3000/api/reports/admin-overview");
}

type AnyRecord = Record<string, unknown>;

describe("Admin Overview Report API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks
    prisma.user.findMany.mockResolvedValue([]);
    prisma.gPSSession.groupBy.mockResolvedValue([]);
    prisma.businessEntry.groupBy.mockResolvedValue([]);
    prisma.client.findMany.mockResolvedValue([]);
  });

  it("requires authentication", async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("for non-admin Lead MR, scopes to self and team members only", async () => {
    const lead = { id: "lead-1", role: "LEAD_MR", regionId: "r1" };
    getAuthenticatedUserMock.mockResolvedValueOnce(lead);

    prisma.user.findMany.mockResolvedValueOnce([
      { id: "lead-1", name: "Lead", username: "lead", role: "LEAD_MR" },
      { id: "mr-1", name: "MR One", username: "mr1", role: "MR" },
    ]);

    await GET(makeReq());

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "lead-1" }, { leadMrId: "lead-1" }] },
      select: { id: true, name: true, username: true, role: true },
    });
  });

  it("aggregates per-MR totals for km, business count and amount, and joined clients", async () => {
    const admin = { id: "admin-1", role: "ADMIN" };
    getAuthenticatedUserMock.mockResolvedValueOnce(admin);

    prisma.user.findMany.mockResolvedValueOnce([
      { id: "mr-1", name: "MR One", username: "mr1", role: "MR" },
      { id: "mr-2", name: "MR Two", username: "mr2", role: "MR" },
    ]);

    prisma.gPSSession.groupBy.mockResolvedValueOnce([
      { userId: "mr-1", _sum: { totalKm: 120.5 }, _count: { userId: 3 } },
      { userId: "mr-2", _sum: { totalKm: 75 }, _count: { userId: 2 } },
    ]);

    prisma.businessEntry.groupBy.mockResolvedValueOnce([
      { mrId: "mr-1", _sum: { amount: 10000 }, _count: { mrId: 5 } },
      { mrId: "mr-2", _sum: { amount: 5000 }, _count: { mrId: 2 } },
    ]);

    prisma.client.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        name: "Client A",
        mrId: "mr-1",
        createdAt: new Date("2024-10-01"),
      },
      {
        id: "c2",
        name: "Client B",
        mrId: "mr-1",
        createdAt: new Date("2024-10-02"),
      },
      {
        id: "c3",
        name: "Client C",
        mrId: "mr-2",
        createdAt: new Date("2024-10-03"),
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as AnyRecord;
    expect(body.success).toBe(true);
    const data = body.data as AnyRecord;

    expect(Array.isArray((data as AnyRecord).mrs)).toBe(true);
    const mrs = (data as { mrs: AnyRecord[] }).mrs;
    expect(mrs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "mr-1",
          name: "MR One",
          totalKm: 120.5,
          businessEntries: 5,
          businessAmount: 10000,
          joinedClients: expect.arrayContaining([
            { id: "c1", name: "Client A", date: expect.any(String) },
            { id: "c2", name: "Client B", date: expect.any(String) },
          ]),
        }),
        expect.objectContaining({
          userId: "mr-2",
          name: "MR Two",
          totalKm: 75,
          businessEntries: 2,
          businessAmount: 5000,
          joinedClients: expect.arrayContaining([
            { id: "c3", name: "Client C", date: expect.any(String) },
          ]),
        }),
      ])
    );
  });

  it("includes Lead MR rollups with combined and per-member metrics", async () => {
    const admin = { id: "admin-1", role: "ADMIN" };
    getAuthenticatedUserMock.mockResolvedValueOnce(admin);

    prisma.user.findMany.mockResolvedValueOnce([
      { id: "lead-1", name: "Lead One", username: "lead1", role: "LEAD_MR" },
      {
        id: "mr-1",
        name: "MR One",
        username: "mr1",
        role: "MR",
        leadMrId: "lead-1",
      },
      {
        id: "mr-2",
        name: "MR Two",
        username: "mr2",
        role: "MR",
        leadMrId: "lead-1",
      },
    ]);

    prisma.gPSSession.groupBy.mockResolvedValueOnce([
      { userId: "mr-1", _sum: { totalKm: 50 }, _count: { userId: 1 } },
      { userId: "mr-2", _sum: { totalKm: 25 }, _count: { userId: 1 } },
      { userId: "lead-1", _sum: { totalKm: 10 }, _count: { userId: 1 } },
    ]);
    prisma.businessEntry.groupBy.mockResolvedValueOnce([
      { mrId: "mr-1", _sum: { amount: 5000 }, _count: { mrId: 2 } },
      { mrId: "mr-2", _sum: { amount: 2000 }, _count: { mrId: 1 } },
    ]);
    prisma.client.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        name: "Client A",
        mrId: "mr-1",
        createdAt: new Date("2024-10-01"),
      },
      {
        id: "c2",
        name: "Client B",
        mrId: "mr-2",
        createdAt: new Date("2024-10-02"),
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as AnyRecord;
    const leads = (body.data as { leads: AnyRecord[] }).leads;
    expect(Array.isArray(leads)).toBe(true);
    const lead = (leads as AnyRecord[]).find(
      (l) => (l as AnyRecord).userId === "lead-1"
    ) as AnyRecord;
    expect(lead).toBeTruthy();
    expect(
      ((lead.teamMembers as AnyRecord[]) || [])
        .map((m) => (m as AnyRecord).userId)
        .sort()
    ).toEqual(["mr-1", "mr-2"]);
    expect(lead.totalKm).toBe(85);
    expect(lead.businessEntries).toBe(3);
    expect(lead.businessAmount).toBe(7000);
  });
});

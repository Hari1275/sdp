/* eslint-disable @typescript-eslint/no-require-imports */
import { GET } from "../user-performance/route";
import * as prismaModule from "../../../../../__mocks__/prisma";

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

function makeReq(range?: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("dateFrom", range.from);
  if (range?.to) qs.set("dateTo", range.to);
  const url = `http://localhost:3000/api/reports/user-performance${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  return new Request(url);
}

describe("user-performance joined clients", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findMany.mockResolvedValue([]);
    prisma.task.groupBy.mockResolvedValue([]);
    prisma.gPSSession.groupBy.mockResolvedValue([]);
    prisma.businessEntry.groupBy.mockResolvedValue([]);
    prisma.client.findMany.mockResolvedValue([]);
  });

  it("includes joinedClients and joinedClientsCount per user", async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: "admin",
      role: "ADMIN",
    });
    prisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", name: "Alice", username: "alice", regionId: "r1" },
      { id: "u2", name: "Bob", username: "bob", regionId: "r1" },
    ]);
    prisma.client.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        name: "Client A",
        mrId: "u1",
        createdAt: new Date("2024-10-01"),
      },
      {
        id: "c2",
        name: "Client B",
        mrId: "u1",
        createdAt: new Date("2024-10-03"),
      },
      {
        id: "c3",
        name: "Client C",
        mrId: "u2",
        createdAt: new Date("2024-10-02"),
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    const rows = body.data?.data || body.data;
    expect(Array.isArray(rows)).toBe(true);
    const a = rows.find((r: any) => r.userId === "u1");
    expect(a.joinedClientsCount).toBe(2);
    expect(a.joinedClients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "c1",
          name: "Client A",
          date: expect.any(String),
        }),
        expect.objectContaining({
          id: "c2",
          name: "Client B",
          date: expect.any(String),
        }),
      ])
    );
    const b = rows.find((r: any) => r.userId === "u2");
    expect(b.joinedClientsCount).toBe(1);
  });

  it("applies date range filter to joined clients", async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce({
      id: "admin",
      role: "ADMIN",
    });
    prisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", name: "Alice", username: "alice", regionId: "r1" },
    ]);
    prisma.client.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        name: "Old Client",
        mrId: "u1",
        createdAt: new Date("2024-09-01"),
      },
      {
        id: "c2",
        name: "New Client",
        mrId: "u1",
        createdAt: new Date("2024-10-05"),
      },
    ]);

    const res = await GET(makeReq({ from: "2024-10-01", to: "2024-10-31" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    const rows = body.data?.data || body.data;
    const a = rows.find((r: any) => r.userId === "u1");
    expect(a.joinedClientsCount).toBe(1);
    expect(a.joinedClients[0].name).toBe("New Client");
  });
});

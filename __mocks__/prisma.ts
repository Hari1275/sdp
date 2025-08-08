// Simple prisma client mock with jest.fn trackers
export const prisma = {
  gPSSession: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  gPSLog: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
  dailySummary: {
    upsert: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};


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
    findMany: jest.fn(),
    count: jest.fn(),
  },
  dailySummary: {
    upsert: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  client: {
    count: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  businessEntry: {
    groupBy: jest.fn(),
  },
};


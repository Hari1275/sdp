// Mock for next-auth getServerSession
export const getServerSession = jest.fn(async () => ({
  user: { id: 'user_1', role: 'MR' },
}));

export const authOptions = {} as any;


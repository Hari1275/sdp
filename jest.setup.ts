// Jest setup for Next.js API route testing

// Mock env variables commonly used
process.env.GPS_ACCURACY_THRESHOLD = process.env.GPS_ACCURACY_THRESHOLD || '10';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Polyfill fetch/Request/Response in test environment for NextRequest
import 'whatwg-fetch';

import '@testing-library/jest-dom';

// Mock next/navigation where needed by components
jest.mock('next/navigation', () => {
  const actual = jest.requireActual('next/navigation');
  return {
    ...actual,
    usePathname: () => '/admin/tasks',
  };
});

// Ensure TaskForm sheet is open by default in tests; lightweight store mock
jest.mock('@/store/task-store', () => {
  const originalModule = jest.requireActual('@/store/task-store');
  return {
    ...originalModule,
    useTaskStore: ((selector?: any) => {
      const state = {
        tasks: [],
        isLoading: false,
        error: null,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        filters: { sortBy: 'createdAt', sortOrder: 'desc' },
        isSheetOpen: true,
        selectedTask: null,
        fetchTasks: jest.fn(),
        setFilters: jest.fn(),
        openTaskSheet: jest.fn(),
        closeTaskSheet: jest.fn(),
        assignTask: jest.fn(),
        bulkAssign: jest.fn(),
        updateStatus: jest.fn(),
        completeTask: jest.fn(),
        deleteTask: jest.fn(),
      };
      return selector ? selector(state) : state;
    }) as any,
  };
});

// Silence noisy console during tests; keep errors
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args[0] ? String(args[0]) : '';
  if (msg.includes('ExperimentalWarning')) return;
  originalWarn(...args);
};


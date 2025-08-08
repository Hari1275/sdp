// Jest setup for Next.js API route testing

// Mock env variables commonly used
process.env.GPS_ACCURACY_THRESHOLD = process.env.GPS_ACCURACY_THRESHOLD || '10';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Silence noisy console during tests; keep errors
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = args[0] ? String(args[0]) : '';
  if (msg.includes('ExperimentalWarning')) return;
  originalWarn(...args);
};


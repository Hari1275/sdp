import { rateLimit, __resetRateLimitStore } from '@/lib/api-utils'
import { makeRequest } from '../../../tests/helpers/request'

describe('rateLimit', () => {
  beforeEach(() => {
    __resetRateLimitStore();
  });

  test('limits by IP within window', () => {
    const req = makeRequest('POST', '/api/test', { a: 1 }, { 'x-forwarded-for': '10.0.0.1' });

    expect(rateLimit(req, 2, 60_000)).toBe(true);
    expect(rateLimit(req, 2, 60_000)).toBe(true);
    expect(rateLimit(req, 2, 60_000)).toBe(false);
  });

  test('composite key (ip + username) prevents shared-IP exhaustion', () => {
    const req = makeRequest('POST', '/api/test', { a: 1 }, { 'x-forwarded-for': '10.0.0.2' });

    // userA and userB share the same IP but have separate buckets
    expect(rateLimit(req, 2, 60_000, 'userA')).toBe(true);
    expect(rateLimit(req, 2, 60_000, 'userB')).toBe(true);
    expect(rateLimit(req, 2, 60_000, 'userA')).toBe(true);
    expect(rateLimit(req, 2, 60_000, 'userB')).toBe(true);

    // Third attempt each should hit limit
    expect(rateLimit(req, 2, 60_000, 'userA')).toBe(false);
    expect(rateLimit(req, 2, 60_000, 'userB')).toBe(false);
  });

  test('uses first IP from x-forwarded-for list', () => {
    const reqList = makeRequest('POST', '/api/test', { a: 1 }, { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' });
    const reqFirst = makeRequest('POST', '/api/test', { a: 1 }, { 'x-forwarded-for': '1.1.1.1' });

    expect(rateLimit(reqList, 2, 60_000)).toBe(true);
    expect(rateLimit(reqFirst, 2, 60_000)).toBe(true);
    expect(rateLimit(reqFirst, 2, 60_000)).toBe(false);
  });
});



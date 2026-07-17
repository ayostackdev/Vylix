import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the RateLimiter class logic directly
class RateLimiter {
  private _requests: Map<string, number[]> = new Map();

  constructor(
    private maxRequests: number = 20,
    private windowSeconds: number = 60
  ) {}

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowSeconds * 1000;
    const existing = this._requests.get(key) || [];
    const filtered = existing.filter((t) => t > cutoff);

    if (filtered.length >= this.maxRequests) {
      this._requests.set(key, filtered);
      return true;
    }

    filtered.push(now);
    this._requests.set(key, filtered);
    return false;
  }
}

describe('RateLimiter', () => {
  it('allows requests within limit', () => {
    const limiter = new RateLimiter(5, 60);

    for (let i = 0; i < 5; i++) {
      expect(limiter.isRateLimited('user1')).toBe(false);
    }
  });

  it('blocks requests over limit', () => {
    const limiter = new RateLimiter(3, 60);

    expect(limiter.isRateLimited('user1')).toBe(false);
    expect(limiter.isRateLimited('user1')).toBe(false);
    expect(limiter.isRateLimited('user1')).toBe(false);
    expect(limiter.isRateLimited('user1')).toBe(true);
  });

  it('tracks different keys independently', () => {
    const limiter = new RateLimiter(2, 60);

    expect(limiter.isRateLimited('user1')).toBe(false);
    expect(limiter.isRateLimited('user1')).toBe(false);
    expect(limiter.isRateLimited('user1')).toBe(true);

    expect(limiter.isRateLimited('user2')).toBe(false);
    expect(limiter.isRateLimited('user2')).toBe(false);
    expect(limiter.isRateLimited('user2')).toBe(true);
  });
});

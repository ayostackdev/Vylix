import { describe, it, expect } from 'vitest';
import { DEPARTMENTS } from '@/lib/departments';

describe('departments data', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEPARTMENTS)).toBe(true);
    expect(DEPARTMENTS.length).toBeGreaterThan(0);
  });

  it('each department has required fields', () => {
    DEPARTMENTS.forEach((dept) => {
      expect(dept).toHaveProperty('name');
      expect(dept).toHaveProperty('code');
      expect(typeof dept.name).toBe('string');
      expect(typeof dept.code).toBe('string');
    });
  });

  it('has unique codes', () => {
    const codes = DEPARTMENTS.map((d) => d.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});

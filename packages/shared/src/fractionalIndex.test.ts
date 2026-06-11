import { describe, expect, it } from 'vitest';
import { generateKeyBetween } from './fractionalIndex.js';

describe('generateKeyBetween', () => {
  it('generates key between null bounds', () => {
    const key = generateKeyBetween(null, null);
    expect(key.length).toBeGreaterThan(0);
  });

  it('inserts at head', () => {
    const first = generateKeyBetween(null, null);
    const head = generateKeyBetween(null, first);
    expect(head < first).toBe(true);
  });

  it('inserts at tail', () => {
    const first = generateKeyBetween(null, null);
    const tail = generateKeyBetween(first, null);
    expect(tail > first).toBe(true);
  });

  it('inserts between two keys 50 times without exceeding 30 chars', () => {
    let a = generateKeyBetween(null, null);
    const b = generateKeyBetween(a, null);
    for (let i = 0; i < 50; i++) {
      const mid = generateKeyBetween(a, b);
      expect(mid.length).toBeLessThanOrEqual(30);
      expect(mid > a && mid < b).toBe(true);
      a = mid;
    }
  });
});

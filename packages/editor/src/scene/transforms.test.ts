import { describe, expect, it } from 'vitest';
import { elementLocalMatrix, matApply, matInvert } from './transforms.js';

describe('transforms', () => {
  it('applies identity', () => {
    const m = elementLocalMatrix(10, 20, 100, 50, 0);
    const p = matApply(m, { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(20);
  });

  it('inverts matrix', () => {
    const m = elementLocalMatrix(10, 20, 100, 50, 0.5);
    const inv = matInvert(m);
    expect(inv).not.toBeNull();
    const p = matApply(m, { x: 50, y: 25 });
    const back = matApply(inv!, p);
    expect(back.x).toBeCloseTo(50);
    expect(back.y).toBeCloseTo(25);
  });
});

import { describe, expect, it } from 'vitest';
import { buildArrowPoints } from './arrowRouting.js';

describe('buildArrowPoints', () => {
  it('builds straight two-point arrow', () => {
    const geom = buildArrowPoints(0, 0, 100, 0, 'straight');
    expect(geom.points).toHaveLength(2);
    expect(geom.width).toBe(100);
  });

  it('builds orthogonal polyline with stubs', () => {
    const geom = buildArrowPoints(0, 0, 100, 80, 'orthogonal');
    expect(geom.points.length).toBeGreaterThanOrEqual(3);
    const last = geom.points[geom.points.length - 1];
    expect(last.x).toBeCloseTo(100, 0);
    expect(last.y).toBeCloseTo(80, 0);
  });
});

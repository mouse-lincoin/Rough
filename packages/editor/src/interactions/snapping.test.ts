import { describe, expect, it } from 'vitest';
import type { RectangleElement } from '@rough/schema';
import { computeSnapAdjust } from './snapping.js';

function makeRect(id: string, x: number, y: number, w: number, h: number): RectangleElement {
  return {
    id,
    type: 'rectangle',
    name: 'rect',
    parentId: null,
    sortKey: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: [],
    effects: [],
    semantic: null,
    roughness: 1,
    roughSeed: 1,
    cornerRadius: 0,
  };
}

describe('computeSnapAdjust', () => {
  it('snaps when edges are within threshold', () => {
    const siblings = [makeRect('a', 60, 0, 50, 50)];
    const result = computeSnapAdjust(
      { x: 55, y: 0, width: 40, height: 40 },
      siblings,
      null,
      new Set(['moving']),
      1,
      false,
    );
    expect(result.dx).not.toBe(0);
    expect(Math.abs(result.dx)).toBeLessThanOrEqual(8);
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('does not snap when outside threshold', () => {
    const siblings = [makeRect('a', 200, 0, 50, 50)];
    const result = computeSnapAdjust(
      { x: 0, y: 0, width: 40, height: 40 },
      siblings,
      null,
      new Set(['moving']),
      1,
      false,
    );
    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
  });

  it('applies grid snap when enabled', () => {
    const result = computeSnapAdjust(
      { x: 3, y: 5, width: 40, height: 40 },
      [],
      null,
      new Set(),
      1,
      true,
    );
    expect(result.dx + 3).toBe(0);
    expect(result.dy + 5).toBe(8);
  });
});

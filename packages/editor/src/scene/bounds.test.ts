import { describe, expect, it } from 'vitest';
import type { RectangleElement } from '@rough/schema';
import { SceneGraph } from './SceneGraph.js';
import { getWorldAABB } from './bounds.js';

function makeRect(x: number, y: number, w: number, h: number, rotation = 0): RectangleElement {
  return {
    id: 'r1',
    type: 'rectangle',
    name: 'rect',
    parentId: null,
    sortKey: 'a',
    x,
    y,
    width: w,
    height: h,
    rotation,
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

describe('getWorldAABB', () => {
  it('returns axis-aligned bounds for unrotated rect', () => {
    const graph = new SceneGraph();
    graph.rebuild({ r1: makeRect(10, 20, 100, 50) });
    const node = graph.getNode('r1')!;
    const aabb = getWorldAABB(node);
    expect(aabb.minX).toBeCloseTo(10);
    expect(aabb.minY).toBeCloseTo(20);
    expect(aabb.maxX).toBeCloseTo(110);
    expect(aabb.maxY).toBeCloseTo(70);
  });
});

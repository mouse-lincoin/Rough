import { describe, expect, it } from 'vitest';
import type { Element, RectangleElement } from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import { applyResize, worldDeltaToElementLocal } from './transformHandles.js';

function rect(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation = 0,
  parentId: string | null = null,
): RectangleElement {
  return {
    id,
    type: 'rectangle',
    name: id,
    parentId,
    sortKey: id,
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

describe('worldDeltaToElementLocal', () => {
  it('keeps axis-aligned delta for unrotated root element', () => {
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', 0, 0, 100, 50) });
    const node = graph.getNode('a')!;
    const local = worldDeltaToElementLocal(node, 20, 0);
    expect(local.x).toBeCloseTo(20);
    expect(local.y).toBeCloseTo(0);
  });

  it('projects world delta onto local axes for rotated root element', () => {
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', 0, 0, 100, 50, Math.PI / 2) });
    const node = graph.getNode('a')!;
    const local = worldDeltaToElementLocal(node, 0, 10);
    expect(local.x).toBeCloseTo(10, 5);
    expect(local.y).toBeCloseTo(0, 5);
  });
});

describe('applyResize on rotated local bounds', () => {
  it('widens element when dragging east handle along local x', () => {
    const start = { x: 100, y: 100, width: 80, height: 40 };
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', start.x, start.y, start.width, start.height, Math.PI / 4) });
    const node = graph.getNode('a')!;
    const localDelta = worldDeltaToElementLocal(node, 30, 0);
    const next = applyResize('e', start, localDelta.x, localDelta.y, false, false);
    expect(next.width).toBeCloseTo(80 + localDelta.x, 5);
    expect(next.height).toBeCloseTo(40, 5);
  });
});

describe('worldDeltaToElementLocal with parent frame', () => {
  it('accounts for parent rotation', () => {
    const frame = {
      ...rect('frame', 0, 0, 200, 200),
      type: 'frame' as const,
      clipsContent: true,
      background: null,
      autoLayout: null,
      preset: 'custom' as const,
    };
    const child = rect('child', 20, 20, 40, 40, 0, 'frame');
    const graph = new SceneGraph();
    graph.rebuild({ frame: frame as Element, child });
    const node = graph.getNode('child')!;
    const local = worldDeltaToElementLocal(node, 5, 0);
    expect(local.x).toBeCloseTo(5);
    expect(local.y).toBeCloseTo(0);
  });
});

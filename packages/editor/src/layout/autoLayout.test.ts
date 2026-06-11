import { describe, expect, it } from 'vitest';
import type { FrameElement, RectangleElement } from '@rough/schema';
import {
  applyLayoutToDocument,
  computeFrameContentSize,
  defaultMeasurer,
  solveLayout,
} from './autoLayout.js';

function rect(id: string, parentId: string | null, x: number, y: number, w: number, h: number): RectangleElement {
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
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: [],
    effects: [],
    semantic: null,
    roughness: 0,
    roughSeed: 0,
    cornerRadius: 0,
  };
}

function frame(id: string, w: number, h: number): FrameElement {
  const f: FrameElement = {
    id,
    type: 'frame',
    name: 'Frame',
    parentId: null,
    sortKey: id,
    x: 0,
    y: 0,
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
    roughness: 0,
    roughSeed: 0,
    clipsContent: false,
    background: null,
    preset: 'custom',
    autoLayout: {
      direction: 'horizontal',
      gap: 10,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      alignItems: 'start',
      justifyContent: 'start',
    },
  };
  return f;
}

describe('solveLayout', () => {
  it('places fixed children horizontally with gap', () => {
    const f = frame('f', 300, 100);
    const a = rect('a', 'f', 0, 0, 50, 40);
    const b = rect('b', 'f', 0, 0, 80, 40);
    const elements = { f, a, b };
    const layouts = solveLayout(f, [a, b], elements, defaultMeasurer);
    expect(layouts.get('a')).toEqual({ x: 0, y: 0, width: 50, height: 40 });
    expect(layouts.get('b')).toEqual({ x: 60, y: 0, width: 80, height: 40 });
  });

  it('distributes fill children on main axis', () => {
    const f = frame('f', 200, 60);
    const a = { ...rect('a', 'f', 0, 0, 40, 30), layoutChild: { sizingX: 'fixed' as const, sizingY: 'fixed' as const } };
    const b = { ...rect('b', 'f', 0, 0, 40, 30), layoutChild: { sizingX: 'fill' as const, sizingY: 'fixed' as const } };
    const c = { ...rect('c', 'f', 0, 0, 40, 30), layoutChild: { sizingX: 'fill' as const, sizingY: 'fixed' as const } };
    const elements = { f, a, b, c };
    const layouts = solveLayout(f, [a, b, c], elements, defaultMeasurer);
    expect(layouts.get('a')?.width).toBe(40);
    expect(layouts.get('b')?.width).toBe(70);
    expect(layouts.get('c')?.width).toBe(70);
  });

  it('stretches fill on cross axis', () => {
    const f = frame('f', 120, 80);
    const a = { ...rect('a', 'f', 0, 0, 50, 20), layoutChild: { sizingX: 'fixed' as const, sizingY: 'fill' as const } };
    const elements = { f, a };
    const layouts = solveLayout(f, [a], elements, defaultMeasurer);
    expect(layouts.get('a')?.height).toBe(80);
  });
});

describe('hug sizing', () => {
  it('computes frame hug size from children', () => {
    const f = frame('f', 10, 10);
    f.layoutChild = { sizingX: 'hug', sizingY: 'hug' };
    const a = rect('a', 'f', 0, 0, 60, 30);
    const b = rect('b', 'f', 0, 0, 40, 20);
    const elements = { f, a, b };
    const size = computeFrameContentSize(f, [a, b], elements, defaultMeasurer);
    expect(size.width).toBe(110);
    expect(size.height).toBe(30);
  });
});

describe('applyLayoutToDocument', () => {
  it('updates child positions in place', () => {
    const f = frame('f', 200, 80);
    const a = rect('a', 'f', 99, 99, 30, 20);
    const elements = { f, a };
    const updated = applyLayoutToDocument(elements);
    const child = updated.find((e) => e.id === 'a');
    expect(child?.x).toBe(0);
    expect(child?.y).toBe(0);
  });
});

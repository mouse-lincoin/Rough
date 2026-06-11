import { describe, expect, it } from 'vitest';
import type { Element, ID } from '@rough/schema';
import { canReparentTo, getSelectionRoots, isDescendantOf } from './treeUtils.js';

function rect(id: string, parentId: ID | null): Element {
  return {
    id,
    type: 'rectangle',
    name: id,
    parentId,
    sortKey: id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
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

describe('treeUtils', () => {
  const elements: Record<string, Element> = {
    frame: {
      ...rect('frame', null),
      type: 'frame',
      clipsContent: true,
      background: null,
      autoLayout: null,
      preset: 'custom',
    },
    a: rect('a', 'frame'),
    b: rect('b', 'frame'),
    c: rect('c', 'a'),
  };

  it('detects descendants', () => {
    expect(isDescendantOf(elements, 'frame', 'a')).toBe(true);
    expect(isDescendantOf(elements, 'frame', 'c')).toBe(true);
    expect(isDescendantOf(elements, 'a', 'c')).toBe(true);
    expect(isDescendantOf(elements, 'a', 'b')).toBe(false);
  });

  it('blocks reparent into own subtree', () => {
    expect(canReparentTo(elements, 'frame', 'a')).toBe(false);
    expect(canReparentTo(elements, 'frame', 'c')).toBe(false);
    expect(canReparentTo(elements, 'a', null)).toBe(true);
    expect(canReparentTo(elements, 'b', 'frame')).toBe(true);
  });

  it('returns selection roots only', () => {
    expect(getSelectionRoots(elements, ['a', 'c'])).toEqual(['a']);
    expect(getSelectionRoots(elements, ['a', 'b'])).toEqual(['a', 'b']);
  });
});

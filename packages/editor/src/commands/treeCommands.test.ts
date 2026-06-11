import { describe, expect, it } from 'vitest';
import type { DocumentStore } from '@rough/document';
import type { Element, FrameElement } from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import { matApply } from '../scene/transforms.js';
import { computeMovedElementInTree } from './treeCommands.js';

function rect(id: string, x: number, y: number, parentId: string | null, rotation = 0): Element {
  return {
    id,
    type: 'rectangle',
    name: id,
    parentId,
    sortKey: id,
    x,
    y,
    width: 100,
    height: 50,
    rotation,
    visible: true,
    locked: false,
    opacity: 1,
    fills: [],
    strokes: [],
    effects: [],
    semantic: null,
    roughness: 1,
    roughSeed: 1,
    cornerRadius: 0,
  };
}

function frame(id: string, x: number, y: number): FrameElement {
  return {
    ...rect(id, x, y, null),
    type: 'frame',
    clipsContent: true,
    background: null,
    autoLayout: null,
    preset: 'custom',
  };
}

function mockStore(elements: Record<string, Element>): DocumentStore {
  return {
    getElement: (id: string) => elements[id],
    getChildren: (parentId: string | null) =>
      Object.values(elements).filter((e) => e.parentId === parentId),
    getNextSortKey: () => 'z0',
    getSortKeyBetween: () => 'm0',
  } as unknown as DocumentStore;
}

describe('computeMovedElementInTree', () => {
  it('preserves world center when reparenting a rotated element', () => {
    const elements: Record<string, Element> = {
      f: frame('f', 0, 0),
      r: rect('r', 10, 10, 'f', Math.PI / 2),
    };
    const graph = new SceneGraph();
    graph.rebuild(elements);

    const before = graph.getNode('r')!;
    const worldCenter = matApply(before.worldMatrix, { x: 50, y: 25 });

    const moved = computeMovedElementInTree(mockStore(elements), graph, 'r', null, null);
    expect(moved).not.toBeNull();

    const afterGraph = new SceneGraph();
    afterGraph.rebuild({ f: elements.f, r: moved! });
    const after = afterGraph.getNode('r')!;
    const afterCenter = matApply(after.worldMatrix, { x: 50, y: 25 });

    expect(afterCenter.x).toBeCloseTo(worldCenter.x, 5);
    expect(afterCenter.y).toBeCloseTo(worldCenter.y, 5);
    expect(moved!.parentId).toBeNull();
  });

  it('preserves world center when moving into a frame', () => {
    const elements: Record<string, Element> = {
      f: frame('f', 200, 100),
      r: rect('r', 50, 30, null, Math.PI / 4),
    };
    const graph = new SceneGraph();
    graph.rebuild(elements);

    const worldCenter = matApply(graph.getNode('r')!.worldMatrix, { x: 50, y: 25 });

    const moved = computeMovedElementInTree(mockStore(elements), graph, 'r', 'f', null);
    expect(moved).not.toBeNull();

    const afterGraph = new SceneGraph();
    afterGraph.rebuild({ f: elements.f, r: moved! });
    const afterCenter = matApply(afterGraph.getNode('r')!.worldMatrix, { x: 50, y: 25 });

    expect(afterCenter.x).toBeCloseTo(worldCenter.x, 5);
    expect(afterCenter.y).toBeCloseTo(worldCenter.y, 5);
    expect(moved!.parentId).toBe('f');
  });
});

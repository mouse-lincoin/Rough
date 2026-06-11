import { describe, expect, it } from 'vitest';
import type { Element } from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import {
  computeAnchorDegradations,
  resolveCommentAnchorWorld,
  worldToElementLocal,
} from './commentAnchors.js';

function rect(id: string, x: number, y: number): Element {
  return {
    id,
    type: 'rectangle',
    name: id,
    parentId: null,
    sortKey: id,
    x,
    y,
    width: 100,
    height: 50,
    rotation: 0,
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

describe('commentAnchors', () => {
  it('returns stored world position when no element', () => {
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', 10, 20) });
    const world = resolveCommentAnchorWorld(graph, {
      elementId: null,
      worldX: 30,
      worldY: 40,
    });
    expect(world).toEqual({ x: 30, y: 40 });
  });

  it('transforms element-local anchor to world', () => {
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', 100, 200) });
    const world = resolveCommentAnchorWorld(graph, {
      elementId: 'a',
      worldX: 10,
      worldY: 5,
    });
    expect(world).toEqual({ x: 110, y: 205 });
  });

  it('falls back to stored coords when element missing (legacy orphan elementId)', () => {
    const graph = new SceneGraph();
    graph.rebuild({});
    const world = resolveCommentAnchorWorld(graph, {
      elementId: 'gone',
      worldX: 12,
      worldY: 34,
    });
    expect(world).toEqual({ x: 12, y: 34 });
  });

  it('degrades element-bound anchor to world position before element removal', () => {
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', 100, 200) });
    const degradations = computeAnchorDegradations(
      graph,
      [{ id: 'c1', elementId: 'a', worldX: 10, worldY: 5 }],
      new Set(['a']),
    );
    expect(degradations).toEqual([
      { id: 'c1', elementId: null, worldX: 110, worldY: 205 },
    ]);
  });

  it('ignores pins not bound to deleted elements', () => {
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', 0, 0), b: rect('b', 50, 50) });
    const degradations = computeAnchorDegradations(
      graph,
      [
        { id: 'c1', elementId: 'b', worldX: 5, worldY: 5 },
        { id: 'c2', elementId: null, worldX: 1, worldY: 2 },
      ],
      new Set(['a']),
    );
    expect(degradations).toHaveLength(0);
  });

  it('converts world click to element-local', () => {
    const graph = new SceneGraph();
    graph.rebuild({ a: rect('a', 50, 60) });
    const local = worldToElementLocal(graph, 'a', { x: 80, y: 90 });
    expect(local).toEqual({ x: 30, y: 30 });
  });
});

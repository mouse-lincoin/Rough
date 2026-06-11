import { describe, expect, it } from 'vitest';
import type { ArrowElement, RectangleElement } from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import { anchorToLocalPoint, localPointToAnchor, updateArrowEndpoints } from './arrowBinding.js';

function makeRect(id: string, x: number, y: number): RectangleElement {
  return {
    id,
    type: 'rectangle',
    name: 'rect',
    parentId: null,
    sortKey: id,
    x,
    y,
    width: 100,
    height: 80,
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

describe('arrowBinding', () => {
  it('converts anchor to local point', () => {
    const el = makeRect('r', 0, 0);
    expect(anchorToLocalPoint(el, { x: 0.5, y: 0.5 })).toEqual({ x: 50, y: 40 });
  });

  it('converts local point to anchor', () => {
    const el = makeRect('r', 0, 0);
    expect(localPointToAnchor({ x: 50, y: 40 }, el)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('updates arrow endpoint when target moves', () => {
    const target = makeRect('t', 0, 0);
    const arrow: ArrowElement = {
      id: 'a',
      type: 'arrow',
      name: 'arrow',
      parentId: null,
      sortKey: 'a',
      x: 100,
      y: 40,
      width: 50,
      height: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fills: [],
      strokes: [{ color: { r: 0, g: 0, b: 0, a: 1 }, width: 2, style: 'solid' }],
      effects: [],
      semantic: null,
      roughness: 1,
      roughSeed: 1,
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      routing: 'straight',
      startBinding: { elementId: 't', anchor: { x: 1, y: 0.5 }, gap: 4 },
      endBinding: null,
      startHead: 'none',
      endHead: 'arrow',
      label: null,
    };

    const elements = { t: target, a: arrow };
    const graph = new SceneGraph();
    graph.rebuild(elements);

    const movedTarget = { ...target, x: 50 };
    const updated = updateArrowEndpoints(arrow, graph, { ...elements, t: movedTarget });
    expect(updated.x).not.toBe(arrow.x);
  });
});

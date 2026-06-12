import { describe, expect, it } from 'vitest';
import type {
  ArrowElement,
  Element,
  EllipseElement,
  FrameElement,
  GroupElement,
  ID,
  LineElement,
  PathElement,
  PolygonElement,
  RectangleElement,
  TextElement,
} from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import { getElementCorners } from '../scene/transforms.js';
import {
  findDeepestContainerAtPoint,
  hitTestPoint,
  hitTestRect,
} from './hitTest.js';

const solidFill = [{ type: 'solid' as const, color: { r: 0, g: 0, b: 0, a: 1 } }];
const stroke = [{ color: { r: 0, g: 0, b: 0, a: 1 }, width: 2, style: 'solid' as const }];

function makeRect(
  id: ID,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Partial<RectangleElement> = {},
): RectangleElement {
  return {
    id,
    type: 'rectangle',
    name: id,
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
    ...opts,
  };
}

function makeEllipse(
  id: ID,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Partial<EllipseElement> = {},
): EllipseElement {
  return {
    id,
    type: 'ellipse',
    name: id,
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
    ...opts,
  };
}

function makePolygon(
  id: ID,
  x: number,
  y: number,
  w: number,
  h: number,
  sides = 6,
  opts: Partial<PolygonElement> = {},
): PolygonElement {
  return {
    id,
    type: 'polygon',
    name: id,
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
    sides,
    ...opts,
  };
}

function makeLine(id: ID, p0: { x: number; y: number }, p1: { x: number; y: number }): LineElement {
  return {
    id,
    type: 'line',
    name: id,
    parentId: null,
    sortKey: id,
    x: 0,
    y: 0,
    width: Math.abs(p1.x - p0.x) || 1,
    height: Math.abs(p1.y - p0.y) || 1,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: stroke,
    effects: [],
    semantic: null,
    roughness: 1,
    roughSeed: 1,
    points: [p0, p1],
  };
}

function makeArrow(id: ID, points: { x: number; y: number }[]): ArrowElement {
  return {
    id,
    type: 'arrow',
    name: id,
    parentId: null,
    sortKey: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: stroke,
    effects: [],
    semantic: null,
    roughness: 1,
    roughSeed: 1,
    points,
    routing: 'straight',
    startBinding: null,
    endBinding: null,
    startHead: 'none',
    endHead: 'arrow',
    label: null,
  };
}

function makePath(id: ID, points: { x: number; y: number }[]): PathElement {
  return {
    id,
    type: 'path',
    name: id,
    parentId: null,
    sortKey: id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: stroke,
    effects: [],
    semantic: null,
    roughness: 1,
    roughSeed: 1,
    points,
  };
}

function makeFrame(
  id: ID,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Partial<FrameElement> = {},
): FrameElement {
  return {
    id,
    type: 'frame',
    name: id,
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
    clipsContent: false,
    background: null,
    autoLayout: null,
    preset: 'custom',
    ...opts,
  };
}

function makeGroup(id: ID, x: number, y: number, w: number, h: number): GroupElement {
  return {
    id,
    type: 'group',
    name: id,
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
  };
}

function makeText(id: ID, x: number, y: number, w: number, h: number): TextElement {
  return {
    id,
    type: 'text',
    name: id,
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
    text: 'Hello',
    textStyle: {
      fontFamily: 'sans',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.2,
      textAlign: 'left',
      verticalAlign: 'top',
      color: { r: 0, g: 0, b: 0, a: 1 },
    },
    autoSize: 'fixed',
  };
}

function buildGraph(elements: Record<ID, Element>): SceneGraph {
  const graph = new SceneGraph();
  graph.rebuild(elements);
  return graph;
}

describe('hitTestPoint', () => {
  it('hits filled rectangle interior and misses outside', () => {
    const graph = buildGraph({
      r1: makeRect('r1', 0, 0, 100, 50, { fills: solidFill }),
    });
    expect(hitTestPoint(graph, { x: 50, y: 25 }, 1)?.element.id).toBe('r1');
    expect(hitTestPoint(graph, { x: -10, y: 25 }, 1)).toBeNull();
  });

  it('hits stroke-only rectangle near edge but not center', () => {
    const graph = buildGraph({
      r1: makeRect('r1', 0, 0, 100, 50, { strokes: stroke }),
    });
    expect(hitTestPoint(graph, { x: 2, y: 25 }, 1)?.element.id).toBe('r1');
    expect(hitTestPoint(graph, { x: 50, y: 25 }, 1)).toBeNull();
  });

  it('hits rotated filled rectangle via world coordinates', () => {
    const rotation = Math.PI / 2;
    const graph = buildGraph({
      r1: makeRect('r1', 0, 0, 100, 20, { fills: solidFill, rotation }),
    });
    const corners = getElementCorners(0, 0, 100, 20, rotation);
    const center = {
      x: (corners[0].x + corners[2].x) / 2,
      y: (corners[0].y + corners[2].y) / 2,
    };
    expect(hitTestPoint(graph, center, 1)?.element.id).toBe('r1');
  });

  it('hits filled ellipse interior', () => {
    const graph = buildGraph({
      e1: makeEllipse('e1', 0, 0, 80, 40, { fills: solidFill }),
    });
    expect(hitTestPoint(graph, { x: 40, y: 20 }, 1)?.element.id).toBe('e1');
    expect(hitTestPoint(graph, { x: 0, y: 0 }, 1)).toBeNull();
  });

  it('hits stroke-only ellipse near perimeter', () => {
    const graph = buildGraph({
      e1: makeEllipse('e1', 0, 0, 80, 40, { strokes: stroke }),
    });
    expect(hitTestPoint(graph, { x: 40, y: 2 }, 1)?.element.id).toBe('e1');
    expect(hitTestPoint(graph, { x: 40, y: 20 }, 1)).toBeNull();
  });

  it('hits filled polygon interior and stroke near edge', () => {
    const graph = buildGraph({
      p1: makePolygon('p1', 0, 0, 100, 100, 6, { fills: solidFill }),
    });
    expect(hitTestPoint(graph, { x: 50, y: 50 }, 1)?.element.id).toBe('p1');

    const strokeOnly = buildGraph({
      p2: makePolygon('p2', 0, 0, 100, 100, 4, { strokes: stroke }),
    });
    expect(hitTestPoint(strokeOnly, { x: 2, y: 50 }, 1)?.element.id).toBe('p2');
    expect(hitTestPoint(strokeOnly, { x: 50, y: 50 }, 1)).toBeNull();
  });

  it('hits line segment within threshold', () => {
    const graph = buildGraph({
      l1: makeLine('l1', { x: 10, y: 10 }, { x: 110, y: 10 }),
    });
    expect(hitTestPoint(graph, { x: 60, y: 12 }, 1)?.element.id).toBe('l1');
    expect(hitTestPoint(graph, { x: 60, y: 40 }, 1)).toBeNull();
  });

  it('hits arrow and path polylines', () => {
    const arrowGraph = buildGraph({
      a1: makeArrow('a1', [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
      ]),
    });
    expect(hitTestPoint(arrowGraph, { x: 50, y: 4 }, 1)?.element.id).toBe('a1');

    const pathGraph = buildGraph({
      path1: makePath('path1', [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 80, y: 80 },
      ]),
    });
    expect(hitTestPoint(pathGraph, { x: 50, y: 22 }, 1)?.element.id).toBe('path1');
  });

  it('hits frame and text bounding boxes', () => {
    const graph = buildGraph({
      f1: makeFrame('f1', 0, 0, 200, 100),
      t1: makeText('t1', 10, 10, 80, 30),
    });
    expect(hitTestPoint(graph, { x: 50, y: 50 }, 1)?.element.id).toBe('f1');
    expect(hitTestPoint(graph, { x: 30, y: 20 }, 1)?.element.id).toBe('t1');
  });

  it('skips invisible and locked elements', () => {
    const graph = buildGraph({
      hidden: makeRect('hidden', 0, 0, 100, 100, { fills: solidFill, visible: false }),
      locked: makeRect('locked', 0, 0, 100, 100, { fills: solidFill, locked: true }),
      visible: makeRect('visible', 0, 0, 100, 100, { fills: solidFill, sortKey: 'z' }),
    });
    expect(hitTestPoint(graph, { x: 50, y: 50 }, 1)?.element.id).toBe('visible');
  });

  it('prefers top-most element by sortKey in overlap', () => {
    const graph = buildGraph({
      bottom: makeRect('bottom', 0, 0, 100, 100, { fills: solidFill, sortKey: 'a' }),
      top: makeRect('top', 20, 20, 60, 60, { fills: solidFill, sortKey: 'z' }),
    });
    expect(hitTestPoint(graph, { x: 50, y: 50 }, 1)?.element.id).toBe('top');
  });

  it('hits child inside nested frame', () => {
    const graph = buildGraph({
      frame: makeFrame('frame', 0, 0, 300, 300, { sortKey: 'a' }),
      child: makeRect('child', 50, 50, 40, 40, {
        parentId: 'frame',
        fills: solidFill,
        sortKey: 'b',
      }),
    });
    expect(hitTestPoint(graph, { x: 70, y: 70 }, 1)?.element.id).toBe('child');
    expect(hitTestPoint(graph, { x: 10, y: 10 }, 1)?.element.id).toBe('frame');
  });

  it('does not hit group or instance nodes directly', () => {
    const graph = buildGraph({
      g1: makeGroup('g1', 0, 0, 100, 100),
    });
    expect(hitTestPoint(graph, { x: 50, y: 50 }, 1)).toBeNull();
  });
});

describe('findDeepestContainerAtPoint', () => {
  it('returns deepest nested frame at point', () => {
    const graph = buildGraph({
      outer: makeFrame('outer', 0, 0, 400, 400, { sortKey: 'a' }),
      inner: makeFrame('inner', 50, 50, 200, 200, { parentId: 'outer', sortKey: 'b' }),
    });
    expect(findDeepestContainerAtPoint(graph, { x: 100, y: 100 }, 1, new Set())).toBe('inner');
    expect(findDeepestContainerAtPoint(graph, { x: 10, y: 10 }, 1, new Set())).toBe('outer');
  });

  it('skips excluded ids and invisible containers', () => {
    const graph = buildGraph({
      outer: makeFrame('outer', 0, 0, 400, 400),
      inner: makeFrame('inner', 50, 50, 200, 200, { parentId: 'outer' }),
    });
    expect(
      findDeepestContainerAtPoint(graph, { x: 100, y: 100 }, 1, new Set(['inner'])),
    ).toBe('outer');

    const hidden = buildGraph({
      f1: makeFrame('f1', 0, 0, 200, 200, { visible: false }),
    });
    expect(findDeepestContainerAtPoint(hidden, { x: 50, y: 50 }, 1, new Set())).toBeNull();
  });

  it('includes group containers', () => {
    const graph = buildGraph({
      grp: makeGroup('grp', 0, 0, 200, 200),
    });
    expect(findDeepestContainerAtPoint(graph, { x: 50, y: 50 }, 1, new Set())).toBe('grp');
  });
});

describe('hitTestRect', () => {
  it('returns nodes whose world AABB intersects selection rect', () => {
    const graph = buildGraph({
      a: makeRect('a', 0, 0, 50, 50, { fills: solidFill }),
      b: makeRect('b', 100, 0, 50, 50, { fills: solidFill }),
      c: makeRect('c', 200, 0, 50, 50, { fills: solidFill, visible: false }),
    });
    const hits = hitTestRect(graph, { x: 25, y: 25, width: 100, height: 50 });
    expect(hits.map((n) => n.element.id).sort()).toEqual(['a', 'b']);
  });

  it('skips locked elements in marquee selection', () => {
    const graph = buildGraph({
      locked: makeRect('locked', 0, 0, 50, 50, { fills: solidFill, locked: true }),
    });
    expect(hitTestRect(graph, { x: 0, y: 0, width: 100, height: 100 })).toHaveLength(0);
  });
});

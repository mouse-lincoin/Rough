import type {
  Element,
  EllipseElement,
  LineElement,
  PathElement,
  RectangleElement,
} from '@rough/schema';
import { DEFAULT_FILL, DEFAULT_STROKE, createId } from '@rough/shared';

export interface ElementDefaults {
  roughness: number;
  roughSeed: number;
  sortKey: string;
}

function baseProps(defaults: ElementDefaults): Pick<
  Element,
  | 'id'
  | 'name'
  | 'parentId'
  | 'sortKey'
  | 'opacity'
  | 'visible'
  | 'locked'
  | 'fills'
  | 'strokes'
  | 'effects'
  | 'semantic'
  | 'roughness'
  | 'roughSeed'
> {
  return {
    id: createId(),
    name: '',
    parentId: null,
    sortKey: defaults.sortKey,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [{ type: 'solid', color: DEFAULT_FILL }],
    strokes: [{ color: DEFAULT_STROKE, width: 2, style: 'solid' }],
    effects: [],
    semantic: null,
    roughness: defaults.roughness,
    roughSeed: defaults.roughSeed,
  };
}

export function createRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  defaults: ElementDefaults,
): RectangleElement {
  return {
    ...baseProps(defaults),
    type: 'rectangle',
    name: '矩形',
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    rotation: 0,
    cornerRadius: 0,
  };
}

export function createEllipse(
  x: number,
  y: number,
  width: number,
  height: number,
  defaults: ElementDefaults,
): EllipseElement {
  return {
    ...baseProps(defaults),
    type: 'ellipse',
    name: '椭圆',
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    rotation: 0,
  };
}

export function createLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  defaults: ElementDefaults,
): LineElement {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  const maxX = Math.max(x1, x2);
  const maxY = Math.max(y1, y2);
  return {
    ...baseProps(defaults),
    type: 'line',
    name: '直线',
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    rotation: 0,
    points: [
      { x: x1 - minX, y: y1 - minY },
      { x: x2 - minX, y: y2 - minY },
    ],
    fills: [],
  };
}

export function createPath(points: { x: number; y: number }[], defaults: ElementDefaults): PathElement {
  if (points.length === 0) {
    throw new Error('Path requires at least one point');
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    ...baseProps(defaults),
    type: 'path',
    name: '画笔',
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    rotation: 0,
    points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
    fills: [],
  };
}

import type {
  ArrowBinding,
  ArrowElement,
  AssetRef,
  Element,
  EllipseElement,
  FrameElement,
  GroupElement,
  ID,
  ImageElement,
  LineElement,
  PathElement,
  PolygonElement,
  RectangleElement,
  TextElement,
  Vec2,
} from '@rough/schema';
import { DEFAULT_FILL, DEFAULT_STROKE, createId } from '@rough/shared';
import { buildArrowPoints } from '../interactions/arrowRouting.js';

export interface ElementDefaults {
  roughness: number;
  roughSeed: number;
  sortKey: string;
  parentId?: ID | null;
}

export const FRAME_PRESETS = {
  mobile: { width: 375, height: 812, preset: 'mobile' as const, name: 'Mobile' },
  desktop: { width: 1440, height: 900, preset: 'desktop' as const, name: 'Desktop' },
};

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
    parentId: defaults.parentId ?? null,
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

export function createFrame(
  x: number,
  y: number,
  width: number,
  height: number,
  defaults: ElementDefaults,
  preset: FrameElement['preset'] = 'custom',
): FrameElement {
  return {
    ...baseProps(defaults),
    type: 'frame',
    name: preset === 'mobile' ? 'Mobile' : preset === 'desktop' ? 'Desktop' : 'Frame',
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    rotation: 0,
    fills: [],
    clipsContent: true,
    background: null,
    autoLayout: null,
    preset,
  };
}

export function createText(
  x: number,
  y: number,
  width: number,
  height: number,
  defaults: ElementDefaults,
  autoSize: TextElement['autoSize'] = 'auto-width',
): TextElement {
  return {
    ...baseProps(defaults),
    type: 'text',
    name: '文本',
    x,
    y,
    width: Math.max(width, 1),
    height: Math.max(height, 24),
    rotation: 0,
    text: '',
    fills: [],
    strokes: [],
    textStyle: {
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.4,
      textAlign: 'left',
      verticalAlign: 'top',
      color: { r: 26, g: 26, b: 26, a: 1 },
    },
    autoSize,
  };
}

export function createPolygon(
  x: number,
  y: number,
  width: number,
  height: number,
  sides: number,
  defaults: ElementDefaults,
): PolygonElement {
  return {
    ...baseProps(defaults),
    type: 'polygon',
    name: '多边形',
    x,
    y,
    width: Math.abs(width),
    height: Math.abs(height),
    rotation: 0,
    sides: Math.max(3, Math.min(12, sides)),
  };
}

export function createArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  defaults: ElementDefaults,
  startBinding: ArrowBinding | null = null,
  endBinding: ArrowBinding | null = null,
  routing: ArrowElement['routing'] = 'orthogonal',
): ArrowElement {
  const geom = buildArrowPoints(x1, y1, x2, y2, routing);
  return {
    ...baseProps(defaults),
    type: 'arrow',
    name: '箭头',
    x: geom.x,
    y: geom.y,
    width: geom.width,
    height: geom.height,
    rotation: 0,
    points: geom.points,
    routing,
    startBinding,
    endBinding,
    startHead: 'none',
    endHead: 'arrow',
    label: null,
    fills: [],
  };
}

export function createGroup(
  x: number,
  y: number,
  width: number,
  height: number,
  defaults: ElementDefaults,
): GroupElement {
  return {
    ...baseProps(defaults),
    type: 'group',
    name: '编组',
    x,
    y,
    width,
    height,
    rotation: 0,
    fills: [],
    strokes: [],
    roughness: 0,
    roughSeed: 0,
  };
}

export function createImage(
  x: number,
  y: number,
  assetRef: AssetRef,
  naturalSize: Vec2,
  defaults: ElementDefaults,
): ImageElement {
  const scale = Math.min(1, 400 / Math.max(naturalSize.x, naturalSize.y));
  const w = naturalSize.x * scale;
  const h = naturalSize.y * scale;
  return {
    ...baseProps(defaults),
    type: 'image',
    name: '图片',
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    fills: [],
    assetId: assetRef.id,
    naturalSize,
  };
}

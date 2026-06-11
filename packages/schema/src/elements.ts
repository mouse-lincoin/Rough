import type { AutoLayout } from './styles.js';

export type ID = string;

export interface Vec2 {
  x: number;
  y: number;
}

export type RGBA = { r: number; g: number; b: number; a: number };

export type FractionalIndex = string;

export type FillStyle =
  | { type: 'solid'; color: RGBA }
  | { type: 'hachure'; color: RGBA; gap: number; angle: number }
  | { type: 'image'; assetId: ID; mode: 'fill' | 'fit' | 'tile' };

export interface Stroke {
  color: RGBA;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
}

export type Effect =
  | { type: 'drop-shadow'; offset: Vec2; blur: number; color: RGBA }
  | { type: 'layer-blur'; radius: number };

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 700;
  lineHeight: number;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  color: RGBA;
}

export type ElementType =
  | 'frame'
  | 'group'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'line'
  | 'arrow'
  | 'path'
  | 'text'
  | 'image'
  | 'instance';

export type SemanticTag =
  | 'page'
  | 'navbar'
  | 'sidebar'
  | 'tabs'
  | 'breadcrumb'
  | 'button'
  | 'input'
  | 'select'
  | 'switch'
  | 'checkbox'
  | 'search'
  | 'card'
  | 'table'
  | 'list'
  | 'list-item'
  | 'avatar'
  | 'image-placeholder'
  | 'badge'
  | 'modal'
  | 'toast'
  | 'empty-state'
  | 'chart-line'
  | 'chart-bar'
  | 'chart-pie'
  | 'heading'
  | 'paragraph'
  | 'label'
  | 'divider'
  | 'icon'
  | 'annotation';

export interface LayoutChild {
  sizingX: 'fixed' | 'hug' | 'fill';
  sizingY: 'fixed' | 'hug' | 'fill';
}

export interface BaseElement {
  id: ID;
  type: ElementType;
  name: string;
  parentId: ID | null;
  sortKey: FractionalIndex;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  fills: FillStyle[];
  strokes: Stroke[];
  effects: Effect[];
  semantic: SemanticTag | null;
  roughness: number;
  roughSeed: number;
  layoutChild?: LayoutChild;
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  clipsContent: boolean;
  background: RGBA | null;
  autoLayout: AutoLayout | null;
  preset: 'mobile' | 'desktop' | 'custom';
}

export interface GroupElement extends BaseElement {
  type: 'group';
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  cornerRadius: number | [number, number, number, number];
}

export interface EllipseElement extends BaseElement {
  type: 'ellipse';
}

export interface PolygonElement extends BaseElement {
  type: 'polygon';
  sides: number;
}

export interface LineElement extends BaseElement {
  type: 'line';
  points: [Vec2, Vec2];
}

export interface ArrowBinding {
  elementId: ID;
  anchor: Vec2;
  gap: number;
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  points: Vec2[];
  routing: 'straight' | 'orthogonal' | 'curved';
  startBinding: ArrowBinding | null;
  endBinding: ArrowBinding | null;
  startHead: 'none' | 'arrow' | 'dot';
  endHead: 'none' | 'arrow' | 'dot';
  label: string | null;
}

export interface PathElement extends BaseElement {
  type: 'path';
  points: Vec2[];
  pressure?: number[];
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  textStyle: TextStyle;
  autoSize: 'auto-width' | 'auto-height' | 'fixed';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: ID;
  naturalSize: Vec2;
}

export interface InstanceElement extends BaseElement {
  type: 'instance';
  componentId: ID;
  overrides: Record<string, Partial<OverridableProps>>;
}

export type OverridableProps = {
  text: string;
  fills: FillStyle[];
  strokes: Stroke[];
  visible: boolean;
  opacity: number;
};

export type Element =
  | FrameElement
  | GroupElement
  | RectangleElement
  | EllipseElement
  | PolygonElement
  | LineElement
  | ArrowElement
  | PathElement
  | TextElement
  | ImageElement
  | InstanceElement;

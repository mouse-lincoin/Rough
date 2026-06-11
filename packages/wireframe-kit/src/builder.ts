import type {
  ComponentDef,
  Element,
  FrameElement,
  ID,
  LineElement,
  RGBA,
  RectangleElement,
  SemanticTag,
  Stroke,
  TextElement,
  TextStyle,
} from '@rough/schema';
import { createId } from '@rough/shared';
import { ACCENT, FILL_LIGHT, STROKE, SURFACE, TEXT_BODY } from './styles.js';

export { TEXT_BODY, TEXT_HEADING, TEXT_SMALL } from './styles.js';

let sortCounter = 0;

function nextSortKey(): string {
  sortCounter += 1;
  return `k${sortCounter.toString().padStart(4, '0')}`;
}

function baseProps<T extends Element['type']>(
  id: ID,
  type: T,
  name: string,
  parentId: ID | null,
): Pick<
  Element,
  | 'id'
  | 'type'
  | 'name'
  | 'parentId'
  | 'sortKey'
  | 'opacity'
  | 'visible'
  | 'locked'
  | 'effects'
  | 'semantic'
  | 'roughness'
  | 'roughSeed'
> & { type: T } {
  return {
    id,
    type,
    name,
    parentId,
    sortKey: nextSortKey(),
    opacity: 1,
    visible: true,
    locked: false,
    effects: [],
    semantic: null,
    roughness: 1,
    roughSeed: Math.floor(Math.random() * 2 ** 31),
  };
}

export function kitFrame(
  id: ID,
  name: string,
  parentId: ID | null,
  x: number,
  y: number,
  w: number,
  h: number,
  semantic: SemanticTag | null = null,
): FrameElement {
  return {
    ...baseProps(id, 'frame', name, parentId),
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    fills: [],
    strokes: [STROKE],
    semantic,
    clipsContent: false,
    background: null,
    autoLayout: null,
    preset: 'custom',
  };
}

export function kitRect(
  id: ID,
  name: string,
  parentId: ID | null,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: RGBA = SURFACE,
  semantic: SemanticTag | null = null,
): RectangleElement {
  return {
    ...baseProps(id, 'rectangle', name, parentId),
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    fills: [{ type: 'solid', color: fill }],
    strokes: [STROKE],
    semantic,
    cornerRadius: 4,
  };
}

export function kitText(
  id: ID,
  name: string,
  parentId: ID | null,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  style: TextStyle = TEXT_BODY,
  semantic: SemanticTag | null = null,
): TextElement {
  return {
    ...baseProps(id, 'text', name, parentId),
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    text,
    fills: [],
    strokes: [],
    textStyle: style,
    autoSize: 'fixed',
    semantic,
  };
}

export function kitEllipse(
  id: ID,
  name: string,
  parentId: ID | null,
  x: number,
  y: number,
  size: number,
  fill: RGBA = FILL_LIGHT,
): Element {
  return {
    ...baseProps(id, 'ellipse', name, parentId),
    x,
    y,
    width: size,
    height: size,
    rotation: 0,
    fills: [{ type: 'solid', color: fill }],
    strokes: [STROKE],
  };
}

export function kitLine(
  id: ID,
  parentId: ID | null,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: Stroke = STROKE,
): LineElement {
  const minX = Math.min(x1, x2);
  const minY = Math.min(y1, y2);
  return {
    ...baseProps(id, 'line', '线', parentId),
    x: minX,
    y: minY,
    width: Math.max(Math.abs(x2 - x1), 1),
    height: Math.max(Math.abs(y2 - y1), 1),
    rotation: 0,
    fills: [],
    strokes: [stroke],
    points: [
      { x: x1 - minX, y: y1 - minY },
      { x: x2 - minX, y: y2 - minY },
    ],
  };
}

export function makeComponentDef(
  name: string,
  semantic: SemanticTag | null,
  root: FrameElement,
  children: Element[],
): ComponentDef {
  const elements: Record<ID, Element> = { [root.id]: root };
  for (const c of children) elements[c.id] = c;
  return {
    id: createId(),
    name,
    description: `线框组件: ${name}`,
    rootId: root.id,
    elements,
    semantic,
  };
}

export { ACCENT, FILL_LIGHT, SURFACE };

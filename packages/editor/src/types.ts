import type { ID, Vec2 } from '@rough/schema';

export type ToolName =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'pen';

export interface NormalizedPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup';
  world: Vec2;
  screen: Vec2;
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  pointerId: number;
  originalEvent: PointerEvent;
}

export interface EditorCallbacks {
  onSelectionChange?: (ids: Set<ID>) => void;
  onToolChange?: (tool: ToolName) => void;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

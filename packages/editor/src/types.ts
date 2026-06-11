import type { ID, Vec2 } from '@rough/schema';

export type ToolName =
  | 'select'
  | 'hand'
  | 'frame'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'line'
  | 'arrow'
  | 'pen'
  | 'text'
  | 'comment';

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

export interface CommentPin {
  id: ID;
  pageId: ID;
  elementId: ID | null;
  worldX: number;
  worldY: number;
  authorName: string | null;
  resolved: boolean;
}

export interface EditorCallbacks {
  onSelectionChange?: (ids: Set<ID>) => void;
  onToolChange?: (tool: ToolName) => void;
  onDocumentChange?: () => void;
  onPageChange?: (pageId: ID) => void;
  onPanelsToggle?: (visible: boolean) => void;
  onExportRequest?: () => void;
  onShortcutsRequest?: () => void;
  onThumbnailUpdated?: () => void;
  onCommentPlace?: (anchor: {
    pageId: ID;
    worldX: number;
    worldY: number;
    elementId: ID | null;
  }) => void;
  onCommentPinClick?: (commentId: ID, screen: Vec2) => void;
}

export interface ExportContext {
  pageId: ID;
  selectionIds: ID[];
  exportTargetIds: ID[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

import type { Editor } from '@rough/editor';
import {
  AddElementCommand,
  UpdateElementsCommand,
  UpdateInstanceOverrideCommand,
  UpdateComponentCommand,
  shadowId,
  getRotatedWorldCorners,
  getHandlePositions,
  hitTestHandle,
  applyResize,
  worldDeltaToElementLocal,
  type HandleType,
} from '@rough/editor';
import { createRectangle, createFrame, createArrow } from '@rough/editor';
import { createKitComponent } from '@rough/wireframe-kit';

const HANDLE_TYPES: HandleType[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function attachE2EBridge(editor: Editor): void {
  (window as unknown as { __ROUGH_E2E__?: Record<string, unknown> }).__ROUGH_E2E__ = {
    AddElementCommand,
    UpdateElementsCommand,
    UpdateInstanceOverrideCommand,
    UpdateComponentCommand,
    createRectangle,
    createFrame,
    createArrow,
    createKitComponent,
    shadowId,
    editor,
    waitForCollabSynced: (timeoutMs?: number) => editor.document.waitForCollabSynced(timeoutMs),
    getTransformHandleScreen: (elementId: string, handle: HandleType) => {
      const node = editor.sceneGraph.getNode(elementId);
      if (!node) return null;
      const corners = getRotatedWorldCorners(node).map((c) => editor.viewport.worldToScreen(c));
      const positions = getHandlePositions(corners);
      const idx = HANDLE_TYPES.indexOf(handle);
      if (idx < 0) return null;
      return positions[idx];
    },
    hitTransformHandle: (elementId: string, screen: { x: number; y: number }) => {
      const node = editor.sceneGraph.getNode(elementId);
      if (!node) return null;
      const corners = getRotatedWorldCorners(node).map((c) => editor.viewport.worldToScreen(c));
      return hitTestHandle(screen, corners);
    },
    applyRotatedResize: (
      elementId: string,
      handle: HandleType,
      worldDx: number,
      worldDy: number,
    ) => {
      const node = editor.sceneGraph.getNode(elementId);
      const el = editor.document.getElement(elementId);
      if (!node || !el) return null;
      const localDelta = worldDeltaToElementLocal(node, worldDx, worldDy);
      const start = { x: el.x, y: el.y, width: el.width, height: el.height };
      return applyResize(handle, start, localDelta.x, localDelta.y, false, false);
    },
    getTransformHandleDrag: (elementId: string, handle: HandleType, distance: number) => {
      const node = editor.sceneGraph.getNode(elementId);
      if (!node) return null;
      const worldCorners = getRotatedWorldCorners(node);
      const screenCorners = worldCorners.map((c) => editor.viewport.worldToScreen(c));
      const positions = getHandlePositions(screenCorners);
      const idx = HANDLE_TYPES.indexOf(handle);
      if (idx < 0) return null;
      const start = positions[idx];
      const center = editor.viewport.worldToScreen({
        x: (worldCorners[0].x + worldCorners[2].x) / 2,
        y: (worldCorners[0].y + worldCorners[2].y) / 2,
      });
      const dx = start.x - center.x;
      const dy = start.y - center.y;
      const len = Math.hypot(dx, dy) || 1;
      return {
        start,
        end: { x: start.x + (dx / len) * distance, y: start.y + (dy / len) * distance },
      };
    },
  };
}

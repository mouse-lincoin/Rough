import type { Element, ID, TextElement } from '@rough/schema';
import type { EditorContext } from '../../EditorContext.js';
import {
  DeleteElementsCommand,
  UpdateElementsCommand,
} from '../../commands/ElementCommands.js';
import { ReorderAutoLayoutCommand } from '../../commands/layoutCommands.js';
import {
  applyLayoutToDocument,
  computeLayoutInsertBefore,
  computeLayoutInsertLine,
  reorderAutoLayoutChildren,
} from '../../layout/autoLayout.js';
import { findDeepestContainerAtPoint, hitTestPoint, hitTestRect } from '../../interactions/hitTest.js';
import { collectSubtree } from '../../clipboard/clipboard.js';
import { getSelectionRoots } from '../../interactions/treeUtils.js';
import {
  applyResize,
  elementLocalBounds,
  hitTestHandle,
  worldDeltaToElementLocal,
  type HandleType,
} from '../../interactions/transformHandles.js';
import {
  aabbToRect,
  getRotatedWorldCorners,
  getWorldAABB,
  mergeAABB,
  worldToLocal,
} from '../../scene/bounds.js';
import { matApply } from '../../scene/transforms.js';
import { duplicateElements } from '../../clipboard/clipboard.js';
import { computeSnapAdjust } from '../../interactions/snapping.js';
import type { NormalizedPointerEvent, Rect } from '../../types.js';
import type { Tool } from './BaseTool.js';
import type { EditorHost } from '../../EditorContext.js';

type DragMode = 'move' | 'resize' | 'rotate' | 'marquee' | null;

export class SelectTool implements Tool {
  readonly name = 'select';
  private mode: DragMode = null;
  private dragStartWorld = { x: 0, y: 0 };
  private beforeSnapshots: Element[] = [];
  private activeHandle: HandleType | null = null;
  private startBounds = { x: 0, y: 0, width: 0, height: 0 };
  private rotateCenterWorld = { x: 0, y: 0 };
  private startRotation = 0;
  private marqueeRect: Rect | null = null;
  private marqueeAdditive = false;
  private lastWorld = { x: 0, y: 0 };
  private multiResize = false;
  private startMergedBounds = { x: 0, y: 0, width: 0, height: 0 };
  private layoutReorder: { frameId: ID; draggedIds: ID[] } | null = null;
  private layoutBeforeSiblingId: ID | null = null;
  private initialLayoutBeforeSiblingId: ID | null = null;
  constructor(
    private ctx: EditorContext,
    private host?: EditorHost & {
      getGridSnap?: () => boolean;
      setSnapGuides?: (guides: import('../../interactions/snapping.js').SnapGuide[]) => void;
      setDropTargetFrame?: (frameId: import('@rough/schema').ID | null) => void;
      setLayoutInsertLine?: (line: { start: import('@rough/schema').Vec2; end: import('@rough/schema').Vec2 } | null) => void;
      reparentElementsAtDrop?: (ids: import('@rough/schema').ID[], world: import('@rough/schema').Vec2) => void;
      enterDeepSelection?: (instanceId: import('@rough/schema').ID) => void;
      getDeepInstanceId?: () => import('@rough/schema').ID | null;
    },
  ) {}

  getMarqueeRect(): Rect | null {
    return this.marqueeRect;
  }

  onDoubleClick(e: NormalizedPointerEvent): void {
    const hit = hitTestPoint(
      this.ctx.sceneGraph,
      e.world,
      this.ctx.viewport.zoom,
      this.host?.getDeepInstanceId?.() ?? null,
    );
    if (!hit) return;

    if (hit.element.type === 'instance' && !this.host?.getDeepInstanceId?.()) {
      this.host?.enterDeepSelection?.(hit.element.id);
      return;
    }

    if (hit.isShadow && hit.shadowMeta) {
      this.ctx.selection.select([hit.element.id]);
      if (hit.element.type === 'text') {
        this.ctx.startTextEditing(hit.element);
      }
      return;
    }

    if (hit.element.type === 'text') {
      this.ctx.selection.select([hit.element.id]);
      this.ctx.startTextEditing(hit.element);
    }
  }

  private getSelectionScreenCorners(ids: ID[]): import('@rough/schema').Vec2[] | null {
    const nodes = ids
      .map((id) => this.ctx.sceneGraph.getNode(id))
      .filter((n): n is NonNullable<typeof n> => n !== undefined);
    if (nodes.length === 0) return null;

    if (nodes.length === 1 && nodes[0].element.rotation !== 0) {
      return getRotatedWorldCorners(nodes[0]).map((c) => this.ctx.viewport.worldToScreen(c));
    }

    let aabb = getWorldAABB(nodes[0]);
    for (let i = 1; i < nodes.length; i++) {
      aabb = mergeAABB(aabb, getWorldAABB(nodes[i]));
    }
    const rect = aabbToRect(aabb);
    const tl = this.ctx.viewport.worldToScreen({ x: rect.x, y: rect.y });
    const br = this.ctx.viewport.worldToScreen({ x: rect.x + rect.width, y: rect.y + rect.height });
    return [
      tl,
      { x: br.x, y: tl.y },
      br,
      { x: tl.x, y: br.y },
    ];
  }

  onPointerDown(e: NormalizedPointerEvent): void {
    const selected = this.ctx.selection.getIds();
    if (selected.length >= 1) {
      const screenCorners = this.getSelectionScreenCorners(selected);
      if (screenCorners) {
        const handle = hitTestHandle(e.screen, screenCorners);
        if (handle) {
          this.mode = handle === 'rotate' ? 'rotate' : 'resize';
          this.activeHandle = handle;
          this.beforeSnapshots = selected
            .map((id) => this.ctx.document.getElement(id))
            .filter((el): el is Element => el !== undefined)
            .map((el) => structuredClone(el));
          this.multiResize = selected.length > 1;
          if (this.multiResize) {
            this.startMergedBounds = computeMergedLocalBounds(this.beforeSnapshots);
            this.startBounds = { ...this.startMergedBounds };
          } else {
            const node = this.ctx.sceneGraph.getNode(selected[0])!;
            this.startBounds = elementLocalBounds(node.element);
            this.startRotation = node.element.rotation;
            const worldCorners = getRotatedWorldCorners(node);
            this.rotateCenterWorld = {
              x: (worldCorners[0].x + worldCorners[2].x) / 2,
              y: (worldCorners[0].y + worldCorners[2].y) / 2,
            };
          }
          this.dragStartWorld = { ...e.world };
          if (this.mode === 'resize') {
            this.ctx.setResizingIds(new Set(selected));
          }
          return;
        }
      }
    }

    const hit = hitTestPoint(
      this.ctx.sceneGraph,
      e.world,
      this.ctx.viewport.zoom,
      this.host?.getDeepInstanceId?.() ?? null,
    );
    if (hit?.element.type === 'instance' && !this.host?.getDeepInstanceId?.()) {
      if (e.shiftKey) {
        this.ctx.selection.toggle(hit.element.id);
      } else if (!this.ctx.selection.isSelected(hit.element.id)) {
        this.ctx.selection.select([hit.element.id]);
      }
      this.beginMove(e);
      return;
    }

    if (hit) {
      if (e.shiftKey) {
        this.ctx.selection.toggle(hit.element.id);
      } else if (!this.ctx.selection.isSelected(hit.element.id)) {
        this.ctx.selection.select([hit.element.id]);
      }
      this.beginMove(e);
      return;
    }

    if (!e.shiftKey) {
      this.ctx.selection.clear();
    }
    this.mode = 'marquee';
    this.marqueeAdditive = e.shiftKey;
    this.dragStartWorld = { ...e.world };
    this.marqueeRect = { x: e.world.x, y: e.world.y, width: 0, height: 0 };
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.mode) return;
    this.lastWorld = { ...e.world };

    if (this.mode === 'marquee') {
      const x = Math.min(this.dragStartWorld.x, e.world.x);
      const y = Math.min(this.dragStartWorld.y, e.world.y);
      const width = Math.abs(e.world.x - this.dragStartWorld.x);
      const height = Math.abs(e.world.y - this.dragStartWorld.y);
      this.marqueeRect = { x, y, width, height };
      this.ctx.requestRender();
      return;
    }

    const dx = e.world.x - this.dragStartWorld.x;
    const dy = e.world.y - this.dragStartWorld.y;

    if (this.mode === 'move' && this.layoutReorder) {
      const frame = this.ctx.document.getElement(this.layoutReorder.frameId);
      const frameNode = this.ctx.sceneGraph.getNode(this.layoutReorder.frameId);
      if (frame?.type === 'frame' && frame.autoLayout && frameNode) {
        const localPoint = worldToLocal(frameNode.worldMatrix, e.world) ?? e.world;
        const siblings = this.ctx.document.getChildren(this.layoutReorder.frameId);
        const draggedSet = new Set(this.layoutReorder.draggedIds);
        this.layoutBeforeSiblingId = computeLayoutInsertBefore(
          frame,
          siblings,
          draggedSet,
          localPoint,
        );
        const lineLocal = computeLayoutInsertLine(
          frame,
          siblings,
          this.layoutBeforeSiblingId,
          draggedSet,
        );
        if (lineLocal) {
          this.host?.setLayoutInsertLine?.({
            start: matApply(frameNode.worldMatrix, lineLocal.start),
            end: matApply(frameNode.worldMatrix, lineLocal.end),
          });
        } else {
          this.host?.setLayoutInsertLine?.(null);
        }

        const elements = this.ctx.document.getElements();
        const reordered = reorderAutoLayoutChildren(
          elements,
          this.layoutReorder.frameId,
          this.layoutReorder.draggedIds,
          this.layoutBeforeSiblingId,
          this.ctx.document,
        );
        if (reordered.length > 0) {
          const merged = { ...elements };
          for (const el of reordered) merged[el.id] = el;
          const layoutUpdates = applyLayoutToDocument(merged);
          this.ctx.updateElementsLive([...reordered, ...layoutUpdates]);
        }
      }
      return;
    }

    if (this.mode === 'move') {
      let snapDx = dx;
      let snapDy = dy;
      const gridSnap = this.host?.getGridSnap?.() ?? false;

      if (this.beforeSnapshots.length > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of this.beforeSnapshots) {
          minX = Math.min(minX, el.x + dx);
          minY = Math.min(minY, el.y + dy);
          maxX = Math.max(maxX, el.x + el.width + dx);
          maxY = Math.max(maxY, el.y + el.height + dy);
        }
        const parentId = this.beforeSnapshots[0].parentId;
        const siblings = this.ctx.document.getChildren(parentId);
        const excludeIds = new Set(this.beforeSnapshots.map((e) => e.id));
        let parentBounds = null;
        if (parentId) {
          const parent = this.ctx.document.getElement(parentId);
          if (parent) {
            parentBounds = { minX: 0, minY: 0, maxX: parent.width, maxY: parent.height };
          }
        }
        const snap = computeSnapAdjust(
          { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          siblings,
          parentBounds,
          excludeIds,
          this.ctx.viewport.zoom,
          gridSnap,
        );
        snapDx += snap.dx;
        snapDy += snap.dy;
        this.host?.setSnapGuides?.(snap.guides);
      }

      const updated = this.beforeSnapshots.map((el) => ({
        ...el,
        x: el.x + snapDx,
        y: el.y + snapDy,
      }));
      this.ctx.updateElementsLive(updated);

      const roots = getSelectionRoots(this.ctx.document.getElements(), this.ctx.selection.getIds());
      const exclude = new Set<import('@rough/schema').ID>();
      for (const id of roots) {
        for (const el of collectSubtree(this.ctx.document.getElements(), [id])) {
          exclude.add(el.id);
        }
      }
      const target = findDeepestContainerAtPoint(
        this.ctx.sceneGraph,
        e.world,
        this.ctx.viewport.zoom,
        exclude,
      );
      this.host?.setDropTargetFrame?.(target);
      return;
    }

    if (this.mode === 'resize' && this.activeHandle && this.activeHandle !== 'rotate') {
      if (this.multiResize) {
        const localDelta = { x: dx, y: dy };
        let bounds = applyResize(
          this.activeHandle,
          this.startMergedBounds,
          localDelta.x,
          localDelta.y,
          e.shiftKey,
          e.altKey,
        );
        const gridSnap = this.host?.getGridSnap?.() ?? false;
        if (this.beforeSnapshots.length > 0) {
          const parentId = this.beforeSnapshots[0].parentId;
          const siblings = this.ctx.document.getChildren(parentId);
          const excludeIds = new Set(this.beforeSnapshots.map((el) => el.id));
          const snap = computeSnapAdjust(
            bounds,
            siblings,
            parentId
              ? { minX: 0, minY: 0, maxX: this.ctx.document.getElement(parentId)?.width ?? 0, maxY: this.ctx.document.getElement(parentId)?.height ?? 0 }
              : null,
            excludeIds,
            this.ctx.viewport.zoom,
            gridSnap,
          );
          bounds = {
            ...bounds,
            x: bounds.x + snap.dx,
            y: bounds.y + snap.dy,
            width: bounds.width,
            height: bounds.height,
          };
          this.host?.setSnapGuides?.(snap.guides);
        }
        const scaled = scaleElementsInMergedBounds(this.beforeSnapshots, this.startMergedBounds, bounds);
        this.ctx.updateElementsLive(scaled);
        return;
      }

      const id = this.beforeSnapshots[0]?.id;
      if (!id) return;
      const node = this.ctx.sceneGraph.getNode(id);
      if (!node) return;
      const localDelta = worldDeltaToElementLocal(node, dx, dy);
      let bounds = applyResize(
        this.activeHandle,
        this.startBounds,
        localDelta.x,
        localDelta.y,
        e.shiftKey,
        e.altKey,
      );
      const gridSnap = this.host?.getGridSnap?.() ?? false;
      const el = this.ctx.document.getElement(id);
      if (!el) return;
      const parentId = el.parentId;
      const siblings = this.ctx.document.getChildren(parentId);
      const snap = computeSnapAdjust(
        bounds,
        siblings,
        parentId
          ? { minX: 0, minY: 0, maxX: this.ctx.document.getElement(parentId)?.width ?? 0, maxY: this.ctx.document.getElement(parentId)?.height ?? 0 }
          : null,
        new Set([id]),
        this.ctx.viewport.zoom,
        gridSnap,
      );
      bounds = { ...bounds, x: bounds.x + snap.dx, y: bounds.y + snap.dy };
      this.host?.setSnapGuides?.(snap.guides);

      let patch: Element = { ...el, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      if (el.type === 'text' && bounds.width !== this.startBounds.width) {
        patch = { ...(patch as TextElement), autoSize: 'auto-height' };
      }
      this.ctx.updateElementsLive([patch]);
      return;
    }

    if (this.mode === 'rotate' && this.beforeSnapshots.length === 1) {
      const el = this.beforeSnapshots[0];
      const cx = this.rotateCenterWorld.x;
      const cy = this.rotateCenterWorld.y;
      const startAngle = Math.atan2(this.dragStartWorld.y - cy, this.dragStartWorld.x - cx);
      const currentAngle = Math.atan2(e.world.y - cy, e.world.x - cx);
      let delta = currentAngle - startAngle;
      if (e.shiftKey) {
        const step = (15 * Math.PI) / 180;
        delta = Math.round(delta / step) * step;
      }
      this.ctx.updateElementsLive([{ ...el, rotation: this.startRotation + delta }]);
    }
  }

  onPointerUp(): void {
    if (this.mode === 'marquee' && this.marqueeRect) {
      const hits = hitTestRect(this.ctx.sceneGraph, this.marqueeRect);
      const ids = hits.map((n) => n.element.id);
      if (this.marqueeAdditive) {
        for (const id of ids) this.ctx.selection.toggle(id);
      } else {
        this.ctx.selection.select(ids);
      }
      this.marqueeRect = null;
      this.mode = null;
      this.ctx.requestRender();
      return;
    }

    const wasMove = this.mode === 'move';
    const layoutReorder = this.layoutReorder;

    if (wasMove && layoutReorder) {
      this.host?.setLayoutInsertLine?.(null);
      if (this.layoutBeforeSiblingId !== this.initialLayoutBeforeSiblingId) {
        this.ctx.sceneGraph.rebuild(this.ctx.document.getElements());
        this.ctx.runCommand(
          new ReorderAutoLayoutCommand(
            this.ctx.document,
            layoutReorder.frameId,
            layoutReorder.draggedIds,
            this.layoutBeforeSiblingId,
          ),
        );
      } else {
        this.ctx.rebuildScene();
      }
    } else if (this.mode && this.beforeSnapshots.length > 0) {
      const after = this.ctx.selection
        .getIds()
        .map((id) => this.ctx.document.getElement(id))
        .filter((el): el is Element => el !== undefined)
        .map((el) => structuredClone(el));

      const changed = after.some((el) => {
        const before = this.beforeSnapshots.find((b) => b.id === el.id);
        if (!before) return true;
        return (
          before.x !== el.x ||
          before.y !== el.y ||
          before.width !== el.width ||
          before.height !== el.height ||
          before.rotation !== el.rotation
        );
      });

      if (changed && after.length > 0) {
        this.ctx.sceneGraph.rebuild(this.ctx.document.getElements());
        this.ctx.runCommand(new UpdateElementsCommand(this.ctx.document, after));
        if (wasMove) {
          this.host?.reparentElementsAtDrop?.(this.ctx.selection.getIds(), this.lastWorld);
        }
      }
    }

    this.host?.setSnapGuides?.([]);
    this.host?.setDropTargetFrame?.(null);
    this.layoutReorder = null;
    this.layoutBeforeSiblingId = null;
    this.initialLayoutBeforeSiblingId = null;
    this.ctx.setResizingIds(new Set());
    this.mode = null;
    this.activeHandle = null;
    this.multiResize = false;
    this.beforeSnapshots = [];
    this.marqueeRect = null;
    this.ctx.requestRender();
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const ids = this.ctx.selection.getIds();
      if (ids.length > 0) {
        this.ctx.runCommand(new DeleteElementsCommand(this.ctx.document, ids));
        this.ctx.selection.clear();
      }
      return true;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const ids = this.ctx.selection.getIds();
      if (ids.length === 0) return false;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      const updated = ids
        .map((id) => this.ctx.document.getElement(id))
        .filter((el): el is Element => el !== undefined)
        .map((el) => ({ ...el, x: el.x + dx, y: el.y + dy }));
      if (updated.length > 0) {
        this.ctx.runCommand(new UpdateElementsCommand(this.ctx.document, updated));
      }
      return true;
    }

    return false;
  }

  private beginMove(e: NormalizedPointerEvent): void {
    if (e.altKey) {
      const ids = this.ctx.selection.getIds();
      const newIds = duplicateElements(this.ctx.document, ids);
      if (newIds.length > 0) {
        this.ctx.selection.select(newIds);
      }
    }
    this.mode = 'move';
    this.beforeSnapshots = this.ctx.selection
      .getIds()
      .map((id) => this.ctx.document.getElement(id))
      .filter((el): el is Element => el !== undefined)
      .map((el) => structuredClone(el));
    this.dragStartWorld = { ...e.world };
    this.layoutReorder = null;
    this.layoutBeforeSiblingId = null;
    this.initialLayoutBeforeSiblingId = null;

    const roots = getSelectionRoots(
      this.ctx.document.getElements(),
      this.ctx.selection.getIds(),
    );
    const parentId = this.beforeSnapshots[0]?.parentId ?? null;
    if (parentId) {
      const parent = this.ctx.document.getElement(parentId);
      if (parent?.type === 'frame' && parent.autoLayout) {
        const allDirectChildren = roots.every((id) => {
          const el = this.ctx.document.getElement(id);
          return el?.parentId === parentId;
        });
        if (allDirectChildren) {
          this.layoutReorder = { frameId: parentId, draggedIds: roots };
          const siblings = this.ctx.document.getChildren(parentId);
          this.initialLayoutBeforeSiblingId = initialLayoutBeforeSibling(siblings, roots);
          this.layoutBeforeSiblingId = this.initialLayoutBeforeSiblingId;
        }
      }
    }
  }

  cancel(): void {
    if (this.beforeSnapshots.length > 0) {
      this.ctx.document.setElements(this.beforeSnapshots);
      this.ctx.rebuildScene();
    }
    this.ctx.setResizingIds(new Set());
    this.mode = null;
    this.marqueeRect = null;
    this.multiResize = false;
    this.beforeSnapshots = [];
  }
}

function computeMergedLocalBounds(elements: Element[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function initialLayoutBeforeSibling(siblings: Element[], draggedIds: ID[]): ID | null {
  const draggedSet = new Set(draggedIds);
  const sorted = [...siblings].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const firstIdx = sorted.findIndex((s) => draggedSet.has(s.id));
  if (firstIdx < 0) return null;
  const remaining = sorted.filter((s) => !draggedSet.has(s.id));
  return remaining[firstIdx]?.id ?? null;
}

function scaleElementsInMergedBounds(
  elements: Element[],
  start: { x: number; y: number; width: number; height: number },
  next: { x: number; y: number; width: number; height: number },
): Element[] {
  const sx = start.width > 0 ? next.width / start.width : 1;
  const sy = start.height > 0 ? next.height / start.height : 1;
  return elements.map((el) => {
    const scaled: Element = {
      ...el,
      x: next.x + (el.x - start.x) * sx,
      y: next.y + (el.y - start.y) * sy,
      width: Math.max(el.width * sx, 1),
      height: Math.max(el.height * sy, 1),
    };
    if (el.type === 'text') {
      return { ...scaled, autoSize: 'auto-height' } as TextElement;
    }
    return scaled;
  });
}

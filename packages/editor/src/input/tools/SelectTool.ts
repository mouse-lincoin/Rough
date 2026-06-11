import type { Element } from '@rough/schema';
import type { EditorContext } from '../../EditorContext.js';
import {
  DeleteElementsCommand,
  UpdateElementsCommand,
} from '../../commands/ElementCommands.js';
import { findDeepestContainerAtPoint, hitTestPoint, hitTestRect } from '../../interactions/hitTest.js';
import { collectSubtree } from '../../clipboard/clipboard.js';
import { getSelectionRoots } from '../../interactions/treeUtils.js';
import {
  applyResize,
  hitTestHandle,
  type HandleType,
} from '../../interactions/transformHandles.js';
import { aabbToRect, getRotatedWorldCorners, getWorldAABB } from '../../scene/bounds.js';
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
  private startRotation = 0;
  private marqueeRect: Rect | null = null;
  private marqueeAdditive = false;
  private lastWorld = { x: 0, y: 0 };

  constructor(
    private ctx: EditorContext,
    private host?: EditorHost & {
      getGridSnap?: () => boolean;
      setSnapGuides?: (guides: import('../../interactions/snapping.js').SnapGuide[]) => void;
      setDropTargetFrame?: (frameId: import('@rough/schema').ID | null) => void;
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

  onPointerDown(e: NormalizedPointerEvent): void {
    const selected = this.ctx.selection.getIds();
    if (selected.length === 1) {
      const node = this.ctx.sceneGraph.getNode(selected[0]);
      if (node) {
        const corners = getRotatedWorldCorners(node).map((c) => this.ctx.viewport.worldToScreen(c));
        const handle = hitTestHandle(e.screen, corners);
        if (handle) {
          this.mode = handle === 'rotate' ? 'rotate' : 'resize';
          this.activeHandle = handle;
          this.beforeSnapshots = selected
            .map((id) => this.ctx.document.getElement(id))
            .filter((el): el is Element => el !== undefined)
            .map((el) => structuredClone(el));
          const aabb = getWorldAABB(node);
          this.startBounds = aabbToRect(aabb);
          this.startRotation = node.element.rotation;
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
      this.mode = 'move';
      this.beforeSnapshots = this.ctx.selection
        .getIds()
        .map((id) => this.ctx.document.getElement(id))
        .filter((el): el is Element => el !== undefined)
        .map((el) => structuredClone(el));
      this.dragStartWorld = { ...e.world };
      return;
    }

    if (hit) {
      if (e.shiftKey) {
        this.ctx.selection.toggle(hit.element.id);
      } else if (!this.ctx.selection.isSelected(hit.element.id)) {
        this.ctx.selection.select([hit.element.id]);
      }
      this.mode = 'move';
      this.beforeSnapshots = this.ctx.selection
        .getIds()
        .map((id) => this.ctx.document.getElement(id))
        .filter((el): el is Element => el !== undefined)
        .map((el) => structuredClone(el));
      this.dragStartWorld = { ...e.world };
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
      const bounds = applyResize(
        this.activeHandle,
        this.startBounds,
        dx,
        dy,
        e.shiftKey,
        e.altKey,
      );
      const id = this.beforeSnapshots[0]?.id;
      if (!id) return;
      const el = this.ctx.document.getElement(id);
      if (!el) return;
      this.ctx.updateElementsLive([{ ...el, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }]);
      return;
    }

    if (this.mode === 'rotate' && this.beforeSnapshots.length === 1) {
      const el = this.beforeSnapshots[0];
      const cx = this.startBounds.x + this.startBounds.width / 2;
      const cy = this.startBounds.y + this.startBounds.height / 2;
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

    if (this.mode && this.beforeSnapshots.length > 0) {
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
    this.ctx.setResizingIds(new Set());
    this.mode = null;
    this.activeHandle = null;
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
    return false;
  }

  cancel(): void {
    if (this.beforeSnapshots.length > 0) {
      this.ctx.document.setElements(this.beforeSnapshots);
      this.ctx.rebuildScene();
    }
    this.ctx.setResizingIds(new Set());
    this.mode = null;
    this.marqueeRect = null;
    this.beforeSnapshots = [];
  }
}

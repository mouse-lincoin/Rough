import type { ID, Vec2 } from '@rough/schema';
import type { SceneGraph } from '../scene/SceneGraph.js';
import { aabbToRect, getRotatedWorldCorners, getWorldAABB, mergeAABB } from '../scene/bounds.js';
import type { Viewport } from './viewport.js';
import type { Rect } from '../types.js';
import type { HandleType } from '../interactions/transformHandles.js';
import { getHandlePositions } from '../interactions/transformHandles.js';

const HANDLE_SIZE = 8;
const ACCENT = '#6965DB';

export interface OverlayState {
  selectedIds: Set<ID>;
  marqueeRect: Rect | null;
  transformHandle: HandleType | null;
}

export class OverlayRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    sceneGraph: SceneGraph,
    viewport: Viewport,
    state: OverlayState,
  ): void {
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width / (window.devicePixelRatio || 1), ctx.canvas.height / (window.devicePixelRatio || 1));

    if (state.marqueeRect) {
      this.drawMarquee(ctx, viewport, state.marqueeRect);
    }

    if (state.selectedIds.size > 0) {
      this.drawSelection(ctx, sceneGraph, viewport, state.selectedIds);
    }

    ctx.restore();
  }

  private drawMarquee(ctx: CanvasRenderingContext2D, viewport: Viewport, rect: Rect): void {
    const tl = viewport.worldToScreen({ x: rect.x, y: rect.y });
    const br = viewport.worldToScreen({ x: rect.x + rect.width, y: rect.y + rect.height });
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.fillStyle = 'rgba(105, 101, 219, 0.08)';
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.setLineDash([]);
  }

  private drawSelection(
    ctx: CanvasRenderingContext2D,
    sceneGraph: SceneGraph,
    viewport: Viewport,
    selectedIds: Set<ID>,
  ): void {
    const nodes = [...selectedIds]
      .map((id) => sceneGraph.getNode(id))
      .filter((n) => n !== undefined);

    if (nodes.length === 0) return;

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    if (nodes.length === 1 && nodes[0].element.rotation !== 0) {
      const corners = getRotatedWorldCorners(nodes[0]);
      this.drawPolygonSelection(ctx, viewport, corners);
      const screenCorners = corners.map((c) => viewport.worldToScreen(c));
      this.drawHandles(ctx, screenCorners);
    } else {
      let aabb = getWorldAABB(nodes[0]);
      for (let i = 1; i < nodes.length; i++) {
        aabb = mergeAABB(aabb, getWorldAABB(nodes[i]));
      }
      const rect = aabbToRect(aabb);
      const tl = viewport.worldToScreen({ x: rect.x, y: rect.y });
      const br = viewport.worldToScreen({ x: rect.x + rect.width, y: rect.y + rect.height });
      const screenRect = { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
      ctx.strokeRect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
      this.drawHandles(ctx, [
        { x: screenRect.x, y: screenRect.y },
        { x: screenRect.x + screenRect.width, y: screenRect.y },
        { x: screenRect.x + screenRect.width, y: screenRect.y + screenRect.height },
        { x: screenRect.x, y: screenRect.y + screenRect.height },
      ]);
    }
  }

  private drawPolygonSelection(ctx: CanvasRenderingContext2D, viewport: Viewport, corners: Vec2[]): void {
    ctx.beginPath();
    const first = viewport.worldToScreen(corners[0]);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < corners.length; i++) {
      const p = viewport.worldToScreen(corners[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private drawHandles(ctx: CanvasRenderingContext2D, corners: Vec2[]): void {
    const hs = HANDLE_SIZE / 2;
    const positions = getHandlePositions(corners);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    for (const p of positions) {
      ctx.fillRect(p.x - hs, p.y - hs, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(p.x - hs, p.y - hs, HANDLE_SIZE, HANDLE_SIZE);
    }
  }
}

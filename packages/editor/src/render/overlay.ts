import type { ID, Vec2 } from '@rough/schema';
import type { SceneGraph } from '../scene/SceneGraph.js';
import { aabbToRect, getRotatedWorldCorners, getWorldAABB, mergeAABB } from '../scene/bounds.js';
import type { Viewport } from './viewport.js';
import type { Rect } from '../types.js';
import type { HandleType } from '../interactions/transformHandles.js';
import { getHandlePositions } from '../interactions/transformHandles.js';
import type { SnapGuide } from '../interactions/snapping.js';
import type { RemotePeer } from '../collab/AwarenessSync.js';

const HANDLE_SIZE = 8;
const ACCENT = '#6965DB';

export interface OverlayState {
  selectedIds: Set<ID>;
  marqueeRect: Rect | null;
  transformHandle: HandleType | null;
  snapGuides: SnapGuide[];
  remotePeers: RemotePeer[];
  currentPageId: ID;
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

    if (state.snapGuides.length > 0) {
      this.drawSnapGuides(ctx, viewport, state.snapGuides);
    }

    if (state.selectedIds.size > 0) {
      this.drawSelection(ctx, sceneGraph, viewport, state.selectedIds);
    }

    for (const peer of state.remotePeers) {
      if (peer.state.pageId !== state.currentPageId) continue;
      this.drawRemotePeer(ctx, sceneGraph, viewport, peer);
    }

    ctx.restore();
  }

  private drawRemotePeer(
    ctx: CanvasRenderingContext2D,
    sceneGraph: SceneGraph,
    viewport: Viewport,
    peer: RemotePeer,
  ): void {
    const color = peer.state.user?.color ?? '#6965DB';
    const name = peer.state.user?.name ?? 'User';

    if (peer.state.selection?.length > 0) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      for (const id of peer.state.selection) {
        const node = sceneGraph.getNode(id);
        if (!node) continue;
        const aabb = getWorldAABB(node);
        const rect = aabbToRect(aabb);
        const tl = viewport.worldToScreen({ x: rect.x, y: rect.y });
        const br = viewport.worldToScreen({ x: rect.x + rect.width, y: rect.y + rect.height });
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      }
      ctx.restore();
    }

    if (peer.state.cursor) {
      const p = viewport.worldToScreen(peer.state.cursor);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 10, p.y + 12);
      ctx.lineTo(p.x + 4, p.y + 12);
      ctx.lineTo(p.x + 2, p.y + 18);
      ctx.closePath();
      ctx.fill();
      ctx.font = '11px Inter, sans-serif';
      const labelW = ctx.measureText(name).width + 8;
      ctx.fillStyle = color;
      ctx.fillRect(p.x + 12, p.y + 4, labelW, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, p.x + 16, p.y + 16);
      ctx.restore();
    }
  }

  private drawSnapGuides(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    guides: SnapGuide[],
  ): void {
    ctx.strokeStyle = '#FF6B6B';
    ctx.lineWidth = 1;
    for (const g of guides) {
      ctx.beginPath();
      if (g.orientation === 'horizontal') {
        const a = viewport.worldToScreen({ x: g.from, y: g.position });
        const b = viewport.worldToScreen({ x: g.to, y: g.position });
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      } else {
        const a = viewport.worldToScreen({ x: g.position, y: g.from });
        const b = viewport.worldToScreen({ x: g.position, y: g.to });
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
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

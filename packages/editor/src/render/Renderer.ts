import type { RGBA } from '@rough/schema';
import { rgbaToCss } from '@rough/shared';
import type { SceneGraph } from '../scene/SceneGraph.js';
import type { SceneNode } from '../scene/SceneNode.js';
import { aabbIntersects, getWorldAABB } from '../scene/bounds.js';
import type { Viewport } from './viewport.js';
import { renderShape } from './shapeRenderers/index.js';
import { renderFrameBackground, renderFrameBorder, renderFrameLabel } from './shapeRenderers/frame.js';
import type { ImageCache } from './imageCache.js';

export class Renderer {
  renderMain(
    ctx: CanvasRenderingContext2D,
    sceneGraph: SceneGraph,
    viewport: Viewport,
    width: number,
    height: number,
    background: RGBA,
    forceClean: boolean,
    resizingIds: Set<string>,
    imageCache: ImageCache,
  ): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = rgbaToCss(background);
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.translate(-viewport.offset.x * viewport.zoom, -viewport.offset.y * viewport.zoom);
    ctx.scale(viewport.zoom, viewport.zoom);

    const viewBounds = viewport.getWorldBounds(width, height);
    const viewAABB = {
      minX: viewBounds.minX,
      minY: viewBounds.minY,
      maxX: viewBounds.maxX,
      maxY: viewBounds.maxY,
    };

    const sortedRoots = [...sceneGraph.roots].sort((a, b) => {
      const cmp = a.element.sortKey.localeCompare(b.element.sortKey);
      return cmp !== 0 ? cmp : a.element.id.localeCompare(b.element.id);
    });

    for (const root of sortedRoots) {
      const worldAABB = getWorldAABB(root);
      if (!aabbIntersects(worldAABB, viewAABB)) continue;
      this.renderNodeTree(ctx, root, viewport, forceClean, resizingIds, imageCache);
    }

    ctx.restore();
  }

  private renderNodeTree(
    ctx: CanvasRenderingContext2D,
    node: SceneNode,
    viewport: Viewport,
    forceClean: boolean,
    resizingIds: Set<string>,
    imageCache: ImageCache,
  ): void {
    const el = node.element;
    if (!el.visible) return;

    ctx.save();
    ctx.globalAlpha = el.opacity;

    const m = node.worldMatrix;
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

    const nodeForceClean = forceClean || resizingIds.has(el.id);

    if (el.type === 'group' || el.type === 'instance') {
      const sortedChildren = [...node.children].sort((a, b) => {
        const cmp = a.element.sortKey.localeCompare(b.element.sortKey);
        return cmp !== 0 ? cmp : a.element.id.localeCompare(b.element.id);
      });
      for (const child of sortedChildren) {
        this.renderNodeTree(ctx, child, viewport, forceClean, resizingIds, imageCache);
      }
      ctx.restore();
      return;
    }

    if (el.type === 'frame') {
      renderFrameBackground(ctx, node);
      renderFrameBorder(ctx, node, nodeForceClean);
      if (el.clipsContent) {
        ctx.beginPath();
        ctx.rect(0, 0, el.width, el.height);
        ctx.clip();
      }
      const sortedChildren = [...node.children].sort((a, b) => {
        const cmp = a.element.sortKey.localeCompare(b.element.sortKey);
        return cmp !== 0 ? cmp : a.element.id.localeCompare(b.element.id);
      });
      for (const child of sortedChildren) {
        this.renderNodeTree(ctx, child, viewport, forceClean, resizingIds, imageCache);
      }
      ctx.restore();
      renderFrameLabel(ctx, node, viewport.zoom);
      return;
    }

    renderShape(ctx, node, nodeForceClean, imageCache);
    ctx.restore();

    const sortedChildren = [...node.children].sort((a, b) => {
      const cmp = a.element.sortKey.localeCompare(b.element.sortKey);
      return cmp !== 0 ? cmp : a.element.id.localeCompare(b.element.id);
    });
    for (const child of sortedChildren) {
      this.renderNodeTree(ctx, child, viewport, forceClean, resizingIds, imageCache);
    }
  }
}

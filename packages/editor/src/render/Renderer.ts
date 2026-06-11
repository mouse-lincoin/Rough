import type { RGBA } from '@rough/schema';
import { rgbaToCss } from '@rough/shared';
import type { SceneGraph } from '../scene/SceneGraph.js';
import type { SceneNode } from '../scene/SceneNode.js';
import { aabbIntersects, getWorldAABB } from '../scene/bounds.js';
import type { Viewport } from './viewport.js';
import { renderShape } from './shapeRenderers/index.js';

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

    for (const node of sceneGraph.traverseBottomUp()) {
      if (!node.element.visible) continue;
      const worldAABB = getWorldAABB(node);
      if (!aabbIntersects(worldAABB, viewAABB)) continue;
      this.renderNode(ctx, node, forceClean || resizingIds.has(node.element.id));
    }

    ctx.restore();
  }

  private renderNode(ctx: CanvasRenderingContext2D, node: SceneNode, forceClean: boolean): void {
    const el = node.element;
    ctx.save();
    ctx.globalAlpha = el.opacity;

    const m = node.worldMatrix;
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

    renderShape(ctx, node, forceClean);
    ctx.restore();
  }
}

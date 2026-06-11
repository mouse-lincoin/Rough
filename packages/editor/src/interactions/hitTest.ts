import type { Element, Vec2 } from '@rough/schema';
import { distanceToSegment } from '@rough/shared';
import type { SceneGraph } from '../scene/SceneGraph.js';
import type { SceneNode } from '../scene/SceneNode.js';
import { aabbIntersects, getWorldAABB, worldToLocal } from '../scene/bounds.js';

function hitTestLocalPoint(element: Element, local: Vec2, zoom: number): boolean {
  const strokeWidth = element.strokes[0]?.width ?? 2;
  const threshold = Math.max(strokeWidth / 2 + 4, 8 / zoom);

  switch (element.type) {
    case 'rectangle': {
      const hasFill = element.fills.length > 0;
      const inRect =
        local.x >= 0 && local.x <= element.width && local.y >= 0 && local.y <= element.height;
      if (hasFill) return inRect;
      return (
        local.x >= -threshold &&
        local.x <= element.width + threshold &&
        local.y >= -threshold &&
        local.y <= element.height + threshold &&
        (local.x <= threshold ||
          local.x >= element.width - threshold ||
          local.y <= threshold ||
          local.y >= element.height - threshold)
      );
    }
    case 'ellipse': {
      const cx = element.width / 2;
      const cy = element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      const norm = ((local.x - cx) / rx) ** 2 + ((local.y - cy) / ry) ** 2;
      const hasFill = element.fills.length > 0;
      if (hasFill) return norm <= 1;
      const outer = ((local.x - cx) / (rx + threshold)) ** 2 + ((local.y - cy) / (ry + threshold)) ** 2;
      const inner = rx > threshold && ry > threshold
        ? ((local.x - cx) / (rx - threshold)) ** 2 + ((local.y - cy) / (ry - threshold)) ** 2
        : 0;
      return outer <= 1 && inner >= 1;
    }
    case 'line': {
      const [p0, p1] = element.points;
      return distanceToSegment(local, p0, p1) <= threshold;
    }
    case 'path': {
      for (let i = 1; i < element.points.length; i++) {
        if (distanceToSegment(local, element.points[i - 1], element.points[i]) <= threshold) {
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

export function hitTestPoint(sceneGraph: SceneGraph, world: Vec2, zoom: number): SceneNode | null {
  for (const node of sceneGraph.traverseTopDown()) {
    const el = node.element;
    if (!el.visible || el.locked) continue;
    const local = worldToLocal(node.worldMatrix, world);
    if (!local) continue;
    if (hitTestLocalPoint(el, local, zoom)) {
      return node;
    }
  }
  return null;
}

export function hitTestRect(
  sceneGraph: SceneGraph,
  rect: { x: number; y: number; width: number; height: number },
): SceneNode[] {
  const results: SceneNode[] = [];
  const selectionAABB = {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
  };

  for (const node of sceneGraph.traverseTopDown()) {
    const el = node.element;
    if (!el.visible || el.locked) continue;
    if (aabbIntersects(getWorldAABB(node), selectionAABB)) {
      results.push(node);
    }
  }
  return results;
}

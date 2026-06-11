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
    case 'polygon': {
      const sides = element.sides;
      const cx = element.width / 2;
      const cy = element.height / 2;
      const rx = element.width / 2;
      const ry = element.height / 2;
      const verts: Vec2[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
        verts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
      }
      const hasFill = element.fills.length > 0;
      if (hasFill) {
        let inside = false;
        for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
          const xi = verts[i].x;
          const yi = verts[i].y;
          const xj = verts[j].x;
          const yj = verts[j].y;
          if ((yi > local.y) !== (yj > local.y) && local.x < ((xj - xi) * (local.y - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
        if (inside) return true;
      }
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        if (distanceToSegment(local, a, b) <= threshold) return true;
      }
      return false;
    }
    case 'arrow': {
      for (let i = 1; i < element.points.length; i++) {
        if (distanceToSegment(local, element.points[i - 1], element.points[i]) <= threshold) {
          return true;
        }
      }
      return false;
    }
    case 'line': {
      const [p0, p1] = element.points;
      return distanceToSegment(local, p0, p1) <= threshold;
    }
    case 'group':
      return false;
    case 'path': {
      for (let i = 1; i < element.points.length; i++) {
        if (distanceToSegment(local, element.points[i - 1], element.points[i]) <= threshold) {
          return true;
        }
      }
      return false;
    }
    case 'frame':
    case 'image': {
      return (
        local.x >= 0 &&
        local.x <= element.width &&
        local.y >= 0 &&
        local.y <= element.height
      );
    }
    case 'text': {
      return (
        local.x >= 0 &&
        local.x <= element.width &&
        local.y >= 0 &&
        local.y <= element.height
      );
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

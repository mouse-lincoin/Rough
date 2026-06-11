import type { Element, ID, Vec2 } from '@rough/schema';
import { getDirectChildren } from './scope.js';

export interface ExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsToSize(bounds: ExportBounds): { width: number; height: number } {
  return {
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  };
}

function localCorners(el: Element): Vec2[] {
  switch (el.type) {
    case 'line': {
      const [p0, p1] = el.points;
      return [
        { x: p0.x, y: p0.y },
        { x: p1.x, y: p1.y },
      ];
    }
    case 'path':
      return el.points.length > 0 ? [...el.points] : [{ x: 0, y: 0 }];
    default:
      return [
        { x: 0, y: 0 },
        { x: el.width, y: 0 },
        { x: el.width, y: el.height },
        { x: 0, y: el.height },
      ];
  }
}

function rotatePoint(p: Vec2, cx: number, cy: number, rad: number): Vec2 {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

function worldCorners(el: Element): Vec2[] {
  const rad = (el.rotation * Math.PI) / 180;
  const cx = el.width / 2;
  const cy = el.height / 2;
  return localCorners(el).map((p) => {
    const rotated = rotatePoint(p, cx, cy, rad);
    return { x: el.x + rotated.x, y: el.y + rotated.y };
  });
}

function aabbFromPoints(points: Vec2[]): ExportBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

export function mergeBounds(a: ExportBounds, b: ExportBounds): ExportBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function computeSubtreeBounds(
  elements: Record<ID, Element>,
  rootId: ID,
): ExportBounds {
  const root = elements[rootId];
  if (!root) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };

  let bounds = aabbFromPoints(worldCorners(root));
  for (const child of getDirectChildren(elements, rootId)) {
    bounds = mergeBounds(bounds, computeSubtreeBounds(elements, child.id));
  }
  return bounds;
}

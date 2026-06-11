import type { Element, Vec2 } from '@rough/schema';
import type { SceneNode } from './SceneNode.js';
import type { Rect } from '../types.js';
import { getElementCorners, matApply, matInvert, type Mat2D } from './transforms.js';

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function aabbFromPoints(points: Vec2[]): AABB {
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

export function aabbToRect(aabb: AABB): Rect {
  return {
    x: aabb.minX,
    y: aabb.minY,
    width: aabb.maxX - aabb.minX,
    height: aabb.maxY - aabb.minY,
  };
}

export function mergeAABB(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(b.maxY, b.maxY),
  };
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function getLocalBounds(element: Element): AABB {
  switch (element.type) {
    case 'line': {
      const [p0, p1] = element.points;
      return aabbFromPoints([
        { x: p0.x, y: p0.y },
        { x: p1.x, y: p1.y },
      ]);
    }
    case 'path': {
      if (element.points.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      }
      return aabbFromPoints(element.points);
    }
    default:
      return {
        minX: 0,
        minY: 0,
        maxX: element.width,
        maxY: element.height,
      };
  }
}

export function getWorldAABB(node: SceneNode): AABB {
  const local = getLocalBounds(node.element);
  const corners = [
    { x: local.minX, y: local.minY },
    { x: local.maxX, y: local.minY },
    { x: local.maxX, y: local.maxY },
    { x: local.minX, y: local.maxY },
  ].map((p) => matApply(node.worldMatrix, p));

  let aabb = aabbFromPoints(corners);

  for (const child of node.children) {
    aabb = mergeAABB(aabb, getWorldAABB(child));
  }

  return aabb;
}

export function getRotatedWorldCorners(node: SceneNode): Vec2[] {
  const el = node.element;
  const local = getLocalBounds(el);
  const w = local.maxX - local.minX;
  const h = local.maxY - local.minY;
  return getElementCorners(local.minX, local.minY, w, h, el.rotation).map((p) => matApply(node.worldMatrix, p));
}

export function worldToLocal(worldMatrix: Mat2D, point: Vec2): Vec2 | null {
  const inv = matInvert(worldMatrix);
  if (!inv) return null;
  return matApply(inv, point);
}

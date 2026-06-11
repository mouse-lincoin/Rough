import type { ArrowBinding, ArrowElement, Element, ID, Vec2 } from '@rough/schema';
import type { SceneGraph } from '../scene/SceneGraph.js';
import { matApply, matInvert } from '../scene/transforms.js';
import { worldToLocal } from '../scene/bounds.js';

const DEFAULT_GAP = 4;

function getPolygonVertices(sides: number, width: number, height: number): Vec2[] {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const verts: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    verts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return verts;
}

function rayIntersectRect(origin: Vec2, dir: Vec2, w: number, h: number): Vec2 | null {
  const candidates: number[] = [];
  if (Math.abs(dir.x) > 1e-6) {
    candidates.push((0 - origin.x) / dir.x);
    candidates.push((w - origin.x) / dir.x);
  }
  if (Math.abs(dir.y) > 1e-6) {
    candidates.push((0 - origin.y) / dir.y);
    candidates.push((h - origin.y) / dir.y);
  }
  let bestT = Infinity;
  for (const t of candidates) {
    if (t <= 0) continue;
    const px = origin.x + dir.x * t;
    const py = origin.y + dir.y * t;
    if (px >= -0.01 && px <= w + 0.01 && py >= -0.01 && py <= h + 0.01 && t < bestT) {
      bestT = t;
    }
  }
  if (bestT === Infinity) return null;
  return { x: origin.x + dir.x * bestT, y: origin.y + dir.y * bestT };
}

function rayIntersectEllipse(origin: Vec2, dir: Vec2, w: number, h: number): Vec2 | null {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const ox = origin.x - cx;
  const oy = origin.y - cy;
  const dx = dir.x;
  const dy = dir.y;
  const a = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  const b = 2 * ((ox * dx) / (rx * rx) + (oy * dy) / (ry * ry));
  const c = (ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const t1 = (-b - sqrt) / (2 * a);
  const t2 = (-b + sqrt) / (2 * a);
  const t = t1 > 0 ? t1 : t2 > 0 ? t2 : null;
  if (t === null || t <= 0) return null;
  return { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
}

function rayIntersectPolygon(
  origin: Vec2,
  dir: Vec2,
  sides: number,
  w: number,
  h: number,
): Vec2 | null {
  const verts = getPolygonVertices(sides, w, h);
  let bestT = Infinity;
  let best: Vec2 | null = null;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const denom = dir.x * edge.y - dir.y * edge.x;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((a.x - origin.x) * edge.y - (a.y - origin.y) * edge.x) / denom;
    const u = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom;
    if (t > 0 && u >= 0 && u <= 1 && t < bestT) {
      bestT = t;
      best = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
    }
  }
  return best;
}

export function anchorToLocalPoint(el: Element, anchor: Vec2): Vec2 {
  return { x: anchor.x * el.width, y: anchor.y * el.height };
}

export function localPointToAnchor(local: Vec2, el: Element): Vec2 {
  return {
    x: el.width > 0 ? local.x / el.width : 0.5,
    y: el.height > 0 ? local.y / el.height : 0.5,
  };
}

export function getEdgePoint(
  el: Element,
  anchor: Vec2,
  towardWorld: Vec2,
  worldMatrix: [number, number, number, number, number, number],
  gap = DEFAULT_GAP,
): Vec2 {
  const localAnchor = anchorToLocalPoint(el, anchor);
  const towardLocal = worldToLocal(worldMatrix, towardWorld);
  if (!towardLocal) return matApply(worldMatrix, localAnchor);

  const dir = {
    x: towardLocal.x - localAnchor.x,
    y: towardLocal.y - localAnchor.y,
  };
  const len = Math.hypot(dir.x, dir.y);
  if (len < 1e-6) return matApply(worldMatrix, localAnchor);
  const nd = { x: dir.x / len, y: dir.y / len };

  let edge: Vec2 | null = null;
  switch (el.type) {
    case 'rectangle':
    case 'frame':
    case 'image':
    case 'text':
    case 'group':
      edge = rayIntersectRect(localAnchor, nd, el.width, el.height);
      break;
    case 'ellipse':
      edge = rayIntersectEllipse(localAnchor, nd, el.width, el.height);
      break;
    case 'polygon':
      edge = rayIntersectPolygon(localAnchor, nd, el.sides, el.width, el.height);
      break;
    default:
      edge = rayIntersectRect(localAnchor, nd, el.width, el.height);
  }

  const point = edge ?? localAnchor;
  const withGap = { x: point.x + nd.x * gap, y: point.y + nd.y * gap };
  return matApply(worldMatrix, withGap);
}

export function findBindingTarget(
  sceneGraph: SceneGraph,
  worldPoint: Vec2,
  threshold: number,
  excludeIds: Set<ID>,
): { elementId: ID; anchor: Vec2 } | null {
  let best: { elementId: ID; anchor: Vec2; dist: number } | null = null;

  for (const node of sceneGraph.traverseTopDown()) {
    const el = node.element;
    if (excludeIds.has(el.id) || !el.visible) continue;
    if (el.type === 'line' || el.type === 'arrow' || el.type === 'path') continue;

    const local = worldToLocal(node.worldMatrix, worldPoint);
    if (!local) continue;
    if (local.x < -threshold || local.y < -threshold || local.x > el.width + threshold || local.y > el.height + threshold) {
      continue;
    }

    const clamped = {
      x: Math.max(0, Math.min(el.width, local.x)),
      y: Math.max(0, Math.min(el.height, local.y)),
    };
    const world = matApply(node.worldMatrix, clamped);
    const dist = Math.hypot(world.x - worldPoint.x, world.y - worldPoint.y);
    if (dist <= threshold && (!best || dist < best.dist)) {
      best = { elementId: el.id, anchor: localPointToAnchor(clamped, el), dist };
    }
  }

  return best ? { elementId: best.elementId, anchor: best.anchor } : null;
}

export function updateArrowEndpoints(
  arrow: ArrowElement,
  sceneGraph: SceneGraph,
  elements: Record<ID, Element>,
): ArrowElement {
  const node = sceneGraph.getNode(arrow.id);
  if (!node) return arrow;

  const worldPoints = arrow.points.map((p) => matApply(node.worldMatrix, p));
  let startWorld = worldPoints[0];
  let endWorld = worldPoints[worldPoints.length - 1];

  if (arrow.startBinding) {
    const target = elements[arrow.startBinding.elementId];
    const targetNode = sceneGraph.getNode(arrow.startBinding.elementId);
    if (target && targetNode) {
      startWorld = getEdgePoint(
        target,
        arrow.startBinding.anchor,
        endWorld,
        targetNode.worldMatrix,
        arrow.startBinding.gap,
      );
    } else {
      arrow = { ...arrow, startBinding: null };
    }
  }

  if (arrow.endBinding) {
    const target = elements[arrow.endBinding.elementId];
    const targetNode = sceneGraph.getNode(arrow.endBinding.elementId);
    if (target && targetNode) {
      endWorld = getEdgePoint(
        target,
        arrow.endBinding.anchor,
        startWorld,
        targetNode.worldMatrix,
        arrow.endBinding.gap,
      );
    } else {
      arrow = { ...arrow, endBinding: null };
    }
  }

  const inv = matInvert(node.worldMatrix);
  if (!inv) return arrow;

  const localStart = matApply(inv, startWorld);
  const localEnd = matApply(inv, endWorld);

  const minX = Math.min(localStart.x, localEnd.x);
  const minY = Math.min(localStart.y, localEnd.y);
  const maxX = Math.max(localStart.x, localEnd.x);
  const maxY = Math.max(localStart.y, localEnd.y);

  return {
    ...arrow,
    x: arrow.x + minX,
    y: arrow.y + minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    points: [
      { x: localStart.x - minX, y: localStart.y - minY },
      { x: localEnd.x - minX, y: localEnd.y - minY },
    ],
  };
}

export function updateAllBoundArrows(
  elements: Record<ID, Element>,
  sceneGraph: SceneGraph,
): Element[] {
  const updated: Element[] = [];
  for (const el of Object.values(elements)) {
    if (el.type !== 'arrow') continue;
    if (!el.startBinding && !el.endBinding) continue;
    updated.push(updateArrowEndpoints(el, sceneGraph, elements));
  }
  return updated;
}

export function createBinding(elementId: ID, anchor: Vec2, gap = DEFAULT_GAP): ArrowBinding {
  return { elementId, anchor, gap };
}

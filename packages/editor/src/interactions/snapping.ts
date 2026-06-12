import type { Element } from '@rough/schema';
import type { AABB } from '../scene/bounds.js';

export interface SnapGuide {
  orientation: 'horizontal' | 'vertical';
  position: number;
  from: number;
  to: number;
  /** Equal-spacing annotation, e.g. "24" */
  label?: string;
}

export interface SnapAdjust {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

interface SnapCandidate {
  value: number;
  sourceMin: number;
  sourceMax: number;
}

const GRID_SIZE = 8;

function getElementSnapValues(el: Element): {
  left: number;
  centerX: number;
  right: number;
  top: number;
  centerY: number;
  bottom: number;
} {
  return {
    left: el.x,
    centerX: el.x + el.width / 2,
    right: el.x + el.width,
    top: el.y,
    centerY: el.y + el.height / 2,
    bottom: el.y + el.height,
  };
}

function collectCandidates(
  siblings: Element[],
  parentBounds: AABB | null,
  excludeIds: Set<string>,
): { horizontal: SnapCandidate[]; vertical: SnapCandidate[] } {
  const horizontal: SnapCandidate[] = [];
  const vertical: SnapCandidate[] = [];

  const addElement = (el: Element): void => {
    const v = getElementSnapValues(el);
    for (const value of [v.top, v.centerY, v.bottom]) {
      horizontal.push({ value, sourceMin: v.left, sourceMax: v.right });
    }
    for (const value of [v.left, v.centerX, v.right]) {
      vertical.push({ value, sourceMin: v.top, sourceMax: v.bottom });
    }
  };

  for (const sib of siblings) {
    if (excludeIds.has(sib.id)) continue;
    addElement(sib);
  }

  if (parentBounds) {
    const pb = parentBounds;
    horizontal.push(
      { value: pb.minY, sourceMin: pb.minX, sourceMax: pb.maxX },
      { value: (pb.minY + pb.maxY) / 2, sourceMin: pb.minX, sourceMax: pb.maxX },
      { value: pb.maxY, sourceMin: pb.minX, sourceMax: pb.maxX },
    );
    vertical.push(
      { value: pb.minX, sourceMin: pb.minY, sourceMax: pb.maxY },
      { value: (pb.minX + pb.maxX) / 2, sourceMin: pb.minY, sourceMax: pb.maxY },
      { value: pb.maxX, sourceMin: pb.minY, sourceMax: pb.maxY },
    );
  }

  horizontal.sort((a, b) => a.value - b.value);
  vertical.sort((a, b) => a.value - b.value);
  return { horizontal, vertical };
}

function findNearestSnap(
  movingValues: number[],
  candidates: SnapCandidate[],
  threshold: number,
): { delta: number; guide: SnapGuide | null } | null {
  let best: { delta: number; guide: SnapGuide | null } | null = null;
  for (const mv of movingValues) {
    for (const cand of candidates) {
      const delta = cand.value - mv;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = {
          delta,
          guide: {
            orientation: 'horizontal',
            position: cand.value,
            from: Math.min(cand.sourceMin, mv + delta),
            to: Math.max(cand.sourceMax, mv + delta),
          },
        };
      }
    }
  }
  return best;
}

function findNearestSnapVertical(
  movingValues: number[],
  candidates: SnapCandidate[],
  threshold: number,
): { delta: number; guide: SnapGuide | null } | null {
  let best: { delta: number; guide: SnapGuide | null } | null = null;
  for (const mv of movingValues) {
    for (const cand of candidates) {
      const delta = cand.value - mv;
      if (Math.abs(delta) > threshold) continue;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) {
        best = {
          delta,
          guide: {
            orientation: 'vertical',
            position: cand.value,
            from: Math.min(cand.sourceMin, mv + delta),
            to: Math.max(cand.sourceMax, mv + delta),
          },
        };
      }
    }
  }
  return best;
}

export function computeSnapAdjust(
  bounds: { x: number; y: number; width: number; height: number },
  siblings: Element[],
  parentBounds: AABB | null,
  excludeIds: Set<string>,
  zoom: number,
  gridSnap: boolean,
): SnapAdjust {
  const threshold = 8 / zoom;
  const { horizontal, vertical } = collectCandidates(siblings, parentBounds, excludeIds);

  const movingH = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];
  const movingV = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];

  let dx = 0;
  let dy = 0;
  const guides: SnapGuide[] = [];

  const hSnap = findNearestSnap(movingH, horizontal, threshold);
  if (hSnap) {
    dy = hSnap.delta;
    if (hSnap.guide) guides.push(hSnap.guide);
  }

  const vSnap = findNearestSnapVertical(movingV, vertical, threshold);
  if (vSnap) {
    dx = vSnap.delta;
    if (vSnap.guide) guides.push(vSnap.guide);
  }

  if (gridSnap) {
    const snappedX = Math.round((bounds.x + dx) / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round((bounds.y + dy) / GRID_SIZE) * GRID_SIZE;
    dx = snappedX - bounds.x;
    dy = snappedY - bounds.y;
  }

  const movedBounds = {
    x: bounds.x + dx,
    y: bounds.y + dy,
    width: bounds.width,
    height: bounds.height,
  };
  guides.push(...collectEqualSpacingGuides(movedBounds, siblings, excludeIds));

  return { dx, dy, guides };
}

interface BoundsRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function collectEqualSpacingGuides(
  moving: BoundsRect,
  siblings: Element[],
  excludeIds: Set<string>,
): SnapGuide[] {
  const guides: SnapGuide[] = [];
  const rowTolerance = Math.max(moving.height * 0.5, 8);

  const rowmates = siblings.filter(
    (s) =>
      !excludeIds.has(s.id) &&
      Math.abs(s.y + s.height / 2 - (moving.y + moving.height / 2)) <= rowTolerance,
  );
  if (rowmates.length < 2) return guides;

  const items: BoundsRect[] = [...rowmates, moving].sort((a, b) => a.x - b.x);
  for (let i = 0; i < items.length - 2; i++) {
    const a = items[i];
    const b = items[i + 1];
    const c = items[i + 2];
    const gap1 = b.x - (a.x + a.width);
    const gap2 = c.x - (b.x + b.width);
    if (gap1 < 0 || gap2 < 0) continue;
    if (Math.abs(gap1 - gap2) > 1) continue;

    const gap = Math.round((gap1 + gap2) / 2);
    const midY = (a.y + a.height / 2 + b.y + b.height / 2) / 2;
    guides.push({
      orientation: 'horizontal',
      position: midY,
      from: a.x + a.width,
      to: b.x,
      label: String(gap),
    });
    guides.push({
      orientation: 'horizontal',
      position: midY,
      from: b.x + b.width,
      to: c.x,
      label: String(gap),
    });
    break;
  }

  return guides;
}

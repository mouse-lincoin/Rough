import type { Element } from '@rough/schema';
import type { AABB } from '../scene/bounds.js';
import { aabbToRect } from '../scene/bounds.js';

export type AlignType =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'center-v'
  | 'bottom';

function getBounds(elements: Element[]): AABB {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  return { minX, minY, maxX, maxY };
}

export function alignElements(
  elements: Element[],
  type: AlignType,
  reference: AABB | null,
): Element[] {
  if (elements.length === 0) return [];
  const ref = reference ?? getBounds(elements);
  const rect = aabbToRect(ref);

  return elements.map((el) => {
    let x = el.x;
    let y = el.y;
    switch (type) {
      case 'left':
        x = rect.x;
        break;
      case 'center-h':
        x = rect.x + rect.width / 2 - el.width / 2;
        break;
      case 'right':
        x = rect.x + rect.width - el.width;
        break;
      case 'top':
        y = rect.y;
        break;
      case 'center-v':
        y = rect.y + rect.height / 2 - el.height / 2;
        break;
      case 'bottom':
        y = rect.y + rect.height - el.height;
        break;
    }
    return { ...el, x, y };
  });
}

export function distributeElements(
  elements: Element[],
  axis: 'horizontal' | 'vertical',
): Element[] {
  if (elements.length < 3) return elements;

  const sorted = [...elements].sort((a, b) =>
    axis === 'horizontal' ? a.x - b.x : a.y - b.y,
  );

  if (axis === 'horizontal') {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalWidth = sorted.reduce((sum, el) => sum + el.width, 0);
    const gap = (last.x + last.width - first.x - totalWidth) / (sorted.length - 1);
    let cursor = first.x;
    return sorted.map((el) => {
      const updated = { ...el, x: cursor };
      cursor += el.width + gap;
      return updated;
    });
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalHeight = sorted.reduce((sum, el) => sum + el.height, 0);
  const gap = (last.y + last.height - first.y - totalHeight) / (sorted.length - 1);
  let cursor = first.y;
  return sorted.map((el) => {
    const updated = { ...el, y: cursor };
    cursor += el.height + gap;
    return updated;
  });
}

import type { Element, FrameElement, ID, TextElement } from '@rough/schema';
import { measureTextLayout } from '../text/textMeasure.js';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ElementMeasurer = (
  el: Element,
  directChildren: Element[],
  allElements: Record<ID, Element>,
) => { width: number; height: number };

function getSizing(el: Element, axis: 'X' | 'Y'): 'fixed' | 'hug' | 'fill' {
  return el.layoutChild?.[`sizing${axis}`] ?? 'fixed';
}

export const defaultMeasurer: ElementMeasurer = (el, directChildren, allElements) => {
  if (el.type === 'text') {
    const maxWidth =
      el.autoSize === 'auto-width' ? null : el.autoSize === 'fixed' ? el.width : el.width;
    const layout = measureTextLayout(el.text, el.textStyle, maxWidth);
    const sx = getSizing(el, 'X');
    const sy = getSizing(el, 'Y');
    return {
      width: sx === 'hug' ? Math.max(layout.width, 1) : el.width,
      height: sy === 'hug' ? Math.max(layout.height, 1) : el.height,
    };
  }

  if (el.type === 'frame' && el.autoLayout) {
    const hugW = getSizing(el, 'X') === 'hug';
    const hugH = getSizing(el, 'Y') === 'hug';
    if (hugW || hugH) {
      const size = computeFrameContentSize(el, directChildren, allElements, defaultMeasurer);
      return {
        width: hugW ? size.width : el.width,
        height: hugH ? size.height : el.height,
      };
    }
  }

  return { width: el.width, height: el.height };
};

export function computeFrameContentSize(
  frame: FrameElement,
  children: Element[],
  allElements: Record<ID, Element>,
  measurer: ElementMeasurer = defaultMeasurer,
): { width: number; height: number } {
  const layout = frame.autoLayout;
  if (!layout || children.length === 0) {
    return { width: frame.width, height: frame.height };
  }

  const sorted = [...children].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const isHorizontal = layout.direction === 'horizontal';
  const padding = layout.padding;
  const gap = layout.gap;

  let mainTotal = 0;
  let crossMax = 0;

  for (let i = 0; i < sorted.length; i++) {
    const child = sorted[i];
    const grandChildren = Object.values(allElements).filter((e) => e.parentId === child.id);
    const intrinsic = measurer(child, grandChildren, allElements);
    const mainMode = getSizing(child, isHorizontal ? 'X' : 'Y');
    const crossMode = getSizing(child, isHorizontal ? 'Y' : 'X');

    const mainSize =
      mainMode === 'hug'
        ? isHorizontal
          ? intrinsic.width
          : intrinsic.height
        : isHorizontal
          ? child.width
          : child.height;

    const crossSize =
      crossMode === 'fill'
        ? isHorizontal
          ? frame.height - padding.top - padding.bottom
          : frame.width - padding.left - padding.right
        : isHorizontal
          ? intrinsic.height
          : intrinsic.width;

    mainTotal += mainSize;
    crossMax = Math.max(crossMax, crossSize);
    if (i < sorted.length - 1) mainTotal += gap;
  }

  if (isHorizontal) {
    return {
      width: mainTotal + padding.left + padding.right,
      height: crossMax + padding.top + padding.bottom,
    };
  }
  return {
    width: crossMax + padding.left + padding.right,
    height: mainTotal + padding.top + padding.bottom,
  };
}

export function solveLayout(
  frame: FrameElement,
  children: Element[],
  allElements: Record<ID, Element>,
  measurer: ElementMeasurer = defaultMeasurer,
): Map<ID, LayoutRect> {
  const layout = frame.autoLayout;
  const result = new Map<ID, LayoutRect>();
  if (!layout || children.length === 0) return result;

  const sorted = [...children].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const isHorizontal = layout.direction === 'horizontal';
  const padding = layout.padding;
  const innerW = frame.width - padding.left - padding.right;
  const innerH = frame.height - padding.top - padding.bottom;
  const innerMain = isHorizontal ? innerW : innerH;
  const innerCross = isHorizontal ? innerH : innerW;

  const entries = sorted.map((child) => {
    const grandChildren = Object.values(allElements).filter((e) => e.parentId === child.id);
    const intrinsic = measurer(child, grandChildren, allElements);
    return {
      child,
      intrinsic,
      mainMode: getSizing(child, isHorizontal ? 'X' : 'Y'),
      crossMode: getSizing(child, isHorizontal ? 'Y' : 'X'),
    };
  });

  let fixedMain = 0;
  let hugMain = 0;
  let fillCount = 0;

  for (const e of entries) {
    const mainSize = isHorizontal ? e.intrinsic.width : e.intrinsic.height;
    if (e.mainMode === 'fill') fillCount++;
    else if (e.mainMode === 'hug') hugMain += mainSize;
    else fixedMain += isHorizontal ? e.child.width : e.child.height;
  }

  const gapTotal = layout.gap * Math.max(0, sorted.length - 1);
  let remaining = innerMain - fixedMain - hugMain - gapTotal;
  if (remaining < 0) remaining = 0;
  const fillSize = fillCount > 0 ? remaining / fillCount : 0;

  let cursor = isHorizontal ? padding.left : padding.top;

  for (const e of entries) {
    let mainSize: number;
    if (e.mainMode === 'fill') mainSize = fillSize;
    else if (e.mainMode === 'hug') mainSize = isHorizontal ? e.intrinsic.width : e.intrinsic.height;
    else mainSize = isHorizontal ? e.child.width : e.child.height;

    const crossIntrinsic = isHorizontal ? e.intrinsic.height : e.intrinsic.width;
    const crossSize = e.crossMode === 'fill' ? innerCross : crossIntrinsic;

    let crossPos = isHorizontal ? padding.top : padding.left;
    if (e.crossMode !== 'fill') {
      if (layout.alignItems === 'center') crossPos += (innerCross - crossSize) / 2;
      else if (layout.alignItems === 'end') crossPos += innerCross - crossSize;
    }

    const rect: LayoutRect = isHorizontal
      ? { x: cursor, y: crossPos, width: mainSize, height: crossSize }
      : { x: crossPos, y: cursor, width: crossSize, height: mainSize };

    result.set(e.child.id, rect);
    cursor += mainSize + layout.gap;
  }

  return result;
}

export function applyLayoutToDocument(
  elements: Record<ID, Element>,
  measurer: ElementMeasurer = defaultMeasurer,
): Element[] {
  const updated: Element[] = [];
  const merged = { ...elements };

  const frames = Object.values(merged).filter(
    (e): e is FrameElement => e.type === 'frame' && e.autoLayout !== null,
  );

  for (const frame of frames) {
    const children = Object.values(merged).filter((e) => e.parentId === frame.id);
    const layouts = solveLayout(frame, children, merged, measurer);
    for (const [childId, rect] of layouts) {
      const child = merged[childId];
      if (!child) continue;
      const next = {
        ...child,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
      merged[childId] = next;
      updated.push(next);
    }
  }

  return updated;
}

export function inferAutoLayoutDirection(elements: Element[]): 'horizontal' | 'vertical' {
  if (elements.length < 2) return 'horizontal';
  const xs = elements.map((e) => e.x + e.width / 2);
  const ys = elements.map((e) => e.y + e.height / 2);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  return xSpread >= ySpread ? 'horizontal' : 'vertical';
}

export function defaultAutoLayout(
  direction: 'horizontal' | 'vertical',
): NonNullable<FrameElement['autoLayout']> {
  return {
    direction,
    gap: 8,
    padding: { top: 8, right: 8, bottom: 8, left: 8 },
    alignItems: 'start',
    justifyContent: 'start',
  };
}

export function measureTextElement(el: TextElement): { width: number; height: number } {
  const maxWidth = el.autoSize === 'auto-width' ? null : el.width;
  const layout = measureTextLayout(el.text, el.textStyle, maxWidth);
  return { width: Math.max(layout.width, 1), height: Math.max(layout.height, 1) };
}

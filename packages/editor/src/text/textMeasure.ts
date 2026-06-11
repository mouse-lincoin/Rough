import type { TextStyle } from '@rough/schema';
import { LRUCache } from 'lru-cache';

export interface TextLayoutLine {
  text: string;
  width: number;
}

export interface TextLayout {
  lines: TextLayoutLine[];
  width: number;
  height: number;
}

const layoutCache = new LRUCache<string, TextLayout>({ max: 500 });

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  return measureCtx;
}

/** Rough width estimate when canvas measureText is unavailable (e.g. node tests). */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

function fontString(style: TextStyle): string {
  return `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
}

function cacheKey(text: string, style: TextStyle, maxWidth: number | null): string {
  return JSON.stringify({ text, style, maxWidth });
}

function isCJK(char: string): boolean {
  return /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(char);
}

export function measureTextLayout(
  text: string,
  style: TextStyle,
  maxWidth: number | null,
): TextLayout {
  const key = cacheKey(text, style, maxWidth);
  const cached = layoutCache.get(key);
  if (cached) return cached;

  const ctx = getMeasureCtx();
  const measureWidth = (s: string): number =>
    ctx ? ctx.measureText(s).width : estimateTextWidth(s, style.fontSize);

  if (ctx) ctx.font = fontString(style);
  const lineHeight = style.fontSize * style.lineHeight;
  const paragraphs = text.split('\n');
  const lines: TextLayoutLine[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push({ text: '', width: 0 });
      continue;
    }

    if (maxWidth === null) {
      lines.push({ text: paragraph, width: measureWidth(paragraph) });
      continue;
    }

    let current = '';
    for (const char of paragraph) {
      const test = current + char;
      const w = measureWidth(test);
      const breakHere =
        w > maxWidth &&
        current.length > 0 &&
        (char === ' ' || isCJK(char) || measureWidth(current) > maxWidth);
      if (breakHere) {
        lines.push({ text: current.trimEnd(), width: measureWidth(current.trimEnd()) });
        current = isCJK(char) ? char : char.trimStart();
      } else {
        current = test;
      }
    }
    if (current.length > 0) {
      lines.push({ text: current, width: measureWidth(current) });
    }
  }

  const width =
    maxWidth === null
      ? Math.max(...lines.map((l) => l.width), 0)
      : maxWidth;
  const height = lines.length * lineHeight;
  const layout: TextLayout = { lines, width, height };
  layoutCache.set(key, layout);
  return layout;
}

export function clearTextMeasureCache(): void {
  layoutCache.clear();
}

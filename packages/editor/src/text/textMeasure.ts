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

const measureCanvas = document.createElement('canvas');
const measureCtx = measureCanvas.getContext('2d')!;

const layoutCache = new LRUCache<string, TextLayout>({ max: 500 });

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

  measureCtx.font = fontString(style);
  const lineHeight = style.fontSize * style.lineHeight;
  const paragraphs = text.split('\n');
  const lines: TextLayoutLine[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push({ text: '', width: 0 });
      continue;
    }

    if (maxWidth === null) {
      lines.push({ text: paragraph, width: measureCtx.measureText(paragraph).width });
      continue;
    }

    let current = '';
    for (const char of paragraph) {
      const test = current + char;
      const w = measureCtx.measureText(test).width;
      const breakHere =
        w > maxWidth &&
        current.length > 0 &&
        (char === ' ' || isCJK(char) || measureCtx.measureText(current).width > maxWidth);
      if (breakHere) {
        lines.push({ text: current.trimEnd(), width: measureCtx.measureText(current.trimEnd()).width });
        current = isCJK(char) ? char : char.trimStart();
      } else {
        current = test;
      }
    }
    if (current.length > 0) {
      lines.push({ text: current, width: measureCtx.measureText(current).width });
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

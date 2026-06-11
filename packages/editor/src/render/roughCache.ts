import { LRUCache } from 'lru-cache';
import rough from 'roughjs/bin/rough';
import type { Drawable } from 'roughjs/bin/core';
import type { Element } from '@rough/schema';

const cache = new LRUCache<string, Drawable>({ max: 2000 });

function hashElement(element: Element, w: number, h: number): string {
  return JSON.stringify({
    type: element.type,
    w,
    h,
    cornerRadius: element.type === 'rectangle' ? element.cornerRadius : undefined,
    fills: element.fills,
    strokes: element.strokes,
    roughness: element.roughness,
    roughSeed: element.roughSeed,
    points: element.type === 'line' || element.type === 'path' ? element.points : undefined,
  });
}

export function getRoughGenerator(): ReturnType<typeof rough.generator> {
  return rough.generator();
}

export function getOrCreateDrawable(
  element: Element,
  w: number,
  h: number,
  factory: () => Drawable,
): Drawable {
  const key = hashElement(element, w, h);
  const cached = cache.get(key);
  if (cached) return cached;
  const drawable = factory();
  cache.set(key, drawable);
  return drawable;
}

export function clearRoughCache(): void {
  cache.clear();
}

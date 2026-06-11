import * as Y from 'yjs';
import type { Element, TextElement } from '@rough/schema';

const JSON_PROPS = new Set([
  'fills',
  'strokes',
  'effects',
  'points',
  'pressure',
  'cornerRadius',
  'textStyle',
  'overrides',
  'background',
  'autoLayout',
  'layoutChild',
  'naturalSize',
  'startBinding',
  'endBinding',
]);

export function elementToYMap(element: Element): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(element)) {
    if (key === 'text' && element.type === 'text') {
      ymap.set('text', new Y.Text((element as TextElement).text));
      continue;
    }
    if (JSON_PROPS.has(key) && value !== null && value !== undefined) {
      ymap.set(key, structuredClone(value));
      continue;
    }
    ymap.set(key, value);
  }
  return ymap;
}

export function yMapToElement(ymap: Y.Map<unknown>): Element {
  const result: Record<string, unknown> = {};
  ymap.forEach((value, key) => {
    if (key === 'text' && value instanceof Y.Text) {
      result.text = value.toString();
    } else {
      result[key] = value;
    }
  });
  return result as unknown as Element;
}

export function applyElementToYMap(ymap: Y.Map<unknown>, element: Element): void {
  const existingKeys = new Set<string>();
  ymap.forEach((_v, key) => existingKeys.add(key));

  for (const [key, value] of Object.entries(element)) {
    existingKeys.delete(key);
    if (key === 'text' && element.type === 'text') {
      const existing = ymap.get('text');
      if (existing instanceof Y.Text) {
        const newText = (element as TextElement).text;
        if (existing.toString() !== newText) {
          existing.delete(0, existing.length);
          existing.insert(0, newText);
        }
      } else {
        ymap.set('text', new Y.Text((element as TextElement).text));
      }
      continue;
    }
    if (JSON_PROPS.has(key)) {
      ymap.set(key, value === null || value === undefined ? null : structuredClone(value));
      continue;
    }
    ymap.set(key, value);
  }

  for (const key of existingKeys) {
    if (key !== 'text') {
      ymap.delete(key);
    }
  }
}

export function elementsMapFromYPage(pageMap: Y.Map<unknown>): Record<string, Element> {
  const elementsYMap = pageMap.get('elements') as Y.Map<Y.Map<unknown>> | undefined;
  const result: Record<string, Element> = {};
  if (!elementsYMap) return result;
  elementsYMap.forEach((elMap, id) => {
    result[id] = yMapToElement(elMap);
  });
  return result;
}

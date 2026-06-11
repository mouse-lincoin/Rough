import * as Y from 'yjs';
import type { ComponentDef, Element, ID } from '@rough/schema';
import { applyElementToYMap, elementToYMap, yMapToElement } from './yjsMapping.js';

export function componentToYMap(def: ComponentDef): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  ymap.set('id', def.id);
  ymap.set('name', def.name);
  ymap.set('description', def.description);
  ymap.set('rootId', def.rootId);
  ymap.set('semantic', def.semantic);

  const elementsMap = new Y.Map<Y.Map<unknown>>();
  for (const [elId, el] of Object.entries(def.elements)) {
    elementsMap.set(elId, elementToYMap(el));
  }
  ymap.set('elements', elementsMap);
  return ymap;
}

export function yMapToComponent(ymap: Y.Map<unknown>): ComponentDef {
  const elementsYMap = ymap.get('elements') as Y.Map<Y.Map<unknown>> | undefined;
  const elements: Record<ID, Element> = {};
  elementsYMap?.forEach((elMap, id) => {
    elements[id] = yMapToElement(elMap);
  });

  return {
    id: ymap.get('id') as ID,
    name: (ymap.get('name') as string) ?? '',
    description: (ymap.get('description') as string) ?? '',
    rootId: ymap.get('rootId') as ID,
    elements,
    semantic: (ymap.get('semantic') as ComponentDef['semantic']) ?? null,
  };
}

export function applyComponentToYMap(ymap: Y.Map<unknown>, def: ComponentDef): void {
  ymap.set('name', def.name);
  ymap.set('description', def.description);
  ymap.set('rootId', def.rootId);
  ymap.set('semantic', def.semantic);

  let elementsYMap = ymap.get('elements') as Y.Map<Y.Map<unknown>> | undefined;
  if (!elementsYMap) {
    elementsYMap = new Y.Map();
    ymap.set('elements', elementsYMap);
  }

  const existingIds = new Set<ID>();
  elementsYMap.forEach((_v, id) => existingIds.add(id));

  for (const [elId, el] of Object.entries(def.elements)) {
    existingIds.delete(elId);
    const existing = elementsYMap.get(elId);
    if (existing) {
      applyElementToYMap(existing, el);
    } else {
      elementsYMap.set(elId, elementToYMap(el));
    }
  }

  for (const id of existingIds) {
    elementsYMap.delete(id);
  }
}

export function componentsFromYDoc(componentsMap: Y.Map<unknown>): Record<ID, ComponentDef> {
  const result: Record<ID, ComponentDef> = {};
  componentsMap.forEach((value, id) => {
    if (value instanceof Y.Map) {
      result[id] = yMapToComponent(value);
    }
  });
  return result;
}

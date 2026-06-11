import type { Element, ID } from '@rough/schema';
import { createId } from '@rough/shared';
import type { DocumentStore } from '@rough/document';

export const ROUGH_CLIPBOARD_MIME = 'application/x-rough+json';

export interface ClipboardPayload {
  elements: Element[];
  documentId: string;
}

export function collectSubtree(elements: Record<ID, Element>, rootIds: ID[]): Element[] {
  const result: Element[] = [];
  const visited = new Set<ID>();

  const walk = (id: ID): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const el = elements[id];
    if (!el) return;
    result.push(structuredClone(el));
    for (const child of Object.values(elements)) {
      if (child.parentId === id) walk(child.id);
    }
  };

  for (const id of rootIds) walk(id);
  return result;
}

export function serializeClipboard(documentId: string, elements: Element[]): string {
  const payload: ClipboardPayload = { elements, documentId };
  return JSON.stringify(payload);
}

export function deserializeClipboard(text: string): ClipboardPayload | null {
  try {
    return JSON.parse(text) as ClipboardPayload;
  } catch {
    return null;
  }
}

export function remapClipboardElements(
  elements: Element[],
  targetParentId: ID | null,
  offsetX: number,
  offsetY: number,
  getSortKey: () => string,
): Element[] {
  const idMap = new Map<ID, ID>();
  for (const el of elements) idMap.set(el.id, createId());

  const roots = elements.filter((el) => !elements.some((p) => p.id === el.parentId));
  const rootSet = new Set(roots.map((r) => r.id));

  return elements.map((el) => {
    const newId = idMap.get(el.id)!;
    const isRoot = rootSet.has(el.id);
    let parentId: ID | null;
    if (isRoot) {
      parentId = targetParentId;
    } else {
      parentId = el.parentId ? (idMap.get(el.parentId) ?? null) : null;
    }

    return {
      ...el,
      id: newId,
      parentId,
      sortKey: isRoot ? getSortKey() : el.sortKey,
      x: isRoot ? el.x + offsetX : el.x,
      y: isRoot ? el.y + offsetY : el.y,
    };
  });
}

export async function writeToClipboard(
  documentId: string,
  elements: Element[],
): Promise<void> {
  const json = serializeClipboard(documentId, elements);
  await navigator.clipboard.write([
    new ClipboardItem({
      [ROUGH_CLIPBOARD_MIME]: new Blob([json], { type: ROUGH_CLIPBOARD_MIME }),
      'text/plain': new Blob([json], { type: 'text/plain' }),
    }),
  ]);
}

export async function readFromClipboard(): Promise<ClipboardPayload | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes(ROUGH_CLIPBOARD_MIME)) {
        const blob = await item.getType(ROUGH_CLIPBOARD_MIME);
        const text = await blob.text();
        return deserializeClipboard(text);
      }
    }
    const text = await navigator.clipboard.readText();
    return deserializeClipboard(text);
  } catch {
    return null;
  }
}

export function duplicateElements(
  store: DocumentStore,
  rootIds: ID[],
  offsetX = 16,
  offsetY = 16,
): ID[] {
  const subtree = collectSubtree(store.getElements(), rootIds);
  const parentId = store.getElement(rootIds[0])?.parentId ?? null;
  const remapped = remapClipboardElements(subtree, parentId, offsetX, offsetY, () =>
    store.getNextSortKey(parentId),
  );
  store.setElements(remapped);
  const oldToNew = new Map<ID, ID>();
  for (let i = 0; i < subtree.length; i++) {
    oldToNew.set(subtree[i].id, remapped[i].id);
  }
  return rootIds.map((id) => oldToNew.get(id)!).filter(Boolean);
}

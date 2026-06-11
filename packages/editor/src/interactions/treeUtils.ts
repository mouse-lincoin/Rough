import type { Element, ID } from '@rough/schema';

/** True when `nodeId` is nested under `ancestorId`. */
export function isDescendantOf(
  elements: Record<ID, Element>,
  ancestorId: ID,
  nodeId: ID,
): boolean {
  let current = elements[nodeId];
  while (current?.parentId) {
    current = elements[current.parentId];
    if (current?.id === ancestorId) return true;
  }
  return false;
}

/** Roots of a selection — excludes children whose parent is also selected. */
export function getSelectionRoots(elements: Record<ID, Element>, ids: ID[]): ID[] {
  const idSet = new Set(ids);
  return ids.filter((id) => {
    const el = elements[id];
    if (!el?.parentId) return true;
    return !idSet.has(el.parentId);
  });
}

export function canReparentTo(
  elements: Record<ID, Element>,
  elementId: ID,
  newParentId: ID | null,
): boolean {
  if (newParentId === null) return true;
  if (elementId === newParentId) return false;
  return !isDescendantOf(elements, elementId, newParentId);
}

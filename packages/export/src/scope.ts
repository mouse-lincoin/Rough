import type { Element, FrameElement, ID, Page } from '@rough/schema';

/** Export targets: selected roots, or all top-level frames when nothing selected. */
export function resolveExportTargets(
  elements: Record<ID, Element>,
  selectionIds: Iterable<ID>,
): ID[] {
  const selected = [...selectionIds];
  if (selected.length > 0) {
    const roots = selected.map((id) => findExportRoot(elements, id)).filter(Boolean) as ID[];
    return [...new Set(roots)];
  }

  return Object.values(elements)
    .filter((e): e is FrameElement => e.type === 'frame' && e.parentId === null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id))
    .map((e) => e.id);
}

function findExportRoot(elements: Record<ID, Element>, id: ID): ID | null {
  let current = elements[id];
  if (!current) return null;
  while (current.parentId) {
    const parent = elements[current.parentId];
    if (!parent) break;
    current = parent;
  }
  return current.id;
}

export function getSubtreeIds(elements: Record<ID, Element>, rootId: ID): Set<ID> {
  const ids = new Set<ID>();
  const walk = (id: ID): void => {
    ids.add(id);
    for (const el of Object.values(elements)) {
      if (el.parentId === id) walk(el.id);
    }
  };
  walk(rootId);
  return ids;
}

export function getDirectChildren(elements: Record<ID, Element>, parentId: ID | null): Element[] {
  return Object.values(elements)
    .filter((e) => e.parentId === parentId)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));
}

export function getPageElements(page: Page): Record<ID, Element> {
  return page.elements;
}

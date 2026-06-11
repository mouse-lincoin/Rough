import type { Element, ID } from '@rough/schema';
import { generateKeyBetween } from '@rough/shared';
import type { DocumentStore } from '@rough/document';
import type { Command } from '../undo/Command.js';

function reorderSibling(
  store: DocumentStore,
  elementId: ID,
  direction: 'forward' | 'backward' | 'front' | 'back',
): Element | null {
  const el = store.getElement(elementId);
  if (!el) return null;

  const siblings = store.getChildren(el.parentId);
  const index = siblings.findIndex((s) => s.id === elementId);
  if (index < 0) return null;

  let newSortKey: string;
  switch (direction) {
    case 'forward': {
      if (index >= siblings.length - 1) return null;
      const next = siblings[index + 1];
      const afterNext = siblings[index + 2];
      newSortKey = generateKeyBetween(next.sortKey, afterNext?.sortKey ?? null);
      break;
    }
    case 'backward': {
      if (index <= 0) return null;
      const prev = siblings[index - 1];
      const beforePrev = siblings[index - 2];
      newSortKey = generateKeyBetween(beforePrev?.sortKey ?? null, prev.sortKey);
      break;
    }
    case 'front': {
      const top = siblings[siblings.length - 1];
      if (top.id === elementId) return null;
      newSortKey = generateKeyBetween(top.sortKey, null);
      break;
    }
    case 'back': {
      const bottom = siblings[0];
      if (bottom.id === elementId) return null;
      newSortKey = generateKeyBetween(null, bottom.sortKey);
      break;
    }
  }

  return { ...el, sortKey: newSortKey };
}

export class ReorderLayerCommand implements Command {
  private before: Element[] = [];
  private after: Element[] = [];

  constructor(
    private store: DocumentStore,
    private ids: ID[],
    private direction: 'forward' | 'backward' | 'front' | 'back',
  ) {}

  execute(): void {
    this.before = this.ids
      .map((id) => this.store.getElement(id))
      .filter((e): e is Element => e !== undefined)
      .map((e) => structuredClone(e));

    this.after = this.ids
      .map((id) => reorderSibling(this.store, id, this.direction))
      .filter((e): e is Element => e !== undefined);

    if (this.after.length > 0) {
      this.store.setElements(this.after);
    }
  }

  undo(): void {
    this.store.setElements(this.before);
  }
}

import type { DocumentStore } from '@rough/document';
import type { Element, ID } from '@rough/schema';
import { applyLayoutToDocument, reorderAutoLayoutChildren } from '../layout/autoLayout.js';
import type { Command } from '../undo/Command.js';

export class ReorderAutoLayoutCommand implements Command {
  private before: Element[] = [];
  private after: Element[] = [];

  constructor(
    private store: DocumentStore,
    private frameId: ID,
    private draggedIds: ID[],
    private beforeSiblingId: ID | null,
  ) {}

  execute(): void {
    const elements = this.store.getElements();
    const frame = elements[this.frameId];
    if (!frame || frame.type !== 'frame' || !frame.autoLayout) return;

    const reordered = reorderAutoLayoutChildren(
      elements,
      this.frameId,
      this.draggedIds,
      this.beforeSiblingId,
      this.store,
    );
    if (reordered.length === 0) return;

    this.before = reordered.map((el) => structuredClone(elements[el.id]!));

    const merged = { ...elements };
    for (const el of reordered) merged[el.id] = el;

    const layoutUpdates = applyLayoutToDocument(merged);
    for (const el of layoutUpdates) merged[el.id] = el;

    this.after = [...reordered, ...layoutUpdates];
    const unique = new Map<ID, Element>();
    for (const el of this.after) unique.set(el.id, el);
    this.after = [...unique.values()];

    this.store.setElements(this.after);
  }

  undo(): void {
    if (this.before.length > 0) this.store.setElements(this.before);
  }
}

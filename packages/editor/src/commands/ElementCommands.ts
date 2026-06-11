import type { Element, ID } from '@rough/schema';
import type { MemoryDocumentStore } from '../document/MemoryDocumentStore.js';
import type { Command } from '../undo/Command.js';

export class AddElementCommand implements Command {
  constructor(
    private store: MemoryDocumentStore,
    private element: Element,
  ) {}

  execute(): void {
    this.store.addElement(this.element);
  }

  undo(): void {
    this.store.removeElement(this.element.id);
  }
}

export class DeleteElementsCommand implements Command {
  private snapshots: Element[] = [];

  constructor(
    private store: MemoryDocumentStore,
    private ids: ID[],
  ) {}

  execute(): void {
    this.snapshots = this.ids
      .map((id) => this.store.getElement(id))
      .filter((e): e is Element => e !== undefined);
    this.store.removeElements(this.ids);
  }

  undo(): void {
    this.store.setElements(this.snapshots);
  }
}

export class UpdateElementsCommand implements Command {
  private before: Element[] = [];
  private after: Element[];

  constructor(
    private store: MemoryDocumentStore,
    after: Element[],
  ) {
    this.after = after.map((e) => structuredClone(e));
  }

  execute(): void {
    if (this.before.length === 0) {
      this.before = this.after
        .map((e) => this.store.getElement(e.id))
        .filter((e): e is Element => e !== undefined)
        .map((e) => structuredClone(e));
    }
    this.store.setElements(this.after);
  }

  undo(): void {
    this.store.setElements(this.before);
  }
}

export class ReplaceElementsCommand implements Command {
  private before: Record<ID, Element> = {};

  constructor(
    private store: MemoryDocumentStore,
    private after: Record<ID, Element>,
  ) {}

  execute(): void {
    if (Object.keys(this.before).length === 0) {
      this.before = this.store.cloneElements();
    }
    this.store.replaceElements(structuredClone(this.after));
  }

  undo(): void {
    this.store.restoreElements(this.before);
  }
}

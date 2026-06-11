import type { Element, ID } from '@rough/schema';
import type { DocumentStore } from '@rough/document';
import type { Command } from '../undo/Command.js';

export class AddElementCommand implements Command {
  constructor(
    private store: DocumentStore,
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
    private store: DocumentStore,
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
    private store: DocumentStore,
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


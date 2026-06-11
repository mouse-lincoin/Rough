import type { Element, GroupElement, ID } from '@rough/schema';
import { createId } from '@rough/shared';
import type { DocumentStore } from '@rough/document';
import type { Command } from '../undo/Command.js';

function getCommonParent(elements: Element[]): ID | null {
  const parents = new Set(elements.map((e) => e.parentId));
  if (parents.size !== 1) return null;
  return elements[0].parentId;
}

export class GroupElementsCommand implements Command {
  private groupId: ID | null = null;
  private before: Element[] = [];
  private after: Element[] = [];

  constructor(
    private store: DocumentStore,
    private ids: ID[],
  ) {}

  execute(): void {
    const elements = this.ids
      .map((id) => this.store.getElement(id))
      .filter((e): e is Element => e !== undefined);
    if (elements.length < 2) return;

    this.before = elements.map((e) => structuredClone(e));
    const parentId = getCommonParent(elements);
    if (parentId === undefined && elements.some((e) => e.parentId !== elements[0].parentId)) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    const groupId = createId();
    this.groupId = groupId;
    const sortKey = this.store.getNextSortKey(parentId);

    const group: GroupElement = {
      id: groupId,
      type: 'group',
      name: '编组',
      parentId,
      sortKey,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fills: [],
      strokes: [],
      effects: [],
      semantic: null,
      roughness: 0,
      roughSeed: 0,
    };

    const children = elements.map((el) => ({
      ...el,
      parentId: groupId,
      x: el.x - minX,
      y: el.y - minY,
    }));

    this.after = [group, ...children];
    this.store.setElements(this.after);
  }

  undo(): void {
    this.store.setElements(this.before);
    if (this.groupId) {
      this.store.removeElement(this.groupId);
    }
  }
}

export class UngroupElementsCommand implements Command {
  private before: Element[] = [];
  private groupIds: ID[] = [];

  constructor(
    private store: DocumentStore,
    private ids: ID[],
  ) {}

  execute(): void {
    const groups = this.ids
      .map((id) => this.store.getElement(id))
      .filter((e): e is GroupElement => e?.type === 'group');
    if (groups.length === 0) return;

    this.groupIds = groups.map((g) => g.id);
    const allElements = Object.values(this.store.getElements());
    this.before = allElements
      .filter((e) => groups.some((g) => g.id === e.id || e.parentId === g.id))
      .map((e) => structuredClone(e));

    const updated: Element[] = [];
    for (const group of groups) {
      const children = allElements.filter((e) => e.parentId === group.id);
      for (const child of children) {
        updated.push({
          ...child,
          parentId: group.parentId,
          x: child.x + group.x,
          y: child.y + group.y,
        });
      }
    }

    this.store.removeElements(this.groupIds);
    this.store.setElements(updated);
  }

  undo(): void {
    this.store.setElements(this.before);
  }
}

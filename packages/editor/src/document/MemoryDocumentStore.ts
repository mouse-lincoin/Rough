import type { Element, ID, Page, RoughDocument } from '@rough/schema';
import { CANVAS_BACKGROUND, createId, generateKeyBetween } from '@rough/shared';
import { CURRENT_SCHEMA_VERSION } from '@rough/schema';

type Listener = () => void;

export class MemoryDocumentStore {
  private doc: RoughDocument;
  private listeners = new Set<Listener>();
  private currentPageId: ID;
  private batchDepth = 0;
  private batched = false;

  constructor() {
    const pageId = createId();
    this.currentPageId = pageId;
    this.doc = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: createId(),
      name: '未命名',
      pages: {
        [pageId]: {
          id: pageId,
          name: '页面 1',
          elements: {},
          background: CANVAS_BACKGROUND,
        },
      },
      pageOrder: [pageId],
      components: {},
      assets: {},
    };
  }

  getDocument(): RoughDocument {
    return this.doc;
  }

  getCurrentPageId(): ID {
    return this.currentPageId;
  }

  getPage(): Page {
    return this.doc.pages[this.currentPageId];
  }

  getElements(): Record<ID, Element> {
    return this.getPage().elements;
  }

  getElement(id: ID): Element | undefined {
    return this.getPage().elements[id];
  }

  getRootElements(): Element[] {
    return Object.values(this.getElements()).filter((e) => e.parentId === null);
  }

  getNextSortKey(): string {
    const roots = this.getRootElements();
    if (roots.length === 0) return generateKeyBetween(null, null);
    const maxKey = roots.reduce((max, e) => (e.sortKey > max ? e.sortKey : max), roots[0].sortKey);
    return generateKeyBetween(maxKey, null);
  }

  transact(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.batched) {
        this.batched = false;
        this.notify();
      }
    }
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private markDirty(): void {
    if (this.batchDepth > 0) {
      this.batched = true;
    } else {
      this.notify();
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setElement(element: Element): void {
    this.getPage().elements[element.id] = element;
    this.markDirty();
  }

  setElements(elements: Element[]): void {
    const page = this.getPage();
    for (const el of elements) {
      page.elements[el.id] = el;
    }
    this.markDirty();
  }

  addElement(element: Element): void {
    this.setElement(element);
  }

  removeElement(id: ID): void {
    delete this.getPage().elements[id];
    this.markDirty();
  }

  removeElements(ids: ID[]): void {
    const page = this.getPage();
    for (const id of ids) {
      delete page.elements[id];
    }
    this.markDirty();
  }

  replaceElements(elements: Record<ID, Element>): void {
    this.getPage().elements = elements;
    this.markDirty();
  }

  cloneElements(): Record<ID, Element> {
    const result: Record<ID, Element> = {};
    for (const [id, el] of Object.entries(this.getPage().elements)) {
      result[id] = structuredClone(el);
    }
    return result;
  }

  restoreElements(elements: Record<ID, Element>): void {
    this.getPage().elements = structuredClone(elements);
    this.notify();
  }
}

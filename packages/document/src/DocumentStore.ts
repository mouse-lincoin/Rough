import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Element, ID, Page, RGBA, RoughDocument } from '@rough/schema';
import { CANVAS_BACKGROUND, createId, generateKeyBetween } from '@rough/shared';
import { CURRENT_SCHEMA_VERSION } from '@rough/schema';
import { LOCAL_ORIGIN, PREVIEW_ORIGIN } from './constants.js';
import { DocumentUndoManager } from './undo.js';
import {
  applyElementToYMap,
  elementToYMap,
  elementsMapFromYPage,
} from './yjsMapping.js';
import { touchDocumentMeta } from './metaStore.js';

type Listener = () => void;

export class DocumentStore {
  readonly ydoc: Y.Doc;
  readonly undo: DocumentUndoManager;
  private persistence: IndexeddbPersistence | null = null;
  private listeners = new Set<Listener>();
  private currentPageId: ID;
  private documentId: ID;

  private constructor(ydoc: Y.Doc, documentId: ID, currentPageId: ID) {
    this.ydoc = ydoc;
    this.documentId = documentId;
    this.currentPageId = currentPageId;
    this.undo = new DocumentUndoManager(ydoc);
    this.ydoc.on('update', () => {
      void touchDocumentMeta(this.documentId);
      this.notify();
    });
  }

  static initializeYDoc(ydoc: Y.Doc, documentId: ID, name = '未命名'): ID {
    const pageId = createId();
    const meta = ydoc.getMap('meta');
    meta.set('name', name);
    meta.set('schemaVersion', CURRENT_SCHEMA_VERSION);
    meta.set('id', documentId);

    const pages = ydoc.getMap('pages');
    const pageMap = new Y.Map<unknown>();
    pageMap.set('id', pageId);
    pageMap.set('name', '页面 1');
    pageMap.set('background', CANVAS_BACKGROUND);
    pageMap.set('elements', new Y.Map());
    pages.set(pageId, pageMap);

    const pageOrder = ydoc.getArray<ID>('pageOrder');
    pageOrder.push([pageId]);

    ydoc.getMap('components');
    ydoc.getMap('assets');
    return pageId;
  }

  static createNew(name = '未命名'): DocumentStore {
    const ydoc = new Y.Doc();
    const documentId = createId();
    const pageId = DocumentStore.initializeYDoc(ydoc, documentId, name);
    return new DocumentStore(ydoc, documentId, pageId);
  }

  static async load(documentId: ID, name = '未命名'): Promise<DocumentStore> {
    const ydoc = new Y.Doc();
    const persistence = new IndexeddbPersistence(`rough-doc-${documentId}`, ydoc);
    await persistence.whenSynced;

    const pages = ydoc.getMap('pages');
    let pageId: ID;
    if (pages.size === 0) {
      pageId = DocumentStore.initializeYDoc(ydoc, documentId, name);
    } else {
      const pageOrder = ydoc.getArray<ID>('pageOrder');
      pageId = (pageOrder.get(0) as ID) ?? createId();
    }

    const store = new DocumentStore(ydoc, documentId, pageId);
    store.persistence = persistence;
    return store;
  }

  static fromYDoc(ydoc: Y.Doc): DocumentStore {
    const meta = ydoc.getMap('meta');
    const documentId = (meta.get('id') as ID) ?? createId();
    const pageOrder = ydoc.getArray<ID>('pageOrder');
    const currentPageId = (pageOrder.get(0) as ID) ?? createId();
    return new DocumentStore(ydoc, documentId, currentPageId);
  }

  async bindPersistence(): Promise<void> {
    if (this.persistence) return;
    this.persistence = new IndexeddbPersistence(`rough-doc-${this.documentId}`, this.ydoc);
    await this.persistence.whenSynced;
  }

  getDocumentId(): ID {
    return this.documentId;
  }

  getDocument(): RoughDocument {
    const meta = this.ydoc.getMap('meta');
    const pages = this.ydoc.getMap('pages');
    const pageOrder = this.ydoc.getArray<ID>('pageOrder');
    const components = this.ydoc.getMap('components');
    const assets = this.ydoc.getMap('assets');

    const pagesRecord: Record<ID, Page> = {};
    pages.forEach((pageMap, pageId) => {
      if (!(pageMap instanceof Y.Map)) return;
      pagesRecord[pageId] = {
        id: pageId,
        name: (pageMap.get('name') as string) ?? '页面',
        background: (pageMap.get('background') as RGBA) ?? CANVAS_BACKGROUND,
        elements: elementsMapFromYPage(pageMap),
      };
    });

    return {
      schemaVersion: (meta.get('schemaVersion') as number) ?? CURRENT_SCHEMA_VERSION,
      id: this.documentId,
      name: (meta.get('name') as string) ?? '未命名',
      pages: pagesRecord,
      pageOrder: pageOrder.toArray(),
      components: components.toJSON() as RoughDocument['components'],
      assets: assets.toJSON() as RoughDocument['assets'],
    };
  }

  getCurrentPageId(): ID {
    return this.currentPageId;
  }

  setCurrentPageId(pageId: ID): void {
    this.currentPageId = pageId;
    this.notify();
  }

  getPage(): Page {
    return this.getDocument().pages[this.currentPageId];
  }

  getElements(): Record<ID, Element> {
    return this.getPage().elements;
  }

  getElement(id: ID): Element | undefined {
    return this.getElements()[id];
  }

  private getPageYMap(): Y.Map<unknown> {
    return this.ydoc.getMap('pages').get(this.currentPageId) as Y.Map<unknown>;
  }

  private getElementsYMap(): Y.Map<Y.Map<unknown>> {
    return this.getPageYMap().get('elements') as Y.Map<Y.Map<unknown>>;
  }

  getChildren(parentId: ID | null): Element[] {
    return Object.values(this.getElements())
      .filter((e) => e.parentId === parentId)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.id.localeCompare(b.id));
  }

  getNextSortKey(parentId: ID | null = null): string {
    const siblings = this.getChildren(parentId);
    if (siblings.length === 0) return generateKeyBetween(null, null);
    const maxKey = siblings.reduce((max, e) => (e.sortKey > max ? e.sortKey : max), siblings[0].sortKey);
    return generateKeyBetween(maxKey, null);
  }

  transact(fn: () => void, origin: string = LOCAL_ORIGIN): void {
    this.ydoc.transact(fn, origin);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  setElement(element: Element, origin: string = LOCAL_ORIGIN): void {
    this.transact(() => {
      const elementsMap = this.getElementsYMap();
      const existing = elementsMap.get(element.id);
      if (existing) {
        applyElementToYMap(existing, element);
      } else {
        elementsMap.set(element.id, elementToYMap(element));
      }
    }, origin);
  }

  setElements(elements: Element[], origin: string = LOCAL_ORIGIN): void {
    this.transact(() => {
      for (const el of elements) {
        const elementsMap = this.getElementsYMap();
        const existing = elementsMap.get(el.id);
        if (existing) {
          applyElementToYMap(existing, el);
        } else {
          elementsMap.set(el.id, elementToYMap(el));
        }
      }
    }, origin);
  }

  addElement(element: Element, origin: string = LOCAL_ORIGIN): void {
    this.setElement(element, origin);
  }

  removeElement(id: ID, origin: string = LOCAL_ORIGIN): void {
    this.transact(() => {
      this.getElementsYMap().delete(id);
    }, origin);
  }

  removeElements(ids: ID[], origin: string = LOCAL_ORIGIN): void {
    this.transact(() => {
      const elementsMap = this.getElementsYMap();
      for (const id of ids) {
        elementsMap.delete(id);
      }
    }, origin);
  }

  /** Live preview updates during drag — not tracked by undo */
  setElementsPreview(elements: Element[]): void {
    this.setElements(elements, PREVIEW_ORIGIN);
  }

  setElementPreview(element: Element): void {
    this.setElement(element, PREVIEW_ORIGIN);
  }

  updateDocumentName(name: string): void {
    this.transact(() => {
      this.ydoc.getMap('meta').set('name', name);
    });
  }

  addAssetRef(ref: import('@rough/schema').AssetRef): void {
    this.transact(() => {
      this.ydoc.getMap('assets').set(ref.id, ref);
    });
  }

  destroy(): void {
    this.persistence?.destroy();
    this.persistence = null;
  }
}

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { ComponentDef, Element, ID, Page, RGBA, RoughDocument, Vec2 } from '@rough/schema';
import {
  applyComponentToYMap,
  componentToYMap,
  componentsFromYDoc,
} from './componentMapping.js';
import { CANVAS_BACKGROUND, createId, generateKeyBetween } from '@rough/shared';
import { CURRENT_SCHEMA_VERSION, migrateDocument } from '@rough/schema';
import { LOCAL_ORIGIN, PREVIEW_ORIGIN } from './constants.js';
import { CollabSession, type CollabOptions } from './collab.js';
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
  private collab = new CollabSession();
  private listeners = new Set<Listener>();
  private currentPageId: ID;
  private documentId: ID;
  private readOnly = false;

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
      components: componentsFromYDoc(components),
      assets: assets.toJSON() as RoughDocument['assets'],
    };
  }

  getCurrentPageId(): ID {
    return this.currentPageId;
  }

  setCurrentPageId(pageId: ID): void {
    if (pageId === this.currentPageId) return;
    this.currentPageId = pageId;
    this.notify();
  }

  getPageOrder(): ID[] {
    return this.ydoc.getArray<ID>('pageOrder').toArray();
  }

  getPages(): Page[] {
    const doc = this.getDocument();
    return doc.pageOrder.map((id) => doc.pages[id]).filter(Boolean);
  }

  addPage(name?: string): ID {
    const pageId = createId();
    this.transact(() => {
      const pages = this.ydoc.getMap('pages');
      const pageMap = new Y.Map<unknown>();
      pageMap.set('id', pageId);
      pageMap.set('name', name ?? `页面 ${pages.size + 1}`);
      pageMap.set('background', CANVAS_BACKGROUND);
      pageMap.set('elements', new Y.Map());
      pages.set(pageId, pageMap);
      this.ydoc.getArray<ID>('pageOrder').push([pageId]);
    });
    return pageId;
  }

  removePage(pageId: ID): void {
    const pageOrder = this.ydoc.getArray<ID>('pageOrder');
    if (pageOrder.length <= 1) return;

    this.transact(() => {
      const index = pageOrder.toArray().indexOf(pageId);
      if (index < 0) return;
      pageOrder.delete(index, 1);
      this.ydoc.getMap('pages').delete(pageId);
      this.ydoc.getMap('pageViewports').delete(pageId);
      if (this.currentPageId === pageId) {
        this.currentPageId = pageOrder.get(0) as ID;
      }
    });
  }

  renamePage(pageId: ID, name: string): void {
    this.transact(() => {
      const pageMap = this.ydoc.getMap('pages').get(pageId) as Y.Map<unknown> | undefined;
      pageMap?.set('name', name);
    });
  }

  reorderPages(pageIds: ID[]): void {
    this.transact(() => {
      const pageOrder = this.ydoc.getArray<ID>('pageOrder');
      pageOrder.delete(0, pageOrder.length);
      pageOrder.push(pageIds);
    });
  }

  getPageViewport(pageId: ID): { offset: Vec2; zoom: number } {
    const viewports = this.ydoc.getMap('pageViewports');
    const stored = viewports.get(pageId) as { offset: Vec2; zoom: number } | undefined;
    return stored ?? { offset: { x: 0, y: 0 }, zoom: 1 };
  }

  setPageViewport(pageId: ID, viewport: { offset: Vec2; zoom: number }): void {
    this.transact(() => {
      this.ydoc.getMap('pageViewports').set(pageId, structuredClone(viewport));
    }, PREVIEW_ORIGIN);
  }

  persistPageViewport(pageId: ID, viewport: { offset: Vec2; zoom: number }): void {
    this.transact(() => {
      this.ydoc.getMap('pageViewports').set(pageId, structuredClone(viewport));
    });
  }

  getSortKeyBetween(beforeId: ID | null, afterId: ID | null, parentId: ID | null): string {
    const siblings = this.getChildren(parentId);
    const beforeKey = beforeId ? siblings.find((e) => e.id === beforeId)?.sortKey ?? null : null;
    const afterKey = afterId ? siblings.find((e) => e.id === afterId)?.sortKey ?? null : null;
    if (beforeKey && afterKey) return generateKeyBetween(beforeKey, afterKey);
    if (beforeKey) return generateKeyBetween(beforeKey, null);
    if (afterKey) return generateKeyBetween(null, afterKey);
    return generateKeyBetween(null, null);
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
    if (this.readOnly && origin === LOCAL_ORIGIN) return;
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

  getComponents(): Record<ID, ComponentDef> {
    return componentsFromYDoc(this.ydoc.getMap('components'));
  }

  getComponent(id: ID): ComponentDef | undefined {
    return this.getComponents()[id];
  }

  setComponent(def: ComponentDef, origin: string = LOCAL_ORIGIN): void {
    this.transact(() => {
      const components = this.ydoc.getMap('components');
      const existing = components.get(def.id);
      if (existing instanceof Y.Map) {
        applyComponentToYMap(existing, def);
      } else {
        components.set(def.id, componentToYMap(def));
      }
    }, origin);
  }

  removeComponent(id: ID, origin: string = LOCAL_ORIGIN): void {
    this.transact(() => {
      this.ydoc.getMap('components').delete(id);
    }, origin);
  }

  replaceFromRoughDocument(doc: RoughDocument): void {
    const migrated = migrateDocument(doc);
    this.transact(() => {
      const meta = this.ydoc.getMap('meta');
      meta.set('name', migrated.name);
      meta.set('schemaVersion', migrated.schemaVersion);
      meta.set('id', migrated.id);

      const pages = this.ydoc.getMap('pages');
      pages.forEach((_, key) => pages.delete(key));

      for (const pageId of migrated.pageOrder) {
        const page = migrated.pages[pageId];
        if (!page) continue;
        const pageMap = new Y.Map<unknown>();
        pageMap.set('id', pageId);
        pageMap.set('name', page.name);
        pageMap.set('background', structuredClone(page.background));
        const elementsMap = new Y.Map<Y.Map<unknown>>();
        for (const el of Object.values(page.elements)) {
          elementsMap.set(el.id, elementToYMap(el));
        }
        pageMap.set('elements', elementsMap);
        pages.set(pageId, pageMap);
      }

      const pageOrder = this.ydoc.getArray<ID>('pageOrder');
      pageOrder.delete(0, pageOrder.length);
      pageOrder.push(migrated.pageOrder);

      const components = this.ydoc.getMap('components');
      components.forEach((_, key) => components.delete(key));
      for (const def of Object.values(migrated.components)) {
        components.set(def.id, componentToYMap(def));
      }

      const assets = this.ydoc.getMap('assets');
      assets.forEach((_, key) => assets.delete(key));
      for (const [assetId, ref] of Object.entries(migrated.assets)) {
        assets.set(assetId, structuredClone(ref));
      }

      this.currentPageId = migrated.pageOrder[0] ?? this.currentPageId;
    });
  }

  connectCollab(options: CollabOptions): void {
    this.collab.connect(this.ydoc, options);
  }

  disconnectCollab(): void {
    this.collab.disconnect();
  }

  getCollabAwareness(): import('@hocuspocus/provider').HocuspocusProvider['awareness'] | null {
    return this.collab.getAwareness();
  }

  isCollabConnected(): boolean {
    return this.collab.isConnected();
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  isReadOnly(): boolean {
    return this.readOnly;
  }

  destroy(): void {
    this.collab.disconnect();
    this.persistence?.destroy();
    this.persistence = null;
  }
}

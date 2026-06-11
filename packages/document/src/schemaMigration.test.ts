import * as Y from 'yjs';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '@rough/schema';
import { DocumentStore } from './DocumentStore.js';

vi.mock('./metaStore.js', () => ({
  touchDocumentMeta: vi.fn().mockResolvedValue(undefined),
}));

describe('DocumentStore.applySchemaMigrations', () => {
  it('bumps legacy schemaVersion on load', async () => {
    const ydoc = new Y.Doc();
    const meta = ydoc.getMap('meta');
    meta.set('name', 'legacy');
    meta.set('schemaVersion', 0);
    meta.set('id', 'doc-legacy');

    const pageId = 'page1';
    const pageMap = new Y.Map<unknown>();
    pageMap.set('id', pageId);
    pageMap.set('name', '页面 1');
    pageMap.set('background', { r: 248, g: 248, b: 244, a: 1 });
    pageMap.set('elements', new Y.Map());
    ydoc.getMap('pages').set(pageId, pageMap);
    ydoc.getArray('pageOrder').push([pageId]);

    const store = DocumentStore.fromYDoc(ydoc);
    store.applySchemaMigrations();

    expect(store.getDocument().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(ydoc.getMap('meta').get('schemaVersion')).toBe(CURRENT_SCHEMA_VERSION);
  });
});

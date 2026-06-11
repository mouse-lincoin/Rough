import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, migrateDocument } from './version.js';
import type { RoughDocument } from './document.js';

function createMinimalDoc(schemaVersion: number): RoughDocument {
  const pageId = 'page1';
  return {
    schemaVersion,
    id: 'doc1',
    name: 'Test',
    pages: {
      [pageId]: {
        id: pageId,
        name: 'Page 1',
        elements: {},
        background: { r: 248, g: 248, b: 244, a: 1 },
      },
    },
    pageOrder: [pageId],
    components: {},
    assets: {},
  };
}

describe('migrateDocument', () => {
  it('returns doc unchanged when already at current version', () => {
    const doc = createMinimalDoc(CURRENT_SCHEMA_VERSION);
    const result = migrateDocument(doc);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.id).toBe('doc1');
  });
});

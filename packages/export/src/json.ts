import type { RoughDocument } from '@rough/schema';
import { CURRENT_SCHEMA_VERSION, migrateDocument } from '@rough/schema';

export function exportToJson(doc: RoughDocument, pretty = true): string {
  const payload: RoughDocument = {
    ...doc,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

export function parseRoughDocument(json: string): RoughDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }
  return importFromJson(parsed);
}

export function importFromJson(data: unknown): RoughDocument {
  if (!isRoughDocumentShape(data)) {
    throw new Error('Invalid Rough document schema');
  }
  return migrateDocument(data);
}

function isRoughDocumentShape(data: unknown): data is RoughDocument {
  if (!data || typeof data !== 'object') return false;
  const doc = data as RoughDocument;
  return (
    typeof doc.schemaVersion === 'number' &&
    typeof doc.id === 'string' &&
    typeof doc.name === 'string' &&
    !!doc.pages &&
    Array.isArray(doc.pageOrder)
  );
}

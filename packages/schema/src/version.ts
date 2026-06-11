import type { RoughDocument } from './document.js';

export const CURRENT_SCHEMA_VERSION = 1;

export type MigrationFn = (doc: RoughDocument) => RoughDocument;

const migrations: Record<number, MigrationFn> = {};

export function migrateDocument(doc: RoughDocument): RoughDocument {
  let current = { ...doc };
  while (current.schemaVersion < CURRENT_SCHEMA_VERSION) {
    const nextVersion = current.schemaVersion + 1;
    const migrate = migrations[nextVersion];
    if (!migrate) {
      throw new Error(`Missing migration for schema version ${nextVersion}`);
    }
    current = migrate(current);
    current.schemaVersion = nextVersion;
  }
  return current;
}

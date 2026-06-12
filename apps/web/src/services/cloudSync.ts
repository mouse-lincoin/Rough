import {
  encodeLocalDocumentSnapshot,
  listUnsyncedDocuments,
  markDocumentSynced,
  type DocumentMeta,
  isCloudSynced,
} from '@rough/document';
import { createCloudDocument, deleteCloudDocument } from '../api/client';

export interface DocumentMigration {
  fromId: string;
  toId: string;
}

export interface MigrationFailure {
  id: string;
  name: string;
  error: string;
}

export interface MigrationResult {
  migrations: DocumentMigration[];
  failures: MigrationFailure[];
}

function snapshotToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function getCloudDocumentId(meta: DocumentMeta): string | null {
  return isCloudSynced(meta) ? meta.id : null;
}

export async function createSyncedDocument(name: string): Promise<DocumentMeta> {
  const { createDocumentMeta } = await import('@rough/document');
  const cloud = await createCloudDocument(name);
  return createDocumentMeta(name, cloud.id, { syncedAt: Date.now() });
}

export async function migrateUnsyncedDocuments(): Promise<MigrationResult> {
  const pending = await listUnsyncedDocuments();
  const migrations: DocumentMigration[] = [];
  const failures: MigrationFailure[] = [];

  for (const meta of pending) {
    try {
      const snapshot = await encodeLocalDocumentSnapshot(meta.id);
      const cloud = await createCloudDocument(meta.name, snapshotToBase64(snapshot));
      try {
        await markDocumentSynced(meta.id, cloud.id);
        migrations.push({ fromId: meta.id, toId: cloud.id });
      } catch (rekeyError) {
        await deleteCloudDocument(cloud.id).catch(() => undefined);
        throw rekeyError;
      }
    } catch (err) {
      failures.push({
        id: meta.id,
        name: meta.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { migrations, failures };
}

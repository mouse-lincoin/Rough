import {
  encodeLocalDocumentSnapshot,
  listUnsyncedDocuments,
  markDocumentSynced,
  type DocumentMeta,
  isCloudSynced,
} from '@rough/document';
import { createCloudDocument } from '../api/client';

export interface DocumentMigration {
  fromId: string;
  toId: string;
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

export async function migrateUnsyncedDocuments(): Promise<DocumentMigration[]> {
  const pending = await listUnsyncedDocuments();
  const migrations: DocumentMigration[] = [];

  for (const meta of pending) {
    const snapshot = await encodeLocalDocumentSnapshot(meta.id);
    const cloud = await createCloudDocument(meta.name, snapshotToBase64(snapshot));
    await markDocumentSynced(meta.id, cloud.id);
    migrations.push({ fromId: meta.id, toId: cloud.id });
  }

  return migrations;
}

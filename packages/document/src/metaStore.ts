import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { createId } from '@rough/shared';

export interface DocumentMeta {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
}

interface RoughMetaDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentMeta;
    indexes: { 'by-updated': number };
  };
}

const DB_NAME = 'rough-meta';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RoughMetaDB>> | null = null;

function getDB(): Promise<IDBPDatabase<RoughMetaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RoughMetaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('documents', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const db = await getDB();
  const all = await db.getAll('documents');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDocumentMeta(id: string): Promise<DocumentMeta | undefined> {
  const db = await getDB();
  return db.get('documents', id);
}

export async function createDocumentMeta(name = '未命名', id?: string): Promise<DocumentMeta> {
  const db = await getDB();
  const now = Date.now();
  const meta: DocumentMeta = {
    id: id ?? createId(),
    name,
    updatedAt: now,
    createdAt: now,
  };
  await db.put('documents', meta);
  return meta;
}

export async function updateDocumentMeta(id: string, patch: Partial<Pick<DocumentMeta, 'name'>>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('documents', id);
  if (!existing) return;
  await db.put('documents', {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  });
}

export async function deleteDocumentMeta(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('documents', id);
  const { deleteDocumentThumbnail } = await import('./thumbnailStore.js');
  await deleteDocumentThumbnail(id);
}

export async function touchDocumentMeta(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('documents', id);
  if (!existing) return;
  await db.put('documents', { ...existing, updatedAt: Date.now() });
}

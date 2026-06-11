import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface ThumbnailRecord {
  id: string;
  dataUrl: string;
  updatedAt: number;
}

interface RoughThumbDB extends DBSchema {
  thumbnails: {
    key: string;
    value: ThumbnailRecord;
  };
}

const DB_NAME = 'rough-thumbnails';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RoughThumbDB>> | null = null;

function getDB(): Promise<IDBPDatabase<RoughThumbDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RoughThumbDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('thumbnails', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

export async function saveDocumentThumbnail(id: string, dataUrl: string): Promise<void> {
  const db = await getDB();
  await db.put('thumbnails', { id, dataUrl, updatedAt: Date.now() });
}

export async function getDocumentThumbnail(id: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.get('thumbnails', id);
  return row?.dataUrl ?? null;
}

export async function deleteDocumentThumbnail(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('thumbnails', id);
}

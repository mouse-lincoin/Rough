import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { createId } from '@rough/shared';
import type { AssetRef, ID } from '@rough/schema';

interface AssetBlob {
  id: ID;
  documentId: ID;
  blob: Blob;
  ref: AssetRef;
}

interface RoughAssetsDB extends DBSchema {
  assets: {
    key: string;
    value: AssetBlob;
    indexes: { 'by-document': string };
  };
}

const DB_NAME = 'rough-assets';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RoughAssetsDB>> | null = null;

function getDB(): Promise<IDBPDatabase<RoughAssetsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RoughAssetsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('assets', { keyPath: 'id' });
        store.createIndex('by-document', 'documentId');
      },
    });
  }
  return dbPromise;
}

async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function storeAssetBlob(
  documentId: ID,
  blob: Blob,
  mime: string,
  width: number,
  height: number,
): Promise<AssetRef> {
  const db = await getDB();
  const sha256 = await sha256Hex(blob);
  const id = createId();
  const ref: AssetRef = { id, mime, width, height, sha256 };
  await db.put('assets', { id, documentId, blob, ref });
  return ref;
}

export async function getAssetBlob(assetId: ID): Promise<Blob | undefined> {
  const db = await getDB();
  const record = await db.get('assets', assetId);
  return record?.blob;
}

export async function deleteDocumentAssets(documentId: ID): Promise<void> {
  const db = await getDB();
  const records = await db.getAllFromIndex('assets', 'by-document', documentId);
  const tx = db.transaction('assets', 'readwrite');
  await Promise.all([...records.map((r) => tx.store.delete(r.id)), tx.done]);
}

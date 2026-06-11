import { deleteDB } from 'idb';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
  deleteDocumentThumbnail,
  getDocumentThumbnail,
  saveDocumentThumbnail,
} from './thumbnailStore.js';
import {
  getDocumentMeta,
  replaceDocumentMetaId,
  updateDocumentMetaFields,
  type DocumentMeta,
} from './metaStore.js';

function persistenceDbName(documentId: string): string {
  return `rough-doc-${documentId}`;
}

export async function encodeLocalDocumentSnapshot(documentId: string): Promise<Uint8Array> {
  const ydoc = new Y.Doc();
  const persistence = new IndexeddbPersistence(persistenceDbName(documentId), ydoc);
  await persistence.whenSynced;
  const update = Y.encodeStateAsUpdate(ydoc);
  persistence.destroy();
  ydoc.destroy();
  return update;
}

export async function rekeyLocalDocument(fromId: string, toId: string): Promise<void> {
  const ydocFrom = new Y.Doc();
  const persistenceFrom = new IndexeddbPersistence(persistenceDbName(fromId), ydocFrom);
  await persistenceFrom.whenSynced;
  const update = Y.encodeStateAsUpdate(ydocFrom);
  persistenceFrom.destroy();
  ydocFrom.destroy();

  const ydocTo = new Y.Doc();
  Y.applyUpdate(ydocTo, update);
  ydocTo.getMap('meta').set('id', toId);

  const persistenceTo = new IndexeddbPersistence(persistenceDbName(toId), ydocTo);
  await persistenceTo.whenSynced;
  persistenceTo.destroy();
  ydocTo.destroy();

  await deleteDB(persistenceDbName(fromId));

  const thumbnail = await getDocumentThumbnail(fromId);
  if (thumbnail) {
    await saveDocumentThumbnail(toId, thumbnail);
    await deleteDocumentThumbnail(fromId);
  }
}

export async function markDocumentSynced(
  localId: string,
  cloudId: string,
): Promise<DocumentMeta> {
  if (localId === cloudId) {
    const existing = await getDocumentMeta(localId);
    if (!existing) throw new Error(`Document meta not found: ${localId}`);
    await updateDocumentMetaFields(localId, { syncedAt: Date.now() });
    return (await getDocumentMeta(localId))!;
  }

  await rekeyLocalDocument(localId, cloudId);
  return replaceDocumentMetaId(localId, cloudId, { syncedAt: Date.now() });
}

export function isCloudSynced(meta: DocumentMeta): boolean {
  return typeof meta.syncedAt === 'number';
}

import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import type { ServerConfig } from '../config.js';
import type { Database } from '../db/index.js';
import type { ObjectStorage } from '../storage/s3.js';
import { verifyToken } from '../auth/jwt.js';
import { resolveDocumentAccess, canWrite } from '../services/access.js';

const snapshotTimers = new Map<string, ReturnType<typeof setTimeout>>();
const snapshotVersions = new Map<string, number>();
const HISTORY_INTERVAL = 50;

export function createCollabServer(
  config: ServerConfig,
  db: Database,
  storage: ObjectStorage,
): ReturnType<typeof Server.configure> {
  return Server.configure({
    port: config.collabPort,
    async onAuthenticate({ token, documentName }) {
      const shareToken = token?.startsWith('share:') ? token.slice(6) : null;
      const jwtToken = shareToken ? null : token;
      const user = jwtToken ? verifyToken(jwtToken, config) : null;

      const access = await resolveDocumentAccess(db, documentName, user, shareToken);
      if (!access) {
        throw new Error('Unauthorized');
      }

      return {
        user: user ?? { id: 'share', name: 'Guest', avatarUrl: null },
        readOnly: !canWrite(access.mode),
      };
    },
    async onLoadDocument({ documentName }) {
      const key = `snapshots/${documentName}/latest.bin`;
      const bytes = await storage.get(key);
      if (!bytes) return new Y.Doc();
      const doc = new Y.Doc();
      Y.applyUpdate(doc, bytes);
      return doc;
    },
    async onStoreDocument({ document, documentName }) {
      const key = `snapshots/${documentName}/latest.bin`;
      const existing = snapshotTimers.get(documentName);
      if (existing) clearTimeout(existing);

      snapshotTimers.set(
        documentName,
        setTimeout(() => {
          void (async () => {
            const update = Y.encodeStateAsUpdate(document);
            await storage.put(key, Buffer.from(update), 'application/octet-stream');

            const version = (snapshotVersions.get(documentName) ?? 0) + 1;
            snapshotVersions.set(documentName, version);
            if (version % HISTORY_INTERVAL === 0) {
              const historyKey = `snapshots/${documentName}/v${version}.bin`;
              await storage.put(historyKey, Buffer.from(update), 'application/octet-stream');
            }

            snapshotTimers.delete(documentName);
          })();
        }, 2000),
      );
    },
  });
}

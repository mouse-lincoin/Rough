import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { loadConfig } from './config.js';
import { createDb, ensureSchema } from './db/index.js';
import { ObjectStorage } from './storage/s3.js';
import { createAuthHook } from './auth/middleware.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerDocumentRoutes } from './routes/documents.js';
import { registerShareRoutes } from './routes/share.js';
import { registerCommentRoutes } from './routes/comments.js';
import { registerAssetRoutes } from './routes/assets.js';
import { createCollabServer } from './collab/hocuspocus.js';

export const SERVER_READY = true;

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, sql } = createDb(config);
  await ensureSchema(sql);

  const storage = new ObjectStorage(config);
  await storage.init();

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.webOrigin, credentials: true });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  app.addHook('onRequest', createAuthHook(config));

  await registerAuthRoutes(app, config, db);
  await registerDocumentRoutes(app, db, storage);
  await registerShareRoutes(app, db);
  await registerCommentRoutes(app, db);
  await registerAssetRoutes(app, db, storage);

  app.get('/health', async () => ({ ok: true }));

  const collab = createCollabServer(config, db, storage);
  await collab.listen();

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.info(`REST API on :${config.port}, collab on :${config.collabPort}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

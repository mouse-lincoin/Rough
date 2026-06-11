import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createId } from '@rough/shared';
import type { Database } from '../db/index.js';
import { assets } from '../db/schema.js';
import { requireUser } from '../auth/middleware.js';
import type { ObjectStorage } from '../storage/s3.js';
import { resolveDocumentAccess, canWrite } from '../services/access.js';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export async function registerAssetRoutes(
  app: FastifyInstance,
  db: Database,
  storage: ObjectStorage,
): Promise<void> {
  app.post<{ Params: { id: string } }>('/api/v1/documents/:id/assets', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const access = await resolveDocumentAccess(db, request.params.id, user);
    if (!access || !canWrite(access.mode)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'No write access' } });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: { code: 'INVALID', message: 'File required' } });
    }

    const buffer = await file.toBuffer();
    if (buffer.length > MAX_BYTES) {
      return reply.status(400).send({ error: { code: 'TOO_LARGE', message: 'Max 5MB' } });
    }

    const mime = file.mimetype;
    if (!ALLOWED.has(mime)) {
      return reply.status(400).send({ error: { code: 'INVALID_TYPE', message: 'Unsupported mime' } });
    }

    const assetId = createId();
    const key = `assets/${request.params.id}/${assetId}`;
    await storage.put(key, buffer, mime);

    const inserted = await db
      .insert(assets)
      .values({
        id: assetId,
        documentId: request.params.id,
        sha256: '',
        mime,
        width: 0,
        height: 0,
        s3Key: key,
      })
      .returning();

    const url = await storage.signedUrl(key);
    return { assetId: inserted[0]!.id, url };
  });

  app.get<{ Params: { id: string } }>('/api/v1/assets/:id', async (request, reply) => {
    const [row] = await db.select().from(assets).where(eq(assets.id, request.params.id)).limit(1);
    if (!row) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Asset not found' } });
    }

    const url = await storage.signedUrl(row.s3Key);
    return reply.redirect(url);
  });
}

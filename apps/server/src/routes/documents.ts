import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { documents } from '../db/schema.js';
import { requireUser } from '../auth/middleware.js';
import type { ObjectStorage } from '../storage/s3.js';
import { resolveDocumentAccess, canWrite } from '../services/access.js';

export async function registerDocumentRoutes(
  app: FastifyInstance,
  db: Database,
  storage: ObjectStorage,
): Promise<void> {
  app.post<{ Body: { name?: string; snapshot?: string } }>('/api/v1/documents', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const name = request.body.name?.trim() || '未命名';
    const inserted = await db.insert(documents).values({ ownerId: user.id, name }).returning();
    const doc = inserted[0]!;

    if (request.body.snapshot) {
      const bytes = Buffer.from(request.body.snapshot, 'base64');
      const key = `snapshots/${doc.id}/latest.bin`;
      await storage.put(key, bytes, 'application/octet-stream');
      await db.update(documents).set({ snapshotKey: key }).where(eq(documents.id, doc.id));
    }

    return { document: serializeDocument(doc) };
  });

  app.get('/api/v1/documents', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const rows = await db
      .select()
      .from(documents)
      .where(and(eq(documents.ownerId, user.id), isNull(documents.deletedAt)))
      .orderBy(desc(documents.updatedAt));

    return { documents: rows.map(serializeDocument) };
  });

  app.get<{ Params: { id: string } }>('/api/v1/documents/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const access = await resolveDocumentAccess(db, request.params.id, user);
    if (!access) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const [doc] = await db.select().from(documents).where(eq(documents.id, request.params.id)).limit(1);
    return { document: serializeDocument(doc!) };
  });

  app.patch<{ Params: { id: string }; Body: { name?: string } }>(
    '/api/v1/documents/:id',
    async (request, reply) => {
      const user = requireUser(request, reply);
      if (!user) return;

      const access = await resolveDocumentAccess(db, request.params.id, user);
      if (!access || !canWrite(access.mode)) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'No write access' } });
      }

      const name = request.body.name?.trim();
      if (!name) {
        return reply.status(400).send({ error: { code: 'INVALID', message: 'Name required' } });
      }

      const updated = await db
        .update(documents)
        .set({ name, updatedAt: new Date() })
        .where(eq(documents.id, request.params.id))
        .returning();

      return { document: serializeDocument(updated[0]!) };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/documents/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const access = await resolveDocumentAccess(db, request.params.id, user);
    if (!access || access.mode !== 'owner') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Owner only' } });
    }

    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, request.params.id));

    return { ok: true };
  });

  app.post<{ Params: { id: string } }>('/api/v1/documents/:id/thumbnail', async (request, reply) => {
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
    const key = `thumbnails/${request.params.id}.png`;
    await storage.put(key, buffer, 'image/png');
    await db
      .update(documents)
      .set({ thumbnailKey: key, updatedAt: new Date() })
      .where(eq(documents.id, request.params.id));

    return { ok: true, thumbnailKey: key };
  });

  app.get<{ Params: { id: string } }>('/api/v1/documents/:id/snapshot', async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    const access = await resolveDocumentAccess(db, request.params.id, request.user, token);
    if (!access) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const bytes = await storage.get(`snapshots/${request.params.id}/latest.bin`);
    if (!bytes) {
      return reply.status(404).send({ error: { code: 'NO_SNAPSHOT', message: 'No snapshot yet' } });
    }

    reply.header('Content-Type', 'application/octet-stream');
    return Buffer.from(bytes);
  });
}

function serializeDocument(doc: typeof documents.$inferSelect): Record<string, unknown> {
  return {
    id: doc.id,
    name: doc.name,
    schemaVersion: doc.schemaVersion,
    thumbnailKey: doc.thumbnailKey,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

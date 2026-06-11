import type { FastifyInstance } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { comments } from '../db/schema.js';
import { requireUser } from '../auth/middleware.js';
import { resolveDocumentAccess, canWrite } from '../services/access.js';

export async function registerCommentRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get<{ Params: { id: string } }>('/api/v1/documents/:id/comments', async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    const access = await resolveDocumentAccess(db, request.params.id, request.user, token);
    if (!access) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.documentId, request.params.id))
      .orderBy(asc(comments.createdAt));

    return { comments: rows.map(serializeComment) };
  });

  app.post<{
    Params: { id: string };
    Body: {
      pageId: string;
      elementId?: string | null;
      worldX: number;
      worldY: number;
      body: string;
      parentId?: string | null;
    };
  }>('/api/v1/documents/:id/comments', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const access = await resolveDocumentAccess(db, request.params.id, user);
    if (!access || !canWrite(access.mode)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot comment' } });
    }

    const inserted = await db
      .insert(comments)
      .values({
        documentId: request.params.id,
        pageId: request.body.pageId,
        elementId: request.body.elementId ?? null,
        worldX: request.body.worldX,
        worldY: request.body.worldY,
        body: request.body.body.trim(),
        authorId: user.id,
        authorName: user.name,
        parentId: request.body.parentId ?? null,
      })
      .returning();

    return { comment: serializeComment(inserted[0]!) };
  });

  app.patch<{ Params: { id: string }; Body: { body?: string; resolved?: boolean } }>(
    '/api/v1/comments/:id',
    async (request, reply) => {
      const user = requireUser(request, reply);
      if (!user) return;

      const [existing] = await db.select().from(comments).where(eq(comments.id, request.params.id)).limit(1);
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Comment not found' } });
      }

      const access = await resolveDocumentAccess(db, existing.documentId, user);
      if (!access || !canWrite(access.mode)) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot edit comment' } });
      }

      const patch: Partial<typeof comments.$inferInsert> = {};
      if (request.body.body !== undefined) patch.body = request.body.body.trim();
      if (request.body.resolved !== undefined) {
        patch.resolvedAt = request.body.resolved ? new Date() : null;
      }

      const updated = await db
        .update(comments)
        .set(patch)
        .where(eq(comments.id, request.params.id))
        .returning();

      return { comment: serializeComment(updated[0]!) };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/v1/comments/:id', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const [existing] = await db.select().from(comments).where(eq(comments.id, request.params.id)).limit(1);
    if (!existing) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Comment not found' } });
    }

    const access = await resolveDocumentAccess(db, existing.documentId, user);
    if (!access || !canWrite(access.mode)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot delete comment' } });
    }

    await db.delete(comments).where(eq(comments.id, request.params.id));
    return { ok: true };
  });
}

function serializeComment(row: typeof comments.$inferSelect): Record<string, unknown> {
  return {
    id: row.id,
    documentId: row.documentId,
    pageId: row.pageId,
    elementId: row.elementId,
    worldX: row.worldX,
    worldY: row.worldY,
    authorId: row.authorId,
    authorName: row.authorName,
    body: row.body,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
  };
}

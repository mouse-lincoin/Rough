import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.js';
import { requireUser } from '../auth/middleware.js';
import { createShareLink, getShareLink, revokeShareLink } from '../services/share.js';
import { resolveDocumentAccess } from '../services/access.js';

export async function registerShareRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.post<{ Params: { id: string }; Body: { mode: 'view' | 'edit' } }>(
    '/api/v1/documents/:id/share',
    async (request, reply) => {
      const user = requireUser(request, reply);
      if (!user) return;

      const access = await resolveDocumentAccess(db, request.params.id, user);
      if (!access || access.mode !== 'owner') {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Owner only' } });
      }

      const mode = request.body.mode === 'edit' ? 'edit' : 'view';
      const token = await createShareLink(db, request.params.id, mode);
      return { token, mode };
    },
  );

  app.delete<{ Params: { token: string } }>('/api/v1/share/:token', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const link = await getShareLink(db, request.params.token);
    if (!link) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Share link not found' } });
    }

    const access = await resolveDocumentAccess(db, link.documentId, user);
    if (!access || access.mode !== 'owner') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Owner only' } });
    }

    await revokeShareLink(db, request.params.token);
    return { ok: true };
  });

  app.get<{ Params: { token: string } }>('/api/v1/share/:token', async (request, reply) => {
    const link = await getShareLink(db, request.params.token);
    if (!link) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Share link not found' } });
    }
    return { documentId: link.documentId, mode: link.mode };
  });
}

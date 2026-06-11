import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { ServerConfig } from '../config.js';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { exchangeGithubCode, getGithubAuthUrl } from '../auth/github.js';
import { requireUser } from '../auth/middleware.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../auth/jwt.js';

export async function registerAuthRoutes(
  app: FastifyInstance,
  config: ServerConfig,
  db: Database,
): Promise<void> {
  app.get('/api/v1/auth/github/url', async (_request, reply) => {
    const url = getGithubAuthUrl(config, 'rough');
    if (!url) {
      return reply.status(503).send({ error: { code: 'OAUTH_UNAVAILABLE', message: 'GitHub OAuth not configured' } });
    }
    return { url };
  });

  app.post<{ Body: { code: string } }>('/api/v1/auth/github/callback', async (request, reply) => {
    const profile = await exchangeGithubCode(request.body.code, config);
    if (!profile) {
      return reply.status(400).send({ error: { code: 'OAUTH_FAILED', message: 'GitHub auth failed' } });
    }

    const existing = await db.select().from(users).where(eq(users.githubId, profile.id)).limit(1);
    let user = existing[0];
    if (!user) {
      const inserted = await db
        .insert(users)
        .values({ githubId: profile.id, name: profile.name, avatarUrl: profile.avatarUrl })
        .returning();
      user = inserted[0]!;
    } else {
      await db
        .update(users)
        .set({ name: profile.name, avatarUrl: profile.avatarUrl })
        .where(eq(users.id, user.id));
    }

    const token = signToken({ id: user.id, name: user.name, avatarUrl: user.avatarUrl }, config);
    setAuthCookie(reply, token);
    return { user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl } };
  });

  if (config.devAuth) {
    app.post<{ Body: { name?: string } }>('/api/v1/auth/dev', async (request, reply) => {
      const name = request.body.name?.trim() || 'Dev User';
      const inserted = await db.insert(users).values({ name, githubId: null }).returning();
      const user = inserted[0]!;
      const token = signToken({ id: user.id, name: user.name, avatarUrl: user.avatarUrl }, config);
      setAuthCookie(reply, token);
      return { user: { id: user.id, name: user.name, avatarUrl: user.avatarUrl } };
    });
  }

  app.get('/api/v1/me', async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    return { user };
  });

  app.post('/api/v1/auth/logout', async (_request, reply) => {
    clearAuthCookie(reply);
    return { ok: true };
  });
}

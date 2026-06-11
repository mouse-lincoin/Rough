import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ServerConfig } from '../config.js';
import { getCookieName, verifyToken, type AuthUser } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export function createAuthHook(config: ServerConfig) {
  return async function authHook(request: FastifyRequest): Promise<void> {
    const cookieToken = request.cookies[getCookieName()];
    const header = request.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const queryToken = (request.query as { token?: string }).token;
    const token = cookieToken ?? bearer ?? queryToken ?? null;
    request.user = token ? verifyToken(token, config) : null;
  };
}

export function requireUser(request: FastifyRequest, reply: FastifyReply): AuthUser | null {
  if (!request.user) {
    reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login required' } });
    return null;
  }
  return request.user;
}

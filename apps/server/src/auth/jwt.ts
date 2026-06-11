import jwt from 'jsonwebtoken';
import type { ServerConfig } from '../config.js';

export interface AuthUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface JwtPayload {
  sub: string;
  name: string;
  avatarUrl: string | null;
}

const COOKIE_NAME = 'rough_token';

export function signToken(user: AuthUser, config: ServerConfig): string {
  const payload: JwtPayload = {
    sub: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

export function verifyToken(token: string, config: ServerConfig): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return { id: payload.sub, name: payload.name, avatarUrl: payload.avatarUrl };
  } catch {
    return null;
  }
}

export function getCookieName(): string {
  return COOKIE_NAME;
}

export function setAuthCookie(reply: import('fastify').FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthCookie(reply: import('fastify').FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

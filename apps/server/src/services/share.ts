import { createId } from '@rough/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { shareLinks } from '../db/schema.js';

export async function createShareLink(
  db: Database,
  documentId: string,
  mode: 'view' | 'edit',
): Promise<string> {
  const token = createId().slice(0, 16);
  await db.insert(shareLinks).values({ token, documentId, mode });
  return token;
}

export async function revokeShareLink(db: Database, token: string): Promise<boolean> {
  const updated = await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)))
    .returning();
  return updated.length > 0;
}

export async function getShareLink(db: Database, token: string): Promise<typeof shareLinks.$inferSelect | null> {
  const [link] = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)))
    .limit(1);
  return link ?? null;
}

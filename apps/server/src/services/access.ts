import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { documents, shareLinks } from '../db/schema.js';
import type { AuthUser } from '../auth/jwt.js';

export type AccessMode = 'owner' | 'edit' | 'view' | 'none';

export interface DocumentAccess {
  mode: AccessMode;
  documentId: string;
  ownerId: string;
}

export async function resolveDocumentAccess(
  db: Database,
  documentId: string,
  user: AuthUser | null,
  shareToken?: string | null,
): Promise<DocumentAccess | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .limit(1);

  if (!doc) return null;

  if (user && doc.ownerId === user.id) {
    return { mode: 'owner', documentId: doc.id, ownerId: doc.ownerId };
  }

  if (shareToken) {
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.token, shareToken), isNull(shareLinks.revokedAt)))
      .limit(1);
    if (link && link.documentId === documentId) {
      return {
        mode: link.mode === 'edit' ? 'edit' : 'view',
        documentId: doc.id,
        ownerId: doc.ownerId,
      };
    }
  }

  return null;
}

export function canWrite(access: AccessMode): boolean {
  return access === 'owner' || access === 'edit';
}

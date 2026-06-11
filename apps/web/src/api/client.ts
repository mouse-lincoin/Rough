const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const COLLAB_URL = import.meta.env.VITE_COLLAB_URL ?? 'ws://localhost:3001';

export interface ApiUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ApiComment {
  id: string;
  documentId: string;
  pageId: string;
  elementId: string | null;
  worldX: number;
  worldY: number;
  authorId: string | null;
  authorName: string | null;
  body: string;
  resolvedAt: string | null;
  parentId: string | null;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getCollabUrl(): string {
  return COLLAB_URL;
}

export async function devLogin(name: string): Promise<ApiUser> {
  const data = await request<{ user: ApiUser }>('/api/v1/auth/dev', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.user;
}

export async function getMe(): Promise<ApiUser | null> {
  try {
    const data = await request<{ user: ApiUser }>('/api/v1/me');
    return data.user;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await request('/api/v1/auth/logout', { method: 'POST' });
}

export async function createShareLink(
  documentId: string,
  mode: 'view' | 'edit',
): Promise<{ token: string; mode: string }> {
  return request(`/api/v1/documents/${documentId}/share`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

export async function resolveShareToken(token: string): Promise<{ documentId: string; mode: 'view' | 'edit' }> {
  return request(`/api/v1/share/${token}`);
}

export async function fetchComments(documentId: string, shareToken?: string): Promise<ApiComment[]> {
  const qs = shareToken ? `?token=${encodeURIComponent(shareToken)}` : '';
  const data = await request<{ comments: ApiComment[] }>(`/api/v1/documents/${documentId}/comments${qs}`);
  return data.comments;
}

export async function createComment(
  documentId: string,
  body: {
    pageId: string;
    elementId?: string | null;
    worldX: number;
    worldY: number;
    body: string;
    parentId?: string | null;
  },
): Promise<ApiComment> {
  const data = await request<{ comment: ApiComment }>(`/api/v1/documents/${documentId}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.comment;
}

export async function resolveComment(commentId: string, resolved: boolean): Promise<ApiComment> {
  const data = await request<{ comment: ApiComment }>(`/api/v1/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ resolved }),
  });
  return data.comment;
}

export function collabTokenForShare(shareToken: string): string {
  return `share:${shareToken}`;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Editor } from '@rough/editor';
import {
  createComment,
  fetchComments,
  resolveComment,
  type ApiComment,
} from '../../api/client';
import { useEditorStore } from '../../stores/editorStore';

export interface CommentAnchor {
  pageId: string;
  worldX: number;
  worldY: number;
  elementId: string | null;
}

interface CommentsContextValue {
  documentId: string;
  cloudEnabled: boolean;
  loadError: string | null;
  shareToken?: string;
  readOnly: boolean;
  comments: ApiComment[];
  filter: 'all' | 'open';
  setFilter: (filter: 'all' | 'open') => void;
  reload: () => Promise<void>;
  pendingAnchor: CommentAnchor | null;
  setPendingAnchor: (anchor: CommentAnchor | null) => void;
  activeThreadId: string | null;
  activeThreadScreen: { x: number; y: number } | null;
  openThread: (commentId: string, screen?: { x: number; y: number }) => void;
  closeThread: () => void;
  jumpToComment: (comment: ApiComment) => void;
  submitComment: (body: string, parentId?: string | null) => Promise<void>;
  resolveThread: (commentId: string) => Promise<void>;
  getThread: (rootId: string) => ApiComment[];
}

const CommentsContext = createContext<CommentsContextValue | null>(null);

const POLL_MS = 20_000;

interface CommentsProviderProps {
  documentId: string;
  cloudEnabled?: boolean;
  shareToken?: string;
  readOnly?: boolean;
  editorRef: React.MutableRefObject<Editor | null>;
  children: ReactNode;
}

export function CommentsProvider({
  documentId,
  cloudEnabled = true,
  shareToken,
  readOnly = false,
  editorRef,
  children,
}: CommentsProviderProps): JSX.Element {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open'>('open');
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeThreadScreen, setActiveThreadScreen] = useState<{ x: number; y: number } | null>(
    null,
  );
  const documentVersion = useEditorStore((s) => s.documentVersion);

  const reload = useCallback(async () => {
    if (!documentId || !cloudEnabled) {
      setComments([]);
      setLoadError(null);
      return;
    }
    try {
      setLoadError(null);
      const rows = await fetchComments(documentId, shareToken);
      setComments(rows);
    } catch {
      setLoadError('无法加载评论');
      setComments([]);
    }
  }, [cloudEnabled, documentId, shareToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const timer = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    return editor.onRemoteCommentEvent(() => {
      void reload();
    });
  }, [editorRef, reload, documentVersion]);

  const openThread = useCallback((commentId: string, screen?: { x: number; y: number }) => {
    setActiveThreadId(commentId);
    setActiveThreadScreen(screen ?? null);
    editorRef.current?.setHighlightedCommentId(commentId);
  }, [editorRef]);

  const closeThread = useCallback(() => {
    setActiveThreadId(null);
    setActiveThreadScreen(null);
    editorRef.current?.setHighlightedCommentId(null);
  }, [editorRef]);

  const jumpToComment = useCallback(
    (comment: ApiComment) => {
      const rootId = comment.parentId ?? comment.id;
      const root = comments.find((c) => c.id === rootId) ?? comment;
      editorRef.current?.goToComment({
        pageId: root.pageId,
        elementId: root.elementId,
        worldX: root.worldX,
        worldY: root.worldY,
      });
      openThread(root.id);
    },
    [comments, editorRef, openThread],
  );

  const notifyChange = useCallback(
    (type: 'created' | 'updated') => {
      editorRef.current?.broadcastCommentChange(type);
    },
    [editorRef],
  );

  const submitComment = useCallback(
    async (body: string, parentId?: string | null) => {
      if (!body.trim() || !cloudEnabled) return;

      if (parentId) {
        await createComment(documentId, {
          pageId: comments.find((c) => c.id === parentId)?.pageId ?? comments[0]?.pageId ?? '',
          worldX: 0,
          worldY: 0,
          body: body.trim(),
          parentId,
        });
      } else if (pendingAnchor) {
        await createComment(documentId, { ...pendingAnchor, body: body.trim() });
        setPendingAnchor(null);
      } else {
        return;
      }

      await reload();
      notifyChange('created');
    },
    [cloudEnabled, comments, documentId, notifyChange, pendingAnchor, reload],
  );

  const resolveThread = useCallback(
    async (commentId: string) => {
      await resolveComment(commentId, true);
      await reload();
      notifyChange('updated');
      closeThread();
    },
    [closeThread, notifyChange, reload],
  );

  const getThread = useCallback(
    (rootId: string): ApiComment[] => {
      const root = comments.find((c) => c.id === rootId);
      if (!root) return [];
      const replies = comments
        .filter((c) => c.parentId === rootId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return [root, ...replies];
    },
    [comments],
  );

  const value = useMemo(
    () => ({
      documentId,
      cloudEnabled,
      loadError,
      shareToken,
      readOnly,
      comments,
      filter,
      setFilter,
      reload,
      pendingAnchor,
      setPendingAnchor,
      activeThreadId,
      activeThreadScreen,
      openThread,
      closeThread,
      jumpToComment,
      submitComment,
      resolveThread,
      getThread,
    }),
    [
      cloudEnabled,
      documentId,
      loadError,
      shareToken,
      readOnly,
      comments,
      filter,
      reload,
      pendingAnchor,
      activeThreadId,
      activeThreadScreen,
      openThread,
      closeThread,
      jumpToComment,
      submitComment,
      resolveThread,
      getThread,
    ],
  );

  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

export function useComments(): CommentsContextValue {
  const ctx = useContext(CommentsContext);
  if (!ctx) {
    throw new Error('useComments must be used within CommentsProvider');
  }
  return ctx;
}

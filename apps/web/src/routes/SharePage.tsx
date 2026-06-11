import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Editor } from '@rough/editor';
import { CanvasHost } from '../components/CanvasHost';
import { CommentsPanel, type CommentAnchor } from '../components/CommentsPanel/CommentsPanel';
import { collabTokenForShare, getCollabUrl, resolveShareToken } from '../api/client';

export function SharePage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const editorRef = useRef<Editor | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState('');
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null);

  useEffect(() => {
    if (!token) return;
    void resolveShareToken(token)
      .then((data) => {
        setDocId(data.documentId);
        setMode(data.mode);
      })
      .catch(() => setError('分享链接无效或已撤销'));
  }, [token]);

  useEffect(() => {
    if (!docId || !token || !editorRef.current) return;
    const readOnly = mode === 'view';
    editorRef.current.setReadOnly(readOnly);
    editorRef.current.connectCollab({
      url: getCollabUrl(),
      documentId: docId,
      token: collabTokenForShare(token),
      readOnly,
      user: { id: 'guest', name: '访客' },
    });
    return () => editorRef.current?.disconnectCollab();
  }, [docId, token, mode]);

  if (error) return <div className="doc-list-empty">{error}</div>;
  if (!docId || !token) return <div className="doc-list-empty">加载中…</div>;

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">Rough 分享</span>
        <span className="share-mode-badge">{mode === 'view' ? '只读' : '可编辑'}</span>
      </header>
      <div className="editor-layout">
        <main className="app-main">
          <CanvasHost
            docId={docId}
            docName="分享文档"
            editorRef={editorRef}
            readOnly={mode === 'view'}
            onCommentPlace={mode === 'view' ? undefined : setCommentAnchor}
          />
        </main>
        <aside className="editor-sidebar editor-sidebar-right">
          <CommentsPanel
            documentId={docId}
            shareToken={token}
            readOnly={mode === 'view'}
            pendingAnchor={commentAnchor}
            onClearAnchor={() => setCommentAnchor(null)}
          />
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Editor } from '@rough/editor';
import { CanvasHost } from '../components/CanvasHost';
import { CommentsPanel } from '../components/CommentsPanel/CommentsPanel';
import { CommentsProvider, useComments } from '../components/CommentsPanel/commentsContext';
import { CommentsLayer } from '../components/CommentsPanel/CommentsLayer';
import { CommentThreadPopover } from '../components/CommentsPanel/CommentThreadPopover';
import { collabTokenForShare, getCollabUrl, resolveShareToken } from '../api/client';

function SharePageContent({
  docId,
  mode,
  editorRef,
}: {
  docId: string;
  mode: 'view' | 'edit';
  editorRef: React.MutableRefObject<Editor | null>;
}): JSX.Element {
  const { setPendingAnchor, openThread } = useComments();
  const readOnly = mode === 'view';

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-logo">Rough 分享</span>
        <span className="share-mode-badge">{mode === 'view' ? '只读' : '可编辑'}</span>
      </header>
      <div className="editor-layout">
        <main className="app-main app-main-canvas">
          <CanvasHost
            docId={docId}
            docName="分享文档"
            editorRef={editorRef}
            readOnly={readOnly}
            onCommentPlace={readOnly ? undefined : setPendingAnchor}
            onCommentPinClick={(id, screen) => openThread(id, screen)}
          />
          <CommentsLayer editorRef={editorRef} />
          <CommentThreadPopover editorRef={editorRef} />
        </main>
        <aside className="editor-sidebar editor-sidebar-right">
          <CommentsPanel />
        </aside>
      </div>
    </div>
  );
}

export function SharePage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const editorRef = useRef<Editor | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState('');

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
    <CommentsProvider
      documentId={docId}
      shareToken={token}
      readOnly={mode === 'view'}
      editorRef={editorRef}
    >
      <SharePageContent docId={docId} mode={mode} editorRef={editorRef} />
    </CommentsProvider>
  );
}

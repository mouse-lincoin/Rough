import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@rough/editor';
import { useComments } from './commentsContext';

interface CommentThreadPopoverProps {
  editorRef: React.MutableRefObject<Editor | null>;
}

export function CommentThreadPopover({ editorRef }: CommentThreadPopoverProps): JSX.Element | null {
  const {
    activeThreadId,
    activeThreadScreen,
    closeThread,
    getThread,
    submitComment,
    resolveThread,
    readOnly,
  } = useComments();
  const [draft, setDraft] = useState('');
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const thread = activeThreadId ? getThread(activeThreadId) : [];
  const root = thread[0];

  useEffect(() => {
    if (!activeThreadId || !root) {
      setPosition(null);
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    if (activeThreadScreen) {
      setPosition({ x: activeThreadScreen.x + 16, y: activeThreadScreen.y + 16 });
      return;
    }

    const world = editor.resolveCommentWorld({
      elementId: root.elementId,
      worldX: root.worldX,
      worldY: root.worldY,
    });
    const screen = editor.viewport.worldToScreen(world);
    setPosition({ x: screen.x + 16, y: screen.y + 16 });
  }, [activeThreadId, activeThreadScreen, editorRef, root]);

  useEffect(() => {
    if (!activeThreadId) setDraft('');
  }, [activeThreadId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') closeThread();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeThread]);

  if (!activeThreadId || !root || !position) return null;

  const clamped = {
    x: Math.min(Math.max(position.x, 8), window.innerWidth - 320),
    y: Math.min(Math.max(position.y, 8), window.innerHeight - 280),
  };

  const submitReply = async (): Promise<void> => {
    if (!draft.trim()) return;
    await submitComment(draft, root.id);
    setDraft('');
  };

  return (
    <div
      ref={popoverRef}
      className="comment-thread-popover"
      style={{ left: clamped.x, top: clamped.y }}
      role="dialog"
      aria-label="评论线程"
    >
      <div className="comment-thread-header">
        <span>评论</span>
        <button type="button" className="btn-icon" onClick={closeThread} aria-label="关闭">
          ×
        </button>
      </div>
      <ul className="comment-thread-messages">
        {thread.map((msg) => (
          <li key={msg.id} className={msg.resolvedAt ? 'resolved' : ''}>
            <div className="comment-meta">
              {msg.authorName ?? '匿名'}
              <time>{new Date(msg.createdAt).toLocaleString()}</time>
            </div>
            <p>{msg.body}</p>
          </li>
        ))}
      </ul>
      {!readOnly && !root.resolvedAt && (
        <div className="comment-thread-compose">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="回复…"
            rows={2}
          />
          <div className="comment-thread-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void resolveThread(root.id)}
            >
              标记已解决
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!draft.trim()}
              onClick={() => void submitReply()}
            >
              回复
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

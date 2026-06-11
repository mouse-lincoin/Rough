import { useState } from 'react';
import { useComments } from './commentsContext';

export type { CommentAnchor } from './commentsContext';

export function CommentsPanel(): JSX.Element {
  const {
    comments,
    filter,
    setFilter,
    pendingAnchor,
    setPendingAnchor,
    jumpToComment,
    submitComment,
    resolveThread,
    readOnly,
    cloudEnabled,
    loadError,
    activeThreadId,
    openThread,
  } = useComments();
  const [draft, setDraft] = useState('');

  const visible = comments
    .filter((c) => !c.parentId)
    .filter((c) => filter === 'all' || !c.resolvedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const replyCount = (rootId: string): number =>
    comments.filter((c) => c.parentId === rootId).length;

  const submit = async (): Promise<void> => {
    if (!pendingAnchor || !draft.trim()) return;
    await submitComment(draft);
    setDraft('');
  };

  return (
    <div className="comments-panel">
      <div className="panel-header">
        <span>评论</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'open')}>
          <option value="open">未解决</option>
          <option value="all">全部</option>
        </select>
      </div>
      {!cloudEnabled && (
        <p className="comments-hint">登录并同步文档后可使用评论</p>
      )}
      {loadError && <p className="comments-hint">{loadError}</p>}
      {!readOnly && cloudEnabled && pendingAnchor && (
        <div className="comment-compose">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="写下评论…"
            rows={3}
          />
          <div className="export-dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => setPendingAnchor(null)}>
              取消
            </button>
            <button type="button" className="btn-primary" onClick={() => void submit()}>
              发布
            </button>
          </div>
        </div>
      )}
      <ul className="comments-list">
        {visible.map((c) => (
          <li
            key={c.id}
            className={[
              c.resolvedAt ? 'resolved' : '',
              activeThreadId === c.id ? 'active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <button
              type="button"
              className="comment-list-item"
              onClick={() => {
                jumpToComment(c);
                openThread(c.id);
              }}
            >
              <div className="comment-meta">
                {c.authorName ?? '匿名'}
                {replyCount(c.id) > 0 && (
                  <span className="comment-reply-count">{replyCount(c.id)} 条回复</span>
                )}
              </div>
              <p>{c.body}</p>
            </button>
            {!readOnly && !c.resolvedAt && (
              <button type="button" onClick={() => void resolveThread(c.id)}>
                标记已解决
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

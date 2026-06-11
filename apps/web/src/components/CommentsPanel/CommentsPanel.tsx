import { useCallback, useEffect, useState } from 'react';
import { createComment, fetchComments, resolveComment, type ApiComment } from '../../api/client';

export interface CommentAnchor {
  pageId: string;
  worldX: number;
  worldY: number;
  elementId: string | null;
}

interface CommentsPanelProps {
  documentId: string;
  cloudEnabled?: boolean;
  shareToken?: string;
  readOnly?: boolean;
  pendingAnchor: CommentAnchor | null;
  onClearAnchor: () => void;
}

export function CommentsPanel({
  documentId,
  cloudEnabled = true,
  shareToken,
  readOnly = false,
  pendingAnchor,
  onClearAnchor,
}: CommentsPanelProps): JSX.Element {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [filter, setFilter] = useState<'all' | 'open'>('open');
  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!documentId || !cloudEnabled) {
      setComments([]);
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
  }, [documentId, shareToken, cloudEnabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = comments.filter((c) => filter === 'all' || !c.resolvedAt);

  const submit = async (): Promise<void> => {
    if (!pendingAnchor || !draft.trim() || !cloudEnabled) return;
    await createComment(documentId, { ...pendingAnchor, body: draft.trim() });
    setDraft('');
    onClearAnchor();
    await reload();
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
            <button type="button" className="btn-secondary" onClick={onClearAnchor}>取消</button>
            <button type="button" className="btn-primary" onClick={() => void submit()}>发布</button>
          </div>
        </div>
      )}
      <ul className="comments-list">
        {visible.map((c) => (
          <li key={c.id} className={c.resolvedAt ? 'resolved' : ''}>
            <div className="comment-meta">{c.authorName ?? '匿名'}</div>
            <p>{c.body}</p>
            {!readOnly && !c.resolvedAt && (
              <button type="button" onClick={() => void resolveComment(c.id, true).then(reload)}>
                标记已解决
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

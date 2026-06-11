import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createDocumentMeta,
  deleteDocumentMeta,
  getDocumentThumbnail,
  isCloudSynced,
  listDocuments,
  type DocumentMeta,
} from '@rough/document';
import { deleteCloudDocument } from '../api/client';
import { AuthButton } from '../components/AuthButton/AuthButton';
import { createSyncedDocument } from '../services/cloudSync';
import { useAuthStore } from '../stores/authStore';

interface DocWithThumb extends DocumentMeta {
  thumbnail: string | null;
}

export function DocumentListPage(): JSX.Element {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocWithThumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const lastMigrations = useAuthStore((s) => s.lastMigrations);
  const authInit = useAuthStore((s) => s.init);
  const authInitialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!authInitialized) void authInit();
  }, [authInitialized, authInit]);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDocuments();
      const withThumbs = await Promise.all(
        list.map(async (doc) => ({
          ...doc,
          thumbnail: await getDocumentThumbnail(doc.id),
        })),
      );
      setDocs(withThumbs);
    } catch {
      setError('无法加载文档列表，请刷新重试');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, lastMigrations]);

  const handleCreate = async (): Promise<void> => {
    try {
      const meta = user ? await createSyncedDocument('未命名') : await createDocumentMeta('未命名');
      navigate(`/doc/${meta.id}`);
    } catch {
      setError('创建文档失败');
    }
  };

  const handleDelete = async (doc: DocWithThumb, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!confirm('确定删除此文档？')) return;
    try {
      if (isCloudSynced(doc)) {
        await deleteCloudDocument(doc.id).catch(() => undefined);
      }
      await deleteDocumentMeta(doc.id);
      await refresh();
    } catch {
      setError('删除失败');
    }
  };

  return (
    <div className="doc-list-page">
      <header className="doc-list-header">
        <span className="app-logo">Rough</span>
        <div className="doc-list-header-actions">
          <AuthButton />
          <button type="button" className="btn-primary" data-testid="create-doc" onClick={() => void handleCreate()}>
            新建文档
          </button>
        </div>
      </header>
      <main className="doc-list-main">
        {loading ? (
          <p className="doc-list-empty" role="status">加载中…</p>
        ) : error ? (
          <div className="doc-list-empty doc-list-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn-primary" onClick={() => void refresh()}>
              重试
            </button>
          </div>
        ) : docs.length === 0 ? (
          <div className="doc-list-empty">
            <p>还没有文档</p>
            <p className="doc-list-hint">创建线框图，导出 Markdown 给 AI 写代码</p>
            <button type="button" className="btn-primary" onClick={() => void handleCreate()}>
              创建第一个文档
            </button>
          </div>
        ) : (
          <ul className="doc-list">
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className="doc-list-item"
                  onClick={() => navigate(`/doc/${doc.id}`)}
                >
                  <div className="doc-list-thumb">
                    {doc.thumbnail ? (
                      <img src={doc.thumbnail} alt="" />
                    ) : (
                      <span className="doc-list-thumb-placeholder">预览</span>
                    )}
                  </div>
                  <div className="doc-list-meta">
                    <span className="doc-list-name">
                      {doc.name}
                      {!isCloudSynced(doc) && user && (
                        <span className="doc-sync-badge" title="尚未同步到云端">本地</span>
                      )}
                    </span>
                    <span className="doc-list-date">
                      {new Date(doc.updatedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="doc-list-delete"
                    onClick={(e) => void handleDelete(doc, e)}
                    title="删除"
                  >
                    ×
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createDocumentMeta,
  deleteDocumentMeta,
  listDocuments,
  type DocumentMeta,
} from '@rough/document';

export function DocumentListPage(): JSX.Element {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    const list = await listDocuments();
    setDocs(list);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleCreate = async (): Promise<void> => {
    const meta = await createDocumentMeta('未命名');
    navigate(`/doc/${meta.id}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!confirm('确定删除此文档？')) return;
    await deleteDocumentMeta(id);
    await refresh();
  };

  return (
    <div className="doc-list-page">
      <header className="doc-list-header">
        <span className="app-logo">Rough</span>
        <button type="button" className="btn-primary" onClick={() => void handleCreate()}>
          新建文档
        </button>
      </header>
      <main className="doc-list-main">
        {loading ? (
          <p className="doc-list-empty">加载中…</p>
        ) : docs.length === 0 ? (
          <div className="doc-list-empty">
            <p>还没有文档</p>
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
                  <span className="doc-list-name">{doc.name}</span>
                  <span className="doc-list-date">
                    {new Date(doc.updatedAt).toLocaleString('zh-CN')}
                  </span>
                  <button
                    type="button"
                    className="doc-list-delete"
                    onClick={(e) => void handleDelete(doc.id, e)}
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

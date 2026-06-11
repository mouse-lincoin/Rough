import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getDocumentMeta, createDocumentMeta, updateDocumentMeta } from '@rough/document';
import type { Editor } from '@rough/editor';
import { CanvasHost } from '../components/CanvasHost';
import { Toolbar } from '../components/Toolbar/Toolbar';

export function EditorPage(): JSX.Element {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<Editor | null>(null);
  const [docName, setDocName] = useState('未命名');
  const [metaReady, setMetaReady] = useState(false);

  useEffect(() => {
    if (!docId) {
      navigate('/');
      return;
    }

    const loadMeta = async (): Promise<void> => {
      let meta = await getDocumentMeta(docId);
      if (!meta) {
        meta = await createDocumentMeta('未命名', docId);
      }
      setDocName(meta.name);
      setMetaReady(true);
    };

    void loadMeta();
  }, [docId, navigate]);

  const handleNameBlur = (): void => {
    if (!docId) return;
    void updateDocumentMeta(docId, { name: docName });
    editorRef.current?.document.updateDocumentName(docName);
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    const items = e.clipboardData?.items;
    if (!items || !editorRef.current) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const container = document.querySelector('.canvas-host');
        const rect = container?.getBoundingClientRect();
        if (!rect) continue;
        const world = editorRef.current.viewport.screenToWorld({
          x: rect.width / 2,
          y: rect.height / 2,
        });
        void editorRef.current.importImage(file, world.x - 100, world.y - 100);
      }
    }
  };

  if (!docId || !metaReady) {
    return <div className="doc-list-empty">加载中…</div>;
  }

  return (
    <div className="app" onPaste={handlePaste}>
      <header className="app-header">
        <button type="button" className="btn-back" onClick={() => navigate('/')}>
          ← 文档
        </button>
        <input
          className="doc-name-input"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          onBlur={handleNameBlur}
        />
        <Toolbar editorRef={editorRef} />
      </header>
      <main className="app-main">
        <CanvasHost docId={docId} docName={docName} editorRef={editorRef} />
      </main>
    </div>
  );
}

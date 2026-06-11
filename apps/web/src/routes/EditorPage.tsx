import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getDocumentMeta,
  createDocumentMeta,
  updateDocumentMeta,
  isCloudSynced,
  type DocumentMeta,
} from '@rough/document';
import type { Editor } from '@rough/editor';
import type { ApiUser } from '../api/client';
import { patchCloudDocument } from '../api/client';
import { CanvasHost } from '../components/CanvasHost';
import { Toolbar } from '../components/Toolbar/Toolbar';
import { LayerPanel } from '../components/LayerPanel/LayerPanel';
import { PropertiesPanel } from '../components/PropertiesPanel/PropertiesPanel';
import { PagesPanel } from '../components/PagesPanel/PagesPanel';
import { ComponentsPanel } from '../components/ComponentsPanel/ComponentsPanel';
import { ExportDialog } from '../components/ExportDialog/ExportDialog';
import { ShareDialog } from '../components/ShareDialog/ShareDialog';
import { AuthButton } from '../components/AuthButton/AuthButton';
import { CommentsPanel } from '../components/CommentsPanel/CommentsPanel';
import { CommentsProvider, useComments } from '../components/CommentsPanel/commentsContext';
import { CommentsLayer } from '../components/CommentsPanel/CommentsLayer';
import { CommentThreadPopover } from '../components/CommentsPanel/CommentThreadPopover';
import { ShortcutsHelp } from '../components/ShortcutsHelp/ShortcutsHelp';
import { useEditorCollab } from '../hooks/useEditorCollab';
import { getCloudDocumentId } from '../services/cloudSync';
import { useAuthStore } from '../stores/authStore';
import { useEditorStore } from '../stores/editorStore';

export function EditorPage(): JSX.Element {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<Editor | null>(null);
  const [docMeta, setDocMeta] = useState<DocumentMeta | null>(null);
  const [docName, setDocName] = useState('未命名');
  const [metaReady, setMetaReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const panelsVisible = useEditorStore((s) => s.panelsVisible);
  const user = useAuthStore((s) => s.user);
  const lastMigrations = useAuthStore((s) => s.lastMigrations);
  const authInit = useAuthStore((s) => s.init);
  const authInitialized = useAuthStore((s) => s.initialized);

  const cloudDocumentId = docMeta ? getCloudDocumentId(docMeta) : null;

  useEffect(() => {
    if (!authInitialized) void authInit();
  }, [authInitialized, authInit]);

  useEffect(() => {
    if (!docId) {
      navigate('/');
      return;
    }

    setEditorReady(false);

    const loadMeta = async (): Promise<void> => {
      let meta = await getDocumentMeta(docId);
      if (!meta) {
        meta = await createDocumentMeta('未命名', docId);
      }
      setDocMeta(meta);
      setDocName(meta.name);
      setMetaReady(true);
    };

    void loadMeta();
  }, [docId, navigate]);

  useEffect(() => {
    if (!docId) return;
    const migration = lastMigrations.find((m) => m.fromId === docId);
    if (migration) {
      navigate(`/doc/${migration.toId}`, { replace: true });
    }
  }, [docId, lastMigrations, navigate]);

  const handleEditorReady = useCallback(() => {
    setEditorReady(true);
  }, []);

  useEditorCollab(editorRef, editorReady, cloudDocumentId, user);

  const handleNameBlur = (): void => {
    if (!docId) return;
    void updateDocumentMeta(docId, { name: docName });
    editorRef.current?.document.updateDocumentName(docName);
    if (docMeta && isCloudSynced(docMeta)) {
      void patchCloudDocument(docId, docName).catch(() => undefined);
    }
  };

  const handlePaste = (e: React.ClipboardEvent): void => {
    const items = e.clipboardData?.items;
    if (!items || !editorRef.current) return;

    const jsonText = e.clipboardData?.getData('text/plain');
    if (jsonText?.trimStart().startsWith('{') && jsonText.includes('"schemaVersion"')) {
      try {
        e.preventDefault();
        editorRef.current.importJson(jsonText);
        return;
      } catch {
        // fall through to other paste handlers
      }
    }

    const roughItem = Array.from(items).find((item) =>
      item.type === 'application/x-rough+json',
    );
    if (roughItem) {
      e.preventDefault();
      const container = document.querySelector('.canvas-host');
      const rect = container?.getBoundingClientRect();
      if (!rect) return;
      const world = editorRef.current.viewport.screenToWorld({
        x: rect.width / 2,
        y: rect.height / 2,
      });
      void editorRef.current.pasteAt(world.x, world.y);
      return;
    }

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
    <CommentsProvider
      documentId={cloudDocumentId ?? docId}
      cloudEnabled={cloudDocumentId != null}
      editorRef={editorRef}
    >
      <EditorPageContent
        docId={docId}
        docName={docName}
        editorRef={editorRef}
        panelsVisible={panelsVisible}
        docNameInput={docName}
        cloudDocumentId={cloudDocumentId}
        user={user}
        onDocNameChange={setDocName}
        onDocNameBlur={handleNameBlur}
        onNavigateHome={() => navigate('/')}
        onExportOpen={() => setExportOpen(true)}
        onShareOpen={() => setShareOpen(true)}
        onShortcutsOpen={() => setShortcutsOpen(true)}
        onEditorReady={handleEditorReady}
        onPaste={handlePaste}
      />
      <ExportDialog
        open={exportOpen}
        editorRef={editorRef}
        docName={docName}
        onClose={() => setExportOpen(false)}
      />
      <ShareDialog
        open={shareOpen}
        documentId={cloudDocumentId ?? docId}
        onClose={() => setShareOpen(false)}
      />
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </CommentsProvider>
  );
}

interface EditorPageContentProps {
  docId: string;
  docName: string;
  editorRef: React.MutableRefObject<Editor | null>;
  panelsVisible: boolean;
  docNameInput: string;
  cloudDocumentId: string | null;
  user: ApiUser | null;
  onDocNameChange: (name: string) => void;
  onDocNameBlur: () => void;
  onNavigateHome: () => void;
  onExportOpen: () => void;
  onShareOpen: () => void;
  onShortcutsOpen: () => void;
  onEditorReady: () => void;
  onPaste: (e: React.ClipboardEvent) => void;
}

function EditorPageContent({
  docId,
  docName,
  editorRef,
  panelsVisible,
  docNameInput,
  cloudDocumentId,
  user,
  onDocNameChange,
  onDocNameBlur,
  onNavigateHome,
  onExportOpen,
  onShareOpen,
  onShortcutsOpen,
  onEditorReady,
  onPaste,
}: EditorPageContentProps): JSX.Element {
  const { setPendingAnchor, openThread } = useComments();

  return (
    <div className="app" onPaste={onPaste}>
      <header className="app-header">
        <button type="button" className="btn-back" onClick={onNavigateHome}>
          ← 文档
        </button>
        <input
          className="doc-name-input"
          value={docNameInput}
          onChange={(e) => onDocNameChange(e.target.value)}
          onBlur={onDocNameBlur}
        />
        {cloudDocumentId && user && (
          <span className="auth-status collab-status" title="已连接云端协作">
            协作
          </span>
        )}
        <Toolbar editorRef={editorRef} />
        <button
          type="button"
          className="toolbar-btn"
          onClick={onShareOpen}
          disabled={!cloudDocumentId}
          title={cloudDocumentId ? '分享' : '登录并同步后可分享'}
        >
          分享
        </button>
        <AuthButton />
      </header>
      <div className="editor-layout">
        {panelsVisible && (
          <aside className="editor-sidebar editor-sidebar-left">
            <PagesPanel editorRef={editorRef} />
            <ComponentsPanel editorRef={editorRef} />
            <LayerPanel editorRef={editorRef} />
          </aside>
        )}
        <main className="app-main app-main-canvas">
          <CanvasHost
            docId={docId}
            docName={docName}
            editorRef={editorRef}
            onExportRequest={onExportOpen}
            onCommentPlace={setPendingAnchor}
            onCommentPinClick={(id, screen) => openThread(id, screen)}
            onShortcutsRequest={onShortcutsOpen}
            onEditorReady={onEditorReady}
          />
          <CommentsLayer editorRef={editorRef} />
          <CommentThreadPopover editorRef={editorRef} />
        </main>
        {panelsVisible && (
          <aside className="editor-sidebar editor-sidebar-right">
            <PropertiesPanel editorRef={editorRef} />
            <CommentsPanel />
          </aside>
        )}
      </div>
    </div>
  );
}

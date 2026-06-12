import { useEffect, useRef } from 'react';
import { DocumentStore } from '@rough/document';
import { Editor, type EditorCallbacks } from '@rough/editor';
import { createKitComponent, type KitComponentId } from '@rough/wireframe-kit';
import { useEditorStore } from '../stores/editorStore';

export const ROUGH_KIT_MIME = 'application/x-rough-kit';
import { attachE2EBridge } from '../e2eBridge';

interface CanvasHostProps {
  docId: string;
  docName: string;
  cloudDocumentId?: string | null;
  editorRef: React.MutableRefObject<Editor | null>;
  onExportRequest?: () => void;
  onShortcutsRequest?: () => void;
  onCommentPlace?: (anchor: {
    pageId: string;
    worldX: number;
    worldY: number;
    elementId: string | null;
  }) => void;
  onCommentPinClick?: (commentId: string, screen: { x: number; y: number }) => void;
  onEditorReady?: () => void;
  readOnly?: boolean;
}

export function CanvasHost({
  docId,
  docName,
  cloudDocumentId = null,
  editorRef,
  onExportRequest,
  onShortcutsRequest,
  onCommentPlace,
  onCommentPinClick,
  onEditorReady,
  readOnly = false,
}: CanvasHostProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const bumpDocumentVersion = useEditorStore((s) => s.bumpDocumentVersion);
  const setCurrentPageId = useEditorStore((s) => s.setCurrentPageId);
  const setPanelsVisible = useEditorStore((s) => s.setPanelsVisible);
  const showToast = useEditorStore((s) => s.showToast);
  const setRemotePeers = useEditorStore((s) => s.setRemotePeers);
  const setFollowingClientId = useEditorStore((s) => s.setFollowingClientId);

  const hostCallbacksRef = useRef<EditorCallbacks & { onEditorReady?: () => void }>({});
  hostCallbacksRef.current = {
    onExportRequest,
    onShortcutsRequest,
    onCommentPlace,
    onCommentPinClick,
    onEditorReady,
  };

  useEffect(() => {
    editorRef.current?.setReadOnly(readOnly);
  }, [editorRef, readOnly]);

  useEffect(() => {
    const container = containerRef.current;
    const mainCanvas = mainCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !mainCanvas || !overlayCanvas) return;

    let editor: Editor | null = null;
    let destroyed = false;

    const init = async (): Promise<void> => {
      const document = await DocumentStore.load(docId, docName);
      if (destroyed) {
        document.destroy();
        return;
      }

      editor = new Editor({
        container,
        mainCanvas,
        overlayCanvas,
        document,
        callbacks: {
          onToolChange: setActiveTool,
          onSelectionChange: (ids) => setSelectedIds([...ids]),
          onDocumentChange: bumpDocumentVersion,
          onPageChange: setCurrentPageId,
          onPanelsToggle: setPanelsVisible,
          onExportRequest: () => hostCallbacksRef.current.onExportRequest?.(),
          onShortcutsRequest: () => hostCallbacksRef.current.onShortcutsRequest?.(),
          onCommentPlace: (anchor) => hostCallbacksRef.current.onCommentPlace?.(anchor),
          onCommentPinClick: (id, screen) =>
            hostCallbacksRef.current.onCommentPinClick?.(id, screen),
          onToast: (message) => showToast(message),
          onRemotePeersChange: setRemotePeers,
          onSpotlightFollowChange: setFollowingClientId,
          onThumbnailUpdated: () => {
            if (!cloudDocumentId) return;
            void import('../api/client').then(async ({ uploadDocumentThumbnail }) => {
              const { getDocumentThumbnail } = await import('@rough/document');
              const dataUrl = await getDocumentThumbnail(docId);
              if (dataUrl) await uploadDocumentThumbnail(cloudDocumentId, dataUrl);
            });
          },
        },
      });

      if (readOnly) editor.setReadOnly(true);
      attachE2EBridge(editor);
      performance.mark('rough-editor-ready');

      editorRef.current = editor;
      (window as unknown as { __ROUGH_EDITOR__?: Editor }).__ROUGH_EDITOR__ = editor;
      setCurrentPageId(editor.getCurrentPageId());
      setPanelsVisible(editor.getPanelsVisible());
      hostCallbacksRef.current.onEditorReady?.();
    };

    void init();

    return () => {
      destroyed = true;
      editor?.destroy();
      editorRef.current = null;
      delete (window as unknown as { __ROUGH_EDITOR__?: Editor }).__ROUGH_EDITOR__;
    };
  }, [
    docId,
    docName,
    editorRef,
    setActiveTool,
    setSelectedIds,
    bumpDocumentVersion,
    setCurrentPageId,
    setPanelsVisible,
    readOnly,
  ]);

  const handleDragOver = (e: React.DragEvent): void => {
    if (e.dataTransfer.types.includes(ROUGH_KIT_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent): void => {
    const kitId = e.dataTransfer.getData(ROUGH_KIT_MIME);
    if (!kitId || !editorRef.current || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const world = editorRef.current.viewport.screenToWorld({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    const def = createKitComponent(kitId as KitComponentId);
    const id = editorRef.current.instantiateComponentAt(def, world.x, world.y);
    if (id) bumpDocumentVersion();
  };

  return (
    <div
      ref={containerRef}
      className="canvas-host"
      data-testid="canvas-host"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <canvas ref={mainCanvasRef} className="canvas-main" />
      <canvas ref={overlayCanvasRef} className="canvas-overlay" />
    </div>
  );
}

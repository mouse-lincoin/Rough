import { useEffect, useRef } from 'react';
import { DocumentStore } from '@rough/document';
import { Editor, type EditorCallbacks } from '@rough/editor';
import { useEditorStore } from '../stores/editorStore';
import { attachE2EBridge } from '../e2eBridge';

interface CanvasHostProps {
  docId: string;
  docName: string;
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

  return (
    <div ref={containerRef} className="canvas-host" data-testid="canvas-host">
      <canvas ref={mainCanvasRef} className="canvas-main" />
      <canvas ref={overlayCanvasRef} className="canvas-overlay" />
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { DocumentStore } from '@rough/document';
import { Editor } from '@rough/editor';
import { useEditorStore } from '../stores/editorStore';

interface CanvasHostProps {
  docId: string;
  docName: string;
  editorRef: React.MutableRefObject<Editor | null>;
}

export function CanvasHost({ docId, docName, editorRef }: CanvasHostProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

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
        callbacks: { onToolChange: setActiveTool },
      });

      editorRef.current = editor;
    };

    void init();

    return () => {
      destroyed = true;
      editor?.destroy();
      editorRef.current = null;
    };
  }, [docId, docName, editorRef, setActiveTool]);

  return (
    <div ref={containerRef} className="canvas-host" data-testid="canvas-host">
      <canvas ref={mainCanvasRef} className="canvas-main" />
      <canvas ref={overlayCanvasRef} className="canvas-overlay" />
    </div>
  );
}

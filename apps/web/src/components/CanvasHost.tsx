import { useEffect, useRef } from 'react';
import { Editor } from '@rough/editor';
import { useEditorStore } from '../stores/editorStore';

export function CanvasHost(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const editorRef = useEditorStore((s) => s.editorRef);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);

  useEffect(() => {
    const container = containerRef.current;
    const mainCanvas = mainCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !mainCanvas || !overlayCanvas) return;

    const editor = new Editor({
      container,
      mainCanvas,
      overlayCanvas,
      callbacks: {
        onToolChange: setActiveTool,
      },
    });

    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, [editorRef, setActiveTool]);

  return (
    <div ref={containerRef} className="canvas-host" data-testid="canvas-host">
      <canvas ref={mainCanvasRef} className="canvas-main" />
      <canvas ref={overlayCanvasRef} className="canvas-overlay" />
    </div>
  );
}

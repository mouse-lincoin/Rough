import { useEffect, useRef } from 'react';

export function CanvasHost(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const mainCanvas = mainCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !mainCanvas || !overlayCanvas) return;

    const resize = (): void => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      for (const canvas of [mainCanvas, overlayCanvas]) {
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }

      const ctx = mainCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#F8F8F4';
        ctx.fillRect(0, 0, width, height);
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="canvas-host" data-testid="canvas-host">
      <canvas ref={mainCanvasRef} className="canvas-main" />
      <canvas ref={overlayCanvasRef} className="canvas-overlay" />
    </div>
  );
}

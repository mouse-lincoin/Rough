import type { ID } from '@rough/schema';
import { MemoryDocumentStore } from './document/MemoryDocumentStore.js';
import { SceneGraph } from './scene/SceneGraph.js';
import { SelectionManager } from './interactions/selection.js';
import { Viewport } from './render/viewport.js';
import { Renderer } from './render/Renderer.js';
import { OverlayRenderer } from './render/overlay.js';
import { UndoManager } from './undo/UndoManager.js';
import { EditorContext, type EditorHost } from './EditorContext.js';
import { ToolManager } from './input/ToolManager.js';
import { InputPipeline } from './input/InputPipeline.js';
import type { EditorCallbacks, ToolName } from './types.js';

export interface EditorOptions {
  container: HTMLElement;
  mainCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  callbacks?: EditorCallbacks;
}

export class Editor implements EditorHost {
  readonly document = new MemoryDocumentStore();
  readonly sceneGraph = new SceneGraph();
  readonly selection = new SelectionManager();
  readonly viewport = new Viewport();
  readonly undo = new UndoManager();

  private renderer = new Renderer();
  private overlayRenderer = new OverlayRenderer();
  private ctx: EditorContext;
  private tools: ToolManager;
  private input: InputPipeline | null = null;

  private sceneDirty = true;
  private viewportDirty = true;
  private rafId: number | null = null;
  private cleanMode = false;
  private resizingIds = new Set<ID>();
  private width = 0;
  private height = 0;

  private callbacks: EditorCallbacks;

  constructor(options: EditorOptions) {
    this.callbacks = options.callbacks ?? {};
    this.mainCanvas = options.mainCanvas;
    this.overlayCanvas = options.overlayCanvas;
    this.ctx = new EditorContext(
      this.document,
      this.sceneGraph,
      this.selection,
      this.viewport,
      this.undo,
      this,
    );
    this.tools = new ToolManager(this.ctx);

    this.selection.subscribe((ids) => {
      this.callbacks.onSelectionChange?.(ids);
      this.requestRender();
    });

    this.document.subscribe(() => {
      this.sceneGraph.rebuild(this.document.getElements());
      this.markSceneDirty();
    });

    this.sceneGraph.rebuild(this.document.getElements());
    this.setupCanvases(options);
    this.input = new InputPipeline(
      options.container,
      options.mainCanvas,
      this.ctx,
      this.tools,
      (tool) => {
        this.callbacks.onToolChange?.(tool);
      },
    );
    this.startLoop();
  }

  private setupCanvases(options: EditorOptions): void {
    const resize = (): void => {
      const { width, height } = options.container.getBoundingClientRect();
      this.width = width;
      this.height = height;
      const dpr = window.devicePixelRatio || 1;

      for (const canvas of [options.mainCanvas, options.overlayCanvas]) {
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      this.markSceneDirty();
      this.viewportDirty = true;
      this.requestRender();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(options.container);
  }

  private startLoop(): void {
    const frame = (): void => {
      this.rafId = requestAnimationFrame(frame);
      if (this.sceneDirty || this.viewportDirty) {
        this.render();
        this.sceneDirty = false;
        this.viewportDirty = false;
      }
      this.renderOverlay();
    };
    this.rafId = requestAnimationFrame(frame);
  }

  private render(): void {
    const ctx = this.mainCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const page = this.document.getPage();
    this.renderer.renderMain(
      ctx,
      this.sceneGraph,
      this.viewport,
      this.width,
      this.height,
      page.background,
      this.cleanMode,
      this.resizingIds,
    );
  }

  private renderOverlay(): void {
    const ctx = this.overlayCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const selectTool = this.tools.selectTool;
    this.overlayRenderer.render(ctx, this.sceneGraph, this.viewport, {
      selectedIds: this.selection.selectedIds,
      marqueeRect: selectTool.getMarqueeRect(),
      transformHandle: null,
    });
  }

  private mainCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;

  requestRender(): void {
    this.renderOverlay();
  }

  markSceneDirty(): void {
    this.sceneDirty = true;
  }

  switchTool(tool: ToolName): void {
    this.tools.setTool(tool);
    this.callbacks.onToolChange?.(tool);
  }

  getCleanMode(): boolean {
    return this.cleanMode;
  }

  setCleanMode(clean: boolean): void {
    this.cleanMode = clean;
    this.markSceneDirty();
  }

  getResizingIds(): Set<ID> {
    return this.resizingIds;
  }

  setResizingIds(ids: Set<ID>): void {
    this.resizingIds = ids;
    this.markSceneDirty();
  }

  getActiveTool(): ToolName {
    return this.tools.activeToolName;
  }

  setTool(tool: ToolName): void {
    this.switchTool(tool);
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.input?.destroy();
  }
}

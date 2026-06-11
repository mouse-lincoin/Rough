import type { DocumentStore } from '@rough/document';
import { storeAssetBlob } from '@rough/document';
import type { ID } from '@rough/schema';
import { AddElementCommand } from './commands/ElementCommands.js';
import { createImage } from './document/elementFactory.js';
import { SceneGraph } from './scene/SceneGraph.js';
import { SelectionManager } from './interactions/selection.js';
import { Viewport } from './render/viewport.js';
import { Renderer } from './render/Renderer.js';
import { OverlayRenderer } from './render/overlay.js';
import { EditorContext, type EditorHost } from './EditorContext.js';
import { ToolManager } from './input/ToolManager.js';
import { InputPipeline } from './input/InputPipeline.js';
import { TextEditorOverlay } from './text/textEditorOverlay.js';
import { ImageCache } from './render/imageCache.js';
import type { EditorCallbacks, ToolName } from './types.js';

export interface EditorOptions {
  container: HTMLElement;
  mainCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  document: DocumentStore;
  callbacks?: EditorCallbacks;
}

export class Editor implements EditorHost {
  readonly document: DocumentStore;
  readonly sceneGraph = new SceneGraph();
  readonly selection = new SelectionManager();
  readonly viewport = new Viewport();
  readonly imageCache = new ImageCache();

  private renderer = new Renderer();
  private overlayRenderer = new OverlayRenderer();
  private ctx: EditorContext;
  private tools: ToolManager;
  private input: InputPipeline | null = null;
  private textEditor: TextEditorOverlay;

  private sceneDirty = true;
  private viewportDirty = true;
  private rafId: number | null = null;
  private cleanMode = false;
  private resizingIds = new Set<ID>();
  private width = 0;
  private height = 0;

  private callbacks: EditorCallbacks;
  private mainCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;

  constructor(options: EditorOptions) {
    this.callbacks = options.callbacks ?? {};
    this.mainCanvas = options.mainCanvas;
    this.overlayCanvas = options.overlayCanvas;
    this.document = options.document;

    this.ctx = new EditorContext(
      this.document,
      this.sceneGraph,
      this.selection,
      this.viewport,
      this,
    );
    this.tools = new ToolManager(this.ctx);
    this.textEditor = new TextEditorOverlay(options.container, this.ctx, this.viewport);

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

  static async create(
    options: Omit<EditorOptions, 'document'> & { document?: DocumentStore },
  ): Promise<Editor> {
    const document = options.document ?? (await import('@rough/document')).DocumentStore.createNew();
    await document.bindPersistence();
    return new Editor({ ...options, document });
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
      this.imageCache,
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

  startTextEditing(element: import('@rough/schema').TextElement): void {
    this.textEditor.startEditing(element);
  }

  getContext(): EditorContext {
    return this.ctx;
  }

  async importImage(file: File, worldX: number, worldY: number): Promise<void> {
    const bitmap = await createImageBitmap(file);
    const ref = await storeAssetBlob(
      this.document.getDocumentId(),
      file,
      file.type,
      bitmap.width,
      bitmap.height,
    );
    bitmap.close();
    this.document.addAssetRef(ref);

    const defaults = this.ctx.getElementDefaults();
    const el = createImage(worldX, worldY, ref, { x: ref.width, y: ref.height }, defaults);
    this.ctx.runCommand(new AddElementCommand(this.document, el));
    void this.imageCache.load(ref.id);
    this.markSceneDirty();
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.input?.destroy();
    this.textEditor.destroy();
    this.document.destroy();
  }
}

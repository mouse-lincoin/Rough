import type { DocumentStore } from '@rough/document';
import { storeAssetBlob } from '@rough/document';
import type { ComponentDef, Element, ID, Page, Stroke, FillStyle, OverridableProps } from '@rough/schema';
import { AddElementCommand, UpdateElementsCommand } from './commands/ElementCommands.js';
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
import type { SnapGuide } from './interactions/snapping.js';
import {
  alignSelection,
  copySelection,
  cutSelection,
  distributeSelection,
  duplicateSelection,
  fitViewportToContent,
  fitViewportToSelection,
  getPages,
  groupSelection,
  moveElementInTree,
  pasteClipboard,
  refreshBoundArrows,
  reorderLayers,
  switchPage,
  ungroupSelection,
} from './EditorActions.js';
import type { AlignType } from './interactions/align.js';
import {
  ApplyAutoLayoutCommand,
  CreateComponentCommand,
  DetachInstanceCommand,
  InstantiateComponentCommand,
  UpdateComponentCommand,
  UpdateInstanceOverrideCommand,
} from './commands/componentCommands.js';
import { parseShadowId } from './components/instanceExpansion.js';

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
  private gridSnap = false;
  private panelsVisible = true;
  private snapGuides: SnapGuide[] = [];
  private resizingIds = new Set<ID>();
  private width = 0;
  private height = 0;

  private callbacks: EditorCallbacks;
  private mainCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private copiedStyle: { fills: FillStyle[]; strokes: Stroke[]; roughness: number } | null = null;
  private deepInstanceId: ID | null = null;
  private editingComponentId: ID | null = null;

  constructor(options: EditorOptions) {
    this.callbacks = options.callbacks ?? {};
    this.mainCanvas = options.mainCanvas;
    this.overlayCanvas = options.overlayCanvas;
    this.document = options.document;

    const savedViewport = this.document.getPageViewport(this.document.getCurrentPageId());
    this.viewport.offset = { ...savedViewport.offset };
    this.viewport.zoom = savedViewport.zoom;

    this.ctx = new EditorContext(
      this.document,
      this.sceneGraph,
      this.selection,
      this.viewport,
      this,
    );
    this.tools = new ToolManager(this.ctx, this);
    this.textEditor = new TextEditorOverlay(options.container, this.ctx, this.viewport);

    this.selection.subscribe((ids) => {
      this.callbacks.onSelectionChange?.(ids);
      this.requestRender();
    });

    this.document.subscribe(() => {
      this.sceneGraph.rebuild(this.document.getElements(), this.document.getComponents());
      refreshBoundArrows(this.ctx);
      this.markSceneDirty();
      this.callbacks.onDocumentChange?.();
    });

    this.sceneGraph.rebuild(this.document.getElements(), this.document.getComponents());
    this.setupCanvases(options);
    this.input = new InputPipeline(
      options.container,
      options.mainCanvas,
      this.ctx,
      this.tools,
      this,
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
      snapGuides: this.snapGuides,
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

  getGridSnap(): boolean {
    return this.gridSnap;
  }

  setGridSnap(enabled: boolean): void {
    this.gridSnap = enabled;
  }

  getPanelsVisible(): boolean {
    return this.panelsVisible;
  }

  setPanelsVisible(visible: boolean): void {
    this.panelsVisible = visible;
    this.callbacks.onPanelsToggle?.(visible);
  }

  togglePanels(): void {
    this.setPanelsVisible(!this.panelsVisible);
  }

  setSnapGuides(guides: SnapGuide[]): void {
    this.snapGuides = guides;
    this.requestRender();
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

  getSelection(): ID[] {
    return this.selection.getIds();
  }

  setSelection(ids: ID[]): void {
    this.selection.select(ids);
  }

  getContext(): EditorContext {
    return this.ctx;
  }

  getPages(): Page[] {
    return getPages(this.document);
  }

  getCurrentPageId(): ID {
    return this.document.getCurrentPageId();
  }

  switchPage(pageId: ID): void {
    switchPage(
      this.document,
      this.viewport,
      this.selection,
      pageId,
      this.width,
      this.height,
      (id) => this.callbacks.onPageChange?.(id),
    );
    this.sceneGraph.rebuild(this.document.getElements(), this.document.getComponents());
    this.markSceneDirty();
    this.callbacks.onDocumentChange?.();
  }

  addPage(name?: string): ID {
    const id = this.document.addPage(name);
    this.callbacks.onDocumentChange?.();
    return id;
  }

  removePage(pageId: ID): void {
    this.document.removePage(pageId);
    this.sceneGraph.rebuild(this.document.getElements(), this.document.getComponents());
    this.callbacks.onDocumentChange?.();
  }

  renamePage(pageId: ID, name: string): void {
    this.document.renamePage(pageId, name);
    this.callbacks.onDocumentChange?.();
  }

  reorderPages(pageIds: ID[]): void {
    this.document.reorderPages(pageIds);
    this.callbacks.onDocumentChange?.();
  }

  updateElements(elements: Element[]): void {
    if (this.editingComponentId) {
      this.ctx.runCommand(
        new UpdateComponentCommand(this.document, this.editingComponentId, elements),
      );
      return;
    }
    const shadowUpdates: Element[] = [];
    const pageUpdates: Element[] = [];
    for (const el of elements) {
      const shadow = parseShadowId(el.id);
      if (shadow) {
        const instance = this.document.getElement(shadow.instanceId);
        if (instance?.type === 'instance') {
          const override: Partial<OverridableProps> = {};
          if ('text' in el && el.type === 'text') override.text = el.text;
          if (el.fills) override.fills = el.fills;
          if (el.strokes) override.strokes = el.strokes;
          if (el.visible !== undefined) override.visible = el.visible;
          if (el.opacity !== undefined) override.opacity = el.opacity;
          this.ctx.runCommand(
            new UpdateInstanceOverrideCommand(
              this.document,
              shadow.instanceId,
              shadow.innerNodeId,
              override,
            ),
          );
        }
      } else if (this.document.getElement(el.id)) {
        pageUpdates.push(el);
      }
    }
    if (pageUpdates.length > 0) {
      this.ctx.runCommand(new UpdateElementsCommand(this.document, pageUpdates));
    }
    void shadowUpdates;
  }

  updateElementProperty(id: ID, patch: Partial<Element>): void {
    const shadow = parseShadowId(id);
    if (shadow) {
      const override: Partial<OverridableProps> = {};
      if ('text' in patch) override.text = patch.text as string;
      if (patch.fills) override.fills = patch.fills;
      if (patch.strokes) override.strokes = patch.strokes;
      if (patch.visible !== undefined) override.visible = patch.visible;
      if (patch.opacity !== undefined) override.opacity = patch.opacity;
      this.ctx.runCommand(
        new UpdateInstanceOverrideCommand(
          this.document,
          shadow.instanceId,
          shadow.innerNodeId,
          override,
        ),
      );
      return;
    }

    if (this.editingComponentId) {
      const component = this.document.getComponent(this.editingComponentId);
      const el = component?.elements[id];
      if (!el || !component) return;
      this.ctx.runCommand(
        new UpdateComponentCommand(this.document, this.editingComponentId, [
          { ...el, ...patch } as Element,
        ]),
      );
      return;
    }

    const el = this.document.getElement(id);
    if (!el) return;
    this.ctx.runCommand(new UpdateElementsCommand(this.document, [{ ...el, ...patch } as Element]));
  }

  createComponent(): void {
    const ids = this.selection.getIds();
    if (ids.length !== 1) return;
    const el = this.document.getElement(ids[0]);
    if (!el || el.type !== 'frame') return;
    this.ctx.runCommand(new CreateComponentCommand(this.document, el.id));
    this.selection.select([el.id]);
  }

  applyAutoLayout(): void {
    const ids = this.selection.getIds();
    if (ids.length === 0) return;
    this.ctx.runCommand(new ApplyAutoLayoutCommand(this.document, ids));
  }

  instantiateComponentAt(def: ComponentDef, worldX: number, worldY: number): ID | null {
    const cmd = new InstantiateComponentCommand(this.document, def, worldX, worldY, null);
    this.ctx.runCommand(cmd);
    if (cmd.instanceId) this.selection.select([cmd.instanceId]);
    return cmd.instanceId;
  }

  detachInstance(): void {
    const ids = this.selection.getIds();
    if (ids.length !== 1) return;
    const el = this.document.getElement(ids[0]);
    if (!el || el.type !== 'instance') return;
    this.ctx.runCommand(new DetachInstanceCommand(this.document, el.id));
    this.selection.select([el.id]);
  }

  enterDeepSelection(instanceId: ID): void {
    this.deepInstanceId = instanceId;
  }

  exitDeepSelection(): void {
    this.deepInstanceId = null;
  }

  getDeepInstanceId(): ID | null {
    return this.deepInstanceId;
  }

  editMasterComponent(componentId: ID): void {
    this.editingComponentId = componentId;
    this.exitDeepSelection();
    this.selection.clear();
  }

  exitMasterEdit(): void {
    this.editingComponentId = null;
  }

  getEditingComponentId(): ID | null {
    return this.editingComponentId;
  }

  getComponents(): ComponentDef[] {
    return Object.values(this.document.getComponents());
  }

  group(): void {
    groupSelection(this.ctx, this.selection.getIds());
  }

  ungroup(): void {
    ungroupSelection(this.ctx, this.selection.getIds());
  }

  align(type: AlignType): void {
    alignSelection(this.ctx, this.selection.getIds(), type);
  }

  distribute(axis: 'horizontal' | 'vertical'): void {
    distributeSelection(this.ctx, this.selection.getIds(), axis);
  }

  reorderLayer(direction: 'forward' | 'backward' | 'front' | 'back'): void {
    reorderLayers(this.ctx, this.selection.getIds(), direction);
  }

  async copy(): Promise<void> {
    await copySelection(this.ctx, this.selection.getIds());
  }

  async cut(): Promise<void> {
    await cutSelection(this.ctx, this.selection.getIds(), this.selection);
  }

  async pasteAt(worldX: number, worldY: number): Promise<void> {
    const ids = await pasteClipboard(this.ctx, worldX, worldY);
    if (ids.length > 0) this.selection.select(ids);
  }

  duplicate(): void {
    const ids = duplicateSelection(this.ctx, this.selection.getIds());
    if (ids.length > 0) this.selection.select(ids);
  }

  moveElementInTree(elementId: ID, newParentId: ID | null, beforeSiblingId: ID | null): void {
    moveElementInTree(this.document, this.sceneGraph, elementId, newParentId, beforeSiblingId);
    this.sceneGraph.rebuild(this.document.getElements(), this.document.getComponents());
    refreshBoundArrows(this.ctx);
    this.markSceneDirty();
    this.callbacks.onDocumentChange?.();
  }

  copyStyle(): void {
    const ids = this.selection.getIds();
    if (ids.length !== 1) return;
    const el = this.document.getElement(ids[0]);
    if (!el) return;
    this.copiedStyle = {
      fills: structuredClone(el.fills),
      strokes: structuredClone(el.strokes),
      roughness: el.roughness,
    };
  }

  pasteStyle(): void {
    if (!this.copiedStyle) return;
    const elements = this.selection
      .getIds()
      .map((id) => this.document.getElement(id))
      .filter((e): e is Element => e !== undefined)
      .map((e) => ({
        ...e,
        fills: structuredClone(this.copiedStyle!.fills),
        strokes: structuredClone(this.copiedStyle!.strokes),
        roughness: this.copiedStyle!.roughness,
      }));
    if (elements.length > 0) {
      this.ctx.runCommand(new UpdateElementsCommand(this.document, elements));
    }
  }

  zoomTo100(): void {
    this.viewport.zoom = 1;
    this.markSceneDirty();
  }

  zoomIn(): void {
    this.viewport.zoomAt({ x: this.width / 2, y: this.height / 2 }, 1.2);
    this.markSceneDirty();
  }

  zoomOut(): void {
    this.viewport.zoomAt({ x: this.width / 2, y: this.height / 2 }, 0.8);
    this.markSceneDirty();
  }

  fitAll(): void {
    fitViewportToContent(this.viewport, this.sceneGraph, this.width, this.height);
    this.markSceneDirty();
  }

  fitSelection(): void {
    fitViewportToSelection(
      this.viewport,
      this.sceneGraph,
      this.selection.getIds(),
      this.width,
      this.height,
    );
    this.markSceneDirty();
  }

  persistViewport(): void {
    this.document.persistPageViewport(this.document.getCurrentPageId(), {
      offset: { ...this.viewport.offset },
      zoom: this.viewport.zoom,
    });
  }

  startTextEditing(element: import('@rough/schema').TextElement): void {
    this.textEditor.startEditing(element);
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
    this.persistViewport();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.input?.destroy();
    this.textEditor.destroy();
    this.document.destroy();
  }
}

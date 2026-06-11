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
import {
  exportToJson,
  exportToSvg,
  generateAiPrompt,
  inferMarkdown,
  packPngExports,
  parseRoughDocument,
  resolveExportTargets,
  type AiPromptFramework,
} from '@rough/export';
import { getAssetBlob, saveDocumentThumbnail } from '@rough/document';
import { capturePageThumbnail } from './export/thumbnailCapture.js';
import type { CommentPin, ExportContext, EditorCallbacks, ToolName } from './types.js';
import {
  computeAnchorDegradations,
  resolveCommentAnchorWorld,
  worldToElementLocal,
} from './comments/commentAnchors.js';
import { renderRootsToPngBlobs } from './export/offscreenRender.js';
import { AwarenessSync, type RemotePeer } from './collab/AwarenessSync.js';
import type { CollabOptions } from '@rough/document';
import type { SnapGuide } from './interactions/snapping.js';
import { findDeepestContainerAtPoint, hitTestPoint } from './interactions/hitTest.js';
import { canReparentTo, getSelectionRoots } from './interactions/treeUtils.js';
import { collectSubtree } from './clipboard/clipboard.js';
import {
  alignSelection,
  copySelection,
  cutSelection,
  distributeSelection,
  duplicateSelection,
  fitViewportToContent,
  fitViewportToPoint,
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
  CreateComponentFromSelectionCommand,
  DetachInstanceCommand,
  InstantiateComponentCommand,
  RemoveComponentCommand,
  UpdateComponentCommand,
  UpdateInstanceOverrideCommand,
} from './commands/componentCommands.js';
import { getBlockedOverrideKeys, parseShadowId } from './components/instanceExpansion.js';

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
  private dropTargetFrameId: ID | null = null;
  private bindingTargetId: ID | null = null;
  private layoutInsertLine: import('./render/overlay.js').LayoutInsertLine | null = null;
  private resizingIds = new Set<ID>();
  private width = 0;
  private height = 0;

  private callbacks: EditorCallbacks;
  private mainCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;
  private copiedStyle: { fills: FillStyle[]; strokes: Stroke[]; roughness: number } | null = null;
  private deepInstanceId: ID | null = null;
  private editingComponentId: ID | null = null;
  private awareness: AwarenessSync | null = null;
  private remotePeers: RemotePeer[] = [];
  private thumbnailTimer: ReturnType<typeof setTimeout> | null = null;
  private commentPins: CommentPin[] = [];
  private highlightedCommentId: ID | null = null;
  private lastElementIds = new Set<ID>();
  private commentAnchorsDegradeHandler: EditorCallbacks['onCommentAnchorsDegrade'] | null = null;

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
      this.awareness?.publishSelection(ids, this.document.getCurrentPageId());
      this.requestRender();
    });

    this.document.subscribe(() => {
      const elements = this.document.getElements();
      const currentIds = new Set(Object.keys(elements));
      const deletedIds = [...this.lastElementIds].filter((id) => !currentIds.has(id));

      if (deletedIds.length > 0 && this.commentPins.length > 0) {
        const degradations = computeAnchorDegradations(
          this.sceneGraph,
          this.commentPins,
          new Set(deletedIds),
        );
        if (degradations.length > 0) {
          this.commentPins = this.commentPins.map((pin) => {
            const degraded = degradations.find((d) => d.id === pin.id);
            return degraded
              ? { ...pin, elementId: null, worldX: degraded.worldX, worldY: degraded.worldY }
              : pin;
          });
          this.commentAnchorsDegradeHandler?.(degradations);
          this.callbacks.onCommentAnchorsDegrade?.(degradations);
        }
      }

      this.sceneGraph.rebuild(elements, this.document.getComponents());
      this.lastElementIds = currentIds;
      refreshBoundArrows(this.ctx);
      this.markSceneDirty();
      this.callbacks.onDocumentChange?.();
      this.scheduleThumbnailCapture();
    });

    this.sceneGraph.rebuild(this.document.getElements(), this.document.getComponents());
    this.lastElementIds = new Set(Object.keys(this.document.getElements()));
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
      dropTargetFrameId: this.dropTargetFrameId,
      bindingTargetId: this.bindingTargetId,
      layoutInsertLine: this.layoutInsertLine,
      remotePeers: this.remotePeers,
      currentPageId: this.document.getCurrentPageId(),
      commentPins: this.commentPins,
      highlightedCommentId: this.highlightedCommentId,
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

  setDropTargetFrame(frameId: ID | null): void {
    this.dropTargetFrameId = frameId;
    this.requestRender();
  }

  setBindingTarget(elementId: ID | null): void {
    this.bindingTargetId = elementId;
    this.requestRender();
  }

  setLayoutInsertLine(line: import('./render/overlay.js').LayoutInsertLine | null): void {
    this.layoutInsertLine = line;
    this.requestRender();
  }

  reparentElementsAtDrop(ids: ID[], world: import('@rough/schema').Vec2): void {
    const elements = this.document.getElements();
    const roots = getSelectionRoots(elements, ids);
    const exclude = new Set<ID>();
    for (const id of roots) {
      for (const el of collectSubtree(elements, [id])) {
        exclude.add(el.id);
      }
    }

    const target = findDeepestContainerAtPoint(
      this.sceneGraph,
      world,
      this.viewport.zoom,
      exclude,
    );

    for (const id of roots) {
      const el = this.document.getElement(id);
      if (!el || el.parentId === target) continue;
      if (!canReparentTo(elements, id, target)) continue;
      moveElementInTree(this.ctx, id, target, null);
    }

    refreshBoundArrows(this.ctx);
    this.callbacks.onDocumentChange?.();
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
    const pageUpdates: Element[] = [];
    for (const el of elements) {
      const shadow = parseShadowId(el.id);
      if (shadow) {
        const before = this.sceneGraph.getNode(el.id)?.element;
        if (before) {
          const blocked = getBlockedOverrideKeys(
            Object.fromEntries(
              Object.entries(el).filter(([key, value]) => {
                const prev = (before as unknown as Record<string, unknown>)[key];
                return JSON.stringify(prev) !== JSON.stringify(value);
              }),
            ),
          );
          if (blocked.length > 0) {
            this.callbacks.onToast?.('实例内该属性不可覆盖，请先 Detach');
            continue;
          }
        }
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
  }

  updateElementProperty(id: ID, patch: Partial<Element>): void {
    const shadow = parseShadowId(id);
    if (shadow) {
      const blocked = getBlockedOverrideKeys(patch as Record<string, unknown>);
      if (blocked.length > 0) {
        this.callbacks.onToast?.('实例内该属性不可覆盖，请先 Detach');
        return;
      }
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
    if (ids.length === 0) return;
    const el = ids.length === 1 ? this.document.getElement(ids[0]) : null;
    if (el?.type === 'frame') {
      this.ctx.runCommand(new CreateComponentCommand(this.document, el.id));
      this.selection.select([el.id]);
      return;
    }
    const cmd = new CreateComponentFromSelectionCommand(this.document, ids);
    this.ctx.runCommand(cmd);
    if (cmd.instanceId) this.selection.select([cmd.instanceId]);
  }

  removeComponent(componentId: ID): void {
    this.ctx.runCommand(new RemoveComponentCommand(this.document, componentId));
    if (this.editingComponentId === componentId) {
      this.exitMasterEdit();
    }
    this.callbacks.onDocumentChange?.();
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
    moveElementInTree(this.ctx, elementId, newParentId, beforeSiblingId);
    refreshBoundArrows(this.ctx);
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

  requestExport(): void {
    this.callbacks.onExportRequest?.();
  }

  requestShortcutsHelp(): void {
    this.callbacks.onShortcutsRequest?.();
  }

  private scheduleThumbnailCapture(): void {
    if (this.thumbnailTimer) clearTimeout(this.thumbnailTimer);
    this.thumbnailTimer = setTimeout(() => {
      void this.captureAndSaveThumbnail();
    }, 10_000);
  }

  async captureAndSaveThumbnail(): Promise<void> {
    const page = this.document.getPage();
    const dataUrl = await capturePageThumbnail({
      elements: page.elements,
      components: this.document.getComponents(),
      background: page.background,
      cleanMode: this.cleanMode,
      imageCache: this.imageCache,
    });
    if (!dataUrl) return;
    await saveDocumentThumbnail(this.document.getDocumentId(), dataUrl);
    this.callbacks.onThumbnailUpdated?.();
  }

  connectCollab(options: CollabOptions & { user: { id: string; name: string } }): void {
    this.document.connectCollab(options);
    this.awareness?.destroy();
    this.awareness = new AwarenessSync(this.document, this.viewport, options.user);
    this.awareness.start(
      () => this.document.getCurrentPageId(),
      (peers) => {
        this.remotePeers = peers;
        this.requestRender();
      },
    );
    void this.document.waitForCollabSynced().then((ok) => {
      if (ok) this.document.reconcileCurrentPage();
    });
  }

  disconnectCollab(): void {
    this.awareness?.destroy();
    this.awareness = null;
    this.remotePeers = [];
    this.document.disconnectCollab();
    this.requestRender();
  }

  broadcastCommentChange(type: 'created' | 'updated'): void {
    this.awareness?.broadcastCommentEvent(type);
  }

  onRemoteCommentEvent(
    handler: (event: { type: 'created' | 'updated'; at: number }) => void,
  ): () => void {
    return this.awareness?.onCommentEvent(handler) ?? (() => {});
  }

  publishPointer(world: import('@rough/schema').Vec2): void {
    this.awareness?.publishPointer(world, this.selection.selectedIds, this.document.getCurrentPageId());
  }

  setReadOnly(readOnly: boolean): void {
    this.document.setReadOnly(readOnly);
  }

  isReadOnly(): boolean {
    return this.document.isReadOnly();
  }

  placeComment(worldX: number, worldY: number): void {
    const hit = hitTestPoint(
      this.sceneGraph,
      { x: worldX, y: worldY },
      this.viewport.zoom,
      this.deepInstanceId,
    );
    const elementId = hit?.element.id ?? null;
    let anchorX = worldX;
    let anchorY = worldY;
    if (elementId) {
      const local = worldToElementLocal(this.sceneGraph, elementId, { x: worldX, y: worldY });
      if (local) {
        anchorX = local.x;
        anchorY = local.y;
      }
    }
    this.callbacks.onCommentPlace?.({
      pageId: this.document.getCurrentPageId(),
      worldX: anchorX,
      worldY: anchorY,
      elementId,
    });
  }

  setCommentPins(pins: CommentPin[]): void {
    this.commentPins = pins;
    this.requestRender();
  }

  setCommentAnchorsDegradeHandler(
    handler: EditorCallbacks['onCommentAnchorsDegrade'] | undefined,
  ): void {
    this.commentAnchorsDegradeHandler = handler ?? null;
  }

  setHighlightedCommentId(commentId: ID | null): void {
    this.highlightedCommentId = commentId;
    this.requestRender();
  }

  resolveCommentWorld(anchor: {
    elementId: ID | null;
    worldX: number;
    worldY: number;
  }): import('@rough/schema').Vec2 {
    return resolveCommentAnchorWorld(this.sceneGraph, anchor);
  }

  handleCommentPinClick(commentId: ID, screen: import('@rough/schema').Vec2): void {
    this.setHighlightedCommentId(commentId);
    this.callbacks.onCommentPinClick?.(commentId, screen);
  }

  hitTestCommentPin(screen: import('@rough/schema').Vec2): ID | null {
    const radius = OverlayRenderer.pinHitRadius();
    let hit: { id: ID; dist: number } | null = null;
    const pageId = this.document.getCurrentPageId();

    for (const pin of this.commentPins) {
      if (pin.pageId !== pageId) continue;
      const world = resolveCommentAnchorWorld(this.sceneGraph, pin);
      const p = this.viewport.worldToScreen(world);
      const dist = Math.hypot(p.x - screen.x, p.y - screen.y);
      if (dist <= radius && (!hit || dist < hit.dist)) {
        hit = { id: pin.id, dist };
      }
    }
    return hit?.id ?? null;
  }

  goToComment(anchor: {
    pageId: ID;
    elementId: ID | null;
    worldX: number;
    worldY: number;
  }): void {
    if (anchor.pageId !== this.document.getCurrentPageId()) {
      this.switchPage(anchor.pageId);
    }
    const world = resolveCommentAnchorWorld(this.sceneGraph, anchor);
    fitViewportToPoint(this.viewport, world.x, world.y, this.width, this.height);
    this.markSceneDirty();
    this.requestRender();
  }

  getExportContext(): ExportContext {
    const selectionIds = [...this.selection.selectedIds];
    const elements = this.document.getElements();
    return {
      pageId: this.document.getCurrentPageId(),
      selectionIds,
      exportTargetIds: resolveExportTargets(elements, selectionIds),
    };
  }

  getMarkdownExport(frameIds?: ID[]): string {
    const ctx = this.getExportContext();
    const ids = frameIds ?? ctx.exportTargetIds;
    return inferMarkdown(this.document.getDocument(), ctx.pageId, ids);
  }

  getAiPromptExport(framework: AiPromptFramework = 'react-tailwind', frameIds?: ID[]): string {
    return generateAiPrompt(this.getMarkdownExport(frameIds), framework);
  }

  getJsonExport(): string {
    return exportToJson(this.document.getDocument());
  }

  async exportPng(scale: 1 | 2 | 4 = 2): Promise<Blob> {
    const ctx = this.getExportContext();
    const doc = this.document.getDocument();
    const page = doc.pages[ctx.pageId];
    const files = await renderRootsToPngBlobs({
      elements: page?.elements ?? {},
      components: this.document.getComponents(),
      rootIds: ctx.exportTargetIds,
      background: page?.background ?? { r: 248, g: 248, b: 244, a: 1 },
      scale,
      cleanMode: this.cleanMode,
      imageCache: this.imageCache,
    });
    return packPngExports(files);
  }

  async exportSvg(): Promise<string> {
    const ctx = this.getExportContext();
    const page = this.document.getPage();
    return exportToSvg(
      page.elements,
      ctx.exportTargetIds,
      this.document.getComponents(),
      async (assetId) => {
        const blob = await getAssetBlob(assetId);
        if (!blob) return null;
        return blobToDataUrl(blob);
      },
    );
  }

  importJson(json: string): void {
    const doc = parseRoughDocument(json);
    this.document.replaceFromRoughDocument(doc);
    this.sceneGraph.rebuild(this.document.getElements(), this.document.getComponents());
    this.selection.clear();
    this.markSceneDirty();
    this.callbacks.onDocumentChange?.();
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
    if (this.thumbnailTimer) clearTimeout(this.thumbnailTimer);
    void this.captureAndSaveThumbnail();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.awareness?.destroy();
    this.input?.destroy();
    this.textEditor.destroy();
    this.document.destroy();
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

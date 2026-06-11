import type { DocumentStore } from '@rough/document';
import type { Element, ID, TextElement } from '@rough/schema';
import type { SceneGraph } from './scene/SceneGraph.js';
import type { SelectionManager } from './interactions/selection.js';
import type { Viewport } from './render/viewport.js';
import type { ToolName } from './types.js';
import type { Command } from './undo/Command.js';

export interface EditorHost {
  requestRender(): void;
  markSceneDirty(): void;
  switchTool(tool: ToolName): void;
  getCleanMode(): boolean;
  getResizingIds(): Set<ID>;
  setResizingIds(ids: Set<ID>): void;
  startTextEditing?(element: TextElement): void;
}

export class EditorContext {
  constructor(
    public readonly document: DocumentStore,
    public readonly sceneGraph: SceneGraph,
    public readonly selection: SelectionManager,
    public readonly viewport: Viewport,
    private readonly host: EditorHost,
  ) {}

  requestRender(): void {
    this.host.requestRender();
  }

  markSceneDirty(): void {
    this.host.markSceneDirty();
  }

  switchTool(tool: ToolName): void {
    this.host.switchTool(tool);
  }

  getCleanMode(): boolean {
    return this.host.getCleanMode();
  }

  getResizingIds(): Set<ID> {
    return this.host.getResizingIds();
  }

  setResizingIds(ids: Set<ID>): void {
    this.host.setResizingIds(ids);
  }

  rebuildScene(): void {
    this.sceneGraph.rebuild(this.document.getElements());
    this.markSceneDirty();
  }

  runCommand(command: Command): void {
    command.execute();
    this.rebuildScene();
  }

  /** Live drag preview — updates scene graph only, no Y.Doc write */
  updateElementsLive(elements: Element[]): void {
    const merged = { ...this.document.getElements() };
    for (const el of elements) merged[el.id] = el;
    this.sceneGraph.rebuild(merged);
    this.markSceneDirty();
  }

  startTextEditing(element: TextElement): void {
    this.host.startTextEditing?.(element);
  }

  getElementDefaults(parentId: ID | null = null): {
    roughness: number;
    roughSeed: number;
    sortKey: string;
    parentId: ID | null;
  } {
    return {
      roughness: this.getCleanMode() ? 0 : 1,
      roughSeed: Math.floor(Math.random() * 2 ** 31),
      sortKey: this.document.getNextSortKey(parentId),
      parentId,
    };
  }
}

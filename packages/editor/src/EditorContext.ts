import type { Element, ID } from '@rough/schema';
import type { MemoryDocumentStore } from './document/MemoryDocumentStore.js';
import type { SceneGraph } from './scene/SceneGraph.js';
import type { SelectionManager } from './interactions/selection.js';
import type { Viewport } from './render/viewport.js';
import type { UndoManager } from './undo/UndoManager.js';
import type { ToolName } from './types.js';
import type { Command } from './undo/Command.js';

export interface EditorHost {
  requestRender(): void;
  markSceneDirty(): void;
  switchTool(tool: ToolName): void;
  getCleanMode(): boolean;
  getResizingIds(): Set<ID>;
  setResizingIds(ids: Set<ID>): void;
}

export class EditorContext {
  constructor(
    public readonly document: MemoryDocumentStore,
    public readonly sceneGraph: SceneGraph,
    public readonly selection: SelectionManager,
    public readonly viewport: Viewport,
    public readonly undo: UndoManager,
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
    this.undo.execute(command);
    this.rebuildScene();
  }

  updateElementsLive(elements: Element[]): void {
    this.document.transact(() => {
      this.document.setElements(elements);
    });
    this.rebuildScene();
  }

  getElementDefaults(): { roughness: number; roughSeed: number; sortKey: string } {
    return {
      roughness: this.getCleanMode() ? 0 : 1,
      roughSeed: Math.floor(Math.random() * 2 ** 31),
      sortKey: this.document.getNextSortKey(),
    };
  }
}

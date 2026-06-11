import type { DocumentStore } from '@rough/document';
import type { Element, ID } from '@rough/schema';
import { matApply } from '../scene/transforms.js';
import { worldToLocal } from '../scene/bounds.js';
import type { SceneGraph } from '../scene/SceneGraph.js';
import type { Command } from '../undo/Command.js';

export function computeMovedElementInTree(
  store: DocumentStore,
  sceneGraph: SceneGraph,
  elementId: ID,
  newParentId: ID | null,
  beforeSiblingId: ID | null,
): Element | null {
  const el = store.getElement(elementId);
  if (!el) return null;

  const node = sceneGraph.getNode(elementId);
  if (!node) return null;

  const worldPos = matApply(node.worldMatrix, { x: 0, y: 0 });
  let newSortKey: string;
  if (beforeSiblingId) {
    const siblings = store.getChildren(newParentId);
    const idx = siblings.findIndex((s) => s.id === beforeSiblingId);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    newSortKey = store.getSortKeyBetween(prev?.id ?? null, beforeSiblingId, newParentId);
  } else {
    newSortKey = store.getNextSortKey(newParentId);
  }

  let localX = worldPos.x;
  let localY = worldPos.y;
  if (newParentId) {
    const parentNode = sceneGraph.getNode(newParentId);
    if (parentNode) {
      const local = worldToLocal(parentNode.worldMatrix, worldPos);
      if (local) {
        localX = local.x;
        localY = local.y;
      }
    }
  }

  return { ...el, parentId: newParentId, sortKey: newSortKey, x: localX, y: localY };
}

export class MoveElementInTreeCommand implements Command {
  private before: Element | null = null;
  private after: Element | null = null;

  constructor(
    private store: DocumentStore,
    private sceneGraph: SceneGraph,
    private elementId: ID,
    private newParentId: ID | null,
    private beforeSiblingId: ID | null,
  ) {}

  execute(): void {
    this.before = this.store.getElement(this.elementId) ?? null;
    if (!this.before) return;
    if (this.after === null) {
      this.after = computeMovedElementInTree(
        this.store,
        this.sceneGraph,
        this.elementId,
        this.newParentId,
        this.beforeSiblingId,
      );
    }
    if (this.after) {
      this.store.setElement(this.after);
    }
  }

  undo(): void {
    if (this.before) {
      this.store.setElement(this.before);
    }
  }
}

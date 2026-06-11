import type { DocumentStore } from '@rough/document';
import type { Element, ID, Page } from '@rough/schema';
import type { EditorContext } from './EditorContext.js';
import { UpdateElementsCommand, DeleteElementsCommand } from './commands/ElementCommands.js';
import { GroupElementsCommand, UngroupElementsCommand } from './commands/groupCommands.js';
import { ReorderLayerCommand } from './commands/layerCommands.js';
import { alignElements, distributeElements, type AlignType } from './interactions/align.js';
import { updateAllBoundArrows } from './interactions/arrowBinding.js';
import {
  collectSubtree,
  readFromClipboard,
  remapClipboardElements,
  writeToClipboard,
  duplicateElements,
} from './clipboard/clipboard.js';
import type { SelectionManager } from './interactions/selection.js';
import type { Viewport } from './render/viewport.js';
import { getWorldAABB, mergeAABB } from './scene/bounds.js';
import type { SceneGraph } from './scene/SceneGraph.js';
import { MoveElementInTreeCommand } from './commands/treeCommands.js';

export function refreshBoundArrows(ctx: EditorContext): void {
  const updated = updateAllBoundArrows(ctx.document.getElements(), ctx.sceneGraph);
  const changed = updated.filter((el) => {
    const orig = ctx.document.getElement(el.id);
    if (!orig) return false;
    return JSON.stringify(orig) !== JSON.stringify(el);
  });
  if (changed.length > 0) {
    ctx.document.setElements(changed);
  }
}

export function groupSelection(ctx: EditorContext, ids: ID[]): void {
  if (ids.length < 2) return;
  ctx.runCommand(new GroupElementsCommand(ctx.document, ids));
}

export function ungroupSelection(ctx: EditorContext, ids: ID[]): void {
  const groupIds = ids.filter((id) => ctx.document.getElement(id)?.type === 'group');
  if (groupIds.length === 0) return;
  ctx.runCommand(new UngroupElementsCommand(ctx.document, groupIds));
}

export function alignSelection(ctx: EditorContext, ids: ID[], type: AlignType): void {
  const elements = ids
    .map((id) => ctx.document.getElement(id))
    .filter((e): e is Element => e !== undefined);
  if (elements.length === 0) return;

  let reference: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  if (elements.length === 1) {
    const parentId = elements[0].parentId;
    if (parentId) {
      const parent = ctx.document.getElement(parentId);
      if (parent) {
        reference = { minX: 0, minY: 0, maxX: parent.width, maxY: parent.height };
      }
    }
  } else {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    reference = { minX, minY, maxX, maxY };
  }

  const aligned = alignElements(elements, type, reference);
  ctx.runCommand(new UpdateElementsCommand(ctx.document, aligned));
}

export function distributeSelection(
  ctx: EditorContext,
  ids: ID[],
  axis: 'horizontal' | 'vertical',
): void {
  const elements = ids
    .map((id) => ctx.document.getElement(id))
    .filter((e): e is Element => e !== undefined);
  if (elements.length < 3) return;
  const distributed = distributeElements(elements, axis);
  ctx.runCommand(new UpdateElementsCommand(ctx.document, distributed));
}

export function reorderLayers(
  ctx: EditorContext,
  ids: ID[],
  direction: 'forward' | 'backward' | 'front' | 'back',
): void {
  ctx.runCommand(new ReorderLayerCommand(ctx.document, ids, direction));
}

export async function copySelection(ctx: EditorContext, ids: ID[]): Promise<void> {
  const subtree = collectSubtree(ctx.document.getElements(), ids);
  await writeToClipboard(ctx.document.getDocumentId(), subtree);
}

export async function cutSelection(
  ctx: EditorContext,
  ids: ID[],
  selection: SelectionManager,
): Promise<void> {
  await copySelection(ctx, ids);
  ctx.runCommand(new DeleteElementsCommand(ctx.document, ids));
  selection.clear();
}

export async function pasteClipboard(
  ctx: EditorContext,
  worldX: number,
  worldY: number,
): Promise<ID[]> {
  const payload = await readFromClipboard();
  if (!payload || payload.elements.length === 0) return [];

  const roots = payload.elements.filter(
    (el) => !payload.elements.some((p) => p.id === el.parentId),
  );
  const minX = Math.min(...roots.map((e) => e.x));
  const minY = Math.min(...roots.map((e) => e.y));
  const offsetX = worldX - minX;
  const offsetY = worldY - minY;

  const remapped = remapClipboardElements(
    payload.elements,
    null,
    offsetX,
    offsetY,
    () => ctx.document.getNextSortKey(null),
  );
  ctx.document.setElements(remapped);
  ctx.rebuildScene();
  const oldToNew = new Map<ID, ID>();
  for (let i = 0; i < payload.elements.length; i++) {
    oldToNew.set(payload.elements[i].id, remapped[i].id);
  }
  return roots.map((r) => oldToNew.get(r.id)!).filter(Boolean);
}

export function duplicateSelection(ctx: EditorContext, ids: ID[]): ID[] {
  const newIds = duplicateElements(ctx.document, ids);
  ctx.rebuildScene();
  return newIds;
}

export function moveElementInTree(
  ctx: EditorContext,
  elementId: ID,
  newParentId: ID | null,
  beforeSiblingId: ID | null,
): void {
  ctx.runCommand(
    new MoveElementInTreeCommand(ctx.document, ctx.sceneGraph, elementId, newParentId, beforeSiblingId),
  );
}

export function switchPage(
  document: DocumentStore,
  viewport: Viewport,
  selection: SelectionManager,
  pageId: ID,
  _width: number,
  _height: number,
  onPageChange?: (pageId: ID) => void,
): void {
  const currentId = document.getCurrentPageId();
  if (currentId === pageId) return;

  document.persistPageViewport(currentId, {
    offset: { ...viewport.offset },
    zoom: viewport.zoom,
  });

  document.setCurrentPageId(pageId);
  const saved = document.getPageViewport(pageId);
  viewport.offset = { ...saved.offset };
  viewport.zoom = saved.zoom;

  selection.clear();
  onPageChange?.(pageId);
}

export function fitViewportToContent(
  viewport: Viewport,
  sceneGraph: SceneGraph,
  width: number,
  height: number,
  padding = 48,
): void {
  if (sceneGraph.roots.length === 0) {
    viewport.offset = { x: 0, y: 0 };
    viewport.zoom = 1;
    return;
  }
  let aabb = getWorldAABB(sceneGraph.roots[0]);
  for (let i = 1; i < sceneGraph.roots.length; i++) {
    aabb = mergeAABB(aabb, getWorldAABB(sceneGraph.roots[i]));
  }
  const contentW = aabb.maxX - aabb.minX;
  const contentH = aabb.maxY - aabb.minY;
  if (contentW <= 0 || contentH <= 0) return;

  const zoomX = (width - padding * 2) / contentW;
  const zoomY = (height - padding * 2) / contentH;
  viewport.zoom = Math.min(zoomX, zoomY, 2);
  viewport.offset = {
    x: aabb.minX - (width / viewport.zoom - contentW) / 2,
    y: aabb.minY - (height / viewport.zoom - contentH) / 2,
  };
}

export function fitViewportToPoint(
  viewport: Viewport,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
  targetZoom = 1.25,
): void {
  viewport.zoom = Math.min(Math.max(targetZoom, 0.25), 4);
  viewport.offset = {
    x: worldX - width / (2 * viewport.zoom),
    y: worldY - height / (2 * viewport.zoom),
  };
}

export function fitViewportToSelection(
  viewport: Viewport,
  sceneGraph: SceneGraph,
  ids: ID[],
  width: number,
  height: number,
  padding = 48,
): void {
  if (ids.length === 0) return;
  const nodes = ids.map((id) => sceneGraph.getNode(id)).filter((n) => n !== undefined);
  if (nodes.length === 0) return;

  let aabb = getWorldAABB(nodes[0]);
  for (let i = 1; i < nodes.length; i++) {
    aabb = mergeAABB(aabb, getWorldAABB(nodes[i]));
  }
  const contentW = aabb.maxX - aabb.minX;
  const contentH = aabb.maxY - aabb.minY;
  if (contentW <= 0 || contentH <= 0) return;

  const zoomX = (width - padding * 2) / contentW;
  const zoomY = (height - padding * 2) / contentH;
  viewport.zoom = Math.min(zoomX, zoomY, 4);
  viewport.offset = {
    x: aabb.minX - (width / viewport.zoom - contentW) / 2,
    y: aabb.minY - (height / viewport.zoom - contentH) / 2,
  };
}

export function getPages(document: DocumentStore): Page[] {
  return document.getPages();
}

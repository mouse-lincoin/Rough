import type { ID, Vec2 } from '@rough/schema';
import type { SceneGraph } from '../scene/SceneGraph.js';
import { matApply, matInvert } from '../scene/transforms.js';

export interface CommentAnchorInput {
  elementId: ID | null;
  worldX: number;
  worldY: number;
}

export interface CommentAnchorDegrade {
  id: ID;
  elementId: null;
  worldX: number;
  worldY: number;
}

export interface CommentPinAnchor extends CommentAnchorInput {
  id: ID;
}

export function worldToElementLocal(
  sceneGraph: SceneGraph,
  elementId: ID,
  world: Vec2,
): Vec2 | null {
  const node = sceneGraph.getNode(elementId);
  if (!node) return null;
  const inv = matInvert(node.worldMatrix);
  if (!inv) return null;
  return matApply(inv, world);
}

export function resolveCommentAnchorWorld(
  sceneGraph: SceneGraph,
  anchor: CommentAnchorInput,
): Vec2 {
  if (!anchor.elementId) {
    return { x: anchor.worldX, y: anchor.worldY };
  }
  const node = sceneGraph.getNode(anchor.elementId);
  if (!node) {
    // Orphan elementId: coords may be legacy element-local values (see §8.10 degrade on delete).
    return { x: anchor.worldX, y: anchor.worldY };
  }
  return matApply(node.worldMatrix, { x: anchor.worldX, y: anchor.worldY });
}

/** Convert element-bound anchors to fixed world positions when their elements are removed. */
export function computeAnchorDegradations(
  sceneGraph: SceneGraph,
  pins: CommentPinAnchor[],
  deletedElementIds: ReadonlySet<ID>,
): CommentAnchorDegrade[] {
  const degradations: CommentAnchorDegrade[] = [];
  for (const pin of pins) {
    if (!pin.elementId || !deletedElementIds.has(pin.elementId)) continue;
    const world = resolveCommentAnchorWorld(sceneGraph, pin);
    degradations.push({
      id: pin.id,
      elementId: null,
      worldX: world.x,
      worldY: world.y,
    });
  }
  return degradations;
}

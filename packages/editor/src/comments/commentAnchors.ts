import type { ID, Vec2 } from '@rough/schema';
import type { SceneGraph } from '../scene/SceneGraph.js';
import { matApply, matInvert } from '../scene/transforms.js';

export interface CommentAnchorInput {
  elementId: ID | null;
  worldX: number;
  worldY: number;
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
    return { x: anchor.worldX, y: anchor.worldY };
  }
  return matApply(node.worldMatrix, { x: anchor.worldX, y: anchor.worldY });
}

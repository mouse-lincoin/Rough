import type { ID, Vec2 } from '@rough/schema';
import type { SceneGraph } from '../scene/SceneGraph.js';
import { matApply, matInvert } from '../scene/transforms.js';
import { hitTestPoint } from './hitTest.js';

/** Find deepest frame under world point for nesting new elements */
export function findParentFrameAt(
  sceneGraph: SceneGraph,
  world: Vec2,
  zoom: number,
): ID | null {
  const hit = hitTestPoint(sceneGraph, world, zoom);
  if (!hit) return null;
  if (hit.element.type === 'frame') return hit.element.id;
  let node = hit.parent;
  while (node) {
    if (node.element.type === 'frame') return node.element.id;
    node = node.parent;
  }
  return null;
}

export function worldToParentLocal(
  sceneGraph: SceneGraph,
  parentId: ID | null,
  world: Vec2,
): Vec2 {
  if (!parentId) return { ...world };
  const parent = sceneGraph.getNode(parentId);
  if (!parent) return { ...world };
  const inv = matInvert(parent.worldMatrix);
  if (!inv) return { ...world };
  return matApply(inv, world);
}

import type { Element, ID, RGBA } from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import { getWorldAABB } from '../scene/bounds.js';
import { Renderer } from '../render/Renderer.js';
import { Viewport } from '../render/viewport.js';
import type { ImageCache } from '../render/imageCache.js';

export interface OffscreenRenderInput {
  elements: Record<ID, Element>;
  components: Record<ID, import('@rough/schema').ComponentDef>;
  rootIds: ID[];
  background: RGBA;
  scale: 1 | 2 | 4;
  cleanMode: boolean;
  imageCache: ImageCache;
}

export async function renderRootsToPngBlobs(
  input: OffscreenRenderInput,
): Promise<{ name: string; blob: Blob }[]> {
  const results: { name: string; blob: Blob }[] = [];

  const sceneGraph = new SceneGraph();
  sceneGraph.rebuild(input.elements, input.components);

  for (const rootId of input.rootIds) {
    const root = input.elements[rootId];
    const node = sceneGraph.getNode(rootId);
    if (!root || !node) continue;

    const aabb = getWorldAABB(node);
    const width = Math.max(1, aabb.maxX - aabb.minX);
    const height = Math.max(1, aabb.maxY - aabb.minY);
    const bounds = { minX: aabb.minX, minY: aabb.minY };
    const canvas = document.createElement('canvas');
    const dpr = input.scale;
    canvas.width = Math.max(1, Math.ceil(width * dpr));
    canvas.height = Math.max(1, Math.ceil(height * dpr));

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const viewport = new Viewport();
    viewport.offset = { x: bounds.minX, y: bounds.minY };
    viewport.zoom = 1;

    const renderer = new Renderer();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderer.renderMain(
      ctx,
      sceneGraph,
      viewport,
      width,
      height,
      input.background,
      input.cleanMode,
      new Set(),
      input.imageCache,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png');
    });
    if (blob) {
      results.push({ name: root.name || root.id, blob });
    }
  }

  return results;
}

import type { Element, ID, RGBA } from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import { getWorldAABB, mergeAABB } from '../scene/bounds.js';
import { Renderer } from '../render/Renderer.js';
import { Viewport } from '../render/viewport.js';
import type { ImageCache } from '../render/imageCache.js';

const THUMB_SIZE = 512;

export interface ThumbnailCaptureInput {
  elements: Record<ID, Element>;
  components: Record<ID, import('@rough/schema').ComponentDef>;
  background: RGBA;
  cleanMode: boolean;
  imageCache: ImageCache;
}

export async function capturePageThumbnail(input: ThumbnailCaptureInput): Promise<string | null> {
  const rootIds = Object.values(input.elements)
    .filter((e) => e.parentId === null)
    .map((e) => e.id);
  if (rootIds.length === 0) return null;

  const sceneGraph = new SceneGraph();
  sceneGraph.rebuild(input.elements, input.components);

  let bounds = getWorldAABB(sceneGraph.getNode(rootIds[0]!)!);
  for (let i = 1; i < rootIds.length; i++) {
    const node = sceneGraph.getNode(rootIds[i]!);
    if (node) bounds = mergeAABB(bounds, getWorldAABB(node));
  }

  const worldW = Math.max(1, bounds.maxX - bounds.minX);
  const worldH = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(THUMB_SIZE / worldW, THUMB_SIZE / worldH, 2);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(worldW * scale));
  canvas.height = Math.max(1, Math.round(worldH * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const viewport = new Viewport();
  viewport.offset = { x: bounds.minX, y: bounds.minY };
  viewport.zoom = scale;

  const renderer = new Renderer();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  renderer.renderMain(
    ctx,
    sceneGraph,
    viewport,
    worldW,
    worldH,
    input.background,
    input.cleanMode,
    new Set(),
    input.imageCache,
  );

  return canvas.toDataURL('image/png');
}

import type { SceneNode } from '../../scene/SceneNode.js';
import type { ImageCache } from '../imageCache.js';
import { renderRectangle } from './rectangle.js';
import { renderEllipse } from './ellipse.js';
import { renderLine } from './line.js';
import { renderPath } from './path.js';
import { renderText } from './text.js';
import { renderImage } from './image.js';

export function renderShape(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
  imageCache?: ImageCache,
): void {
  const type = node.element.type;
  switch (type) {
    case 'rectangle':
      renderRectangle(ctx, node, forceClean);
      break;
    case 'ellipse':
      renderEllipse(ctx, node, forceClean);
      break;
    case 'line':
      renderLine(ctx, node, forceClean);
      break;
    case 'path':
      renderPath(ctx, node, forceClean);
      break;
    case 'text':
      renderText(ctx, node);
      break;
    case 'image':
      if (imageCache) renderImage(ctx, node, imageCache);
      break;
    default:
      break;
  }
}

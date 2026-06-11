import type { SceneNode } from '../../scene/SceneNode.js';
import { renderRectangle } from './rectangle.js';
import { renderEllipse } from './ellipse.js';
import { renderLine } from './line.js';
import { renderPath } from './path.js';

export function renderShape(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  forceClean: boolean,
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
    default:
      break;
  }
}

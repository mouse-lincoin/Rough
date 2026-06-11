import type { TextElement } from '@rough/schema';
import type { SceneNode } from '../../scene/SceneNode.js';
import { measureTextLayout } from '../../text/textMeasure.js';
import { applyOpacity } from './utils.js';

export function renderText(ctx: CanvasRenderingContext2D, node: SceneNode): void {
  const el = node.element as TextElement;
  const style = el.textStyle;
  const maxWidth =
    el.autoSize === 'auto-width' ? null : el.width;
  const layout = measureTextLayout(el.text, style, maxWidth);
  const lineHeight = style.fontSize * style.lineHeight;

  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  ctx.fillStyle = applyOpacity(style.color, el.opacity);
  ctx.textAlign = style.textAlign;
  ctx.textBaseline = 'top';

  if (el.autoSize === 'fixed') {
    ctx.beginPath();
    ctx.rect(0, 0, el.width, el.height);
    ctx.clip();
  }

  layout.lines.forEach((line, i) => {
    let x = 0;
    if (style.textAlign === 'center') x = el.width / 2;
    if (style.textAlign === 'right') x = el.width;
    ctx.fillText(line.text, x, i * lineHeight);
  });
}

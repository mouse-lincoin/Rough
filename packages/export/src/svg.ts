import type { ComponentDef, Element, FrameElement, ID, TextElement } from '@rough/schema';
import { rgbaToCss } from '@rough/shared';
import rough from 'roughjs/bin/rough';
import type { Drawable } from 'roughjs/bin/core';
import { computeSubtreeBounds, boundsToSize } from './bounds.js';
import { expandAllInstances } from './instanceExpand.js';
import { getDirectChildren } from './scope.js';

export type ImageDataResolver = (assetId: ID) => Promise<string | null>;

interface SvgContext {
  elements: Record<ID, Element>;
  imageResolver?: ImageDataResolver;
  defs: string[];
  body: string[];
}

export async function exportToSvg(
  elements: Record<ID, Element>,
  rootIds: ID[],
  components: Record<ID, ComponentDef>,
  imageResolver?: ImageDataResolver,
): Promise<string> {
  const expanded = expandAllInstances(elements, components);
  const parts: string[] = [];

  for (const rootId of rootIds) {
    const root = expanded[rootId];
    if (!root) continue;
    const bounds = computeSubtreeBounds(expanded, rootId);
    const { width, height } = boundsToSize(bounds);
    const ctx: SvgContext = { elements: expanded, imageResolver, defs: [], body: [] };
    await renderNode(ctx, rootId, -bounds.minX, -bounds.minY);
    const defs = ctx.defs.length > 0 ? `<defs>${ctx.defs.join('')}</defs>` : '';
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defs}${ctx.body.join('')}</svg>`,
    );
  }

  return parts.join('\n');
}

async function renderNode(
  ctx: SvgContext,
  id: ID,
  offsetX: number,
  offsetY: number,
): Promise<void> {
  const el = ctx.elements[id];
  if (!el || !el.visible) return;

  const x = el.x + offsetX;
  const y = el.y + offsetY;
  const transform =
    el.rotation !== 0
      ? ` transform="translate(${x + el.width / 2},${y + el.height / 2}) rotate(${el.rotation}) translate(${-el.width / 2},${-el.height / 2})"`
      : ` transform="translate(${x},${y})"`;

  if (el.type === 'frame') {
    const frame = el as FrameElement;
    if (frame.background) {
      ctx.body.push(
        `<rect width="${frame.width}" height="${frame.height}" fill="${rgbaToCss(frame.background)}"${transform}/>`,
      );
    }
    const children = getDirectChildren(ctx.elements, id);
    for (const child of children) {
      await renderNode(ctx, child.id, offsetX, offsetY);
    }
    return;
  }

  if (el.type === 'group' || el.type === 'instance') {
    const children = getDirectChildren(ctx.elements, id);
    for (const child of children) {
      await renderNode(ctx, child.id, offsetX, offsetY);
    }
    return;
  }

  if (el.type === 'text') {
    const text = el as TextElement;
    const style = text.textStyle;
    ctx.body.push(
      `<text x="${x}" y="${y + style.fontSize}" font-family="${escapeXml(style.fontFamily)}" font-size="${style.fontSize}" font-weight="${style.fontWeight}" fill="${rgbaToCss(style.color)}" opacity="${text.opacity}">${escapeXml(text.text)}</text>`,
    );
    return;
  }

  if (el.type === 'image') {
    const href = ctx.imageResolver ? await ctx.imageResolver(el.assetId) : null;
    if (href) {
      ctx.body.push(
        `<image href="${href}" x="${x}" y="${y}" width="${el.width}" height="${el.height}" opacity="${el.opacity}"/>`,
      );
    } else {
      ctx.body.push(
        `<rect x="${x}" y="${y}" width="${el.width}" height="${el.height}" fill="#eee" stroke="#ccc"${transform}/>`,
      );
    }
    return;
  }

  if (el.type === 'line') {
    const [p0, p1] = el.points;
    const stroke = el.strokes[0];
    ctx.body.push(
      `<line x1="${x + p0.x}" y1="${y + p0.y}" x2="${x + p1.x}" y2="${y + p1.y}" stroke="${stroke ? rgbaToCss(stroke.color) : '#1a1a1a'}" stroke-width="${stroke?.width ?? 2}" opacity="${el.opacity}"/>`,
    );
    return;
  }

  const fill = solidFill(el.fills);
  const stroke = el.strokes[0];

  if (el.roughness > 0) {
    const paths = roughPaths(el);
    for (const d of paths) {
      ctx.body.push(
        `<path d="${d}" fill="${fill ?? 'none'}" stroke="${stroke ? rgbaToCss(stroke.color) : 'none'}" stroke-width="${stroke?.width ?? 2}" opacity="${el.opacity}"${transform}/>`,
      );
    }
    return;
  }

  if (el.type === 'ellipse') {
    ctx.body.push(
      `<ellipse cx="${el.width / 2}" cy="${el.height / 2}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${fill ?? 'none'}" stroke="${stroke ? rgbaToCss(stroke.color) : 'none'}" stroke-width="${stroke?.width ?? 2}" opacity="${el.opacity}"${transform}/>`,
    );
    return;
  }

  const radius = el.type === 'rectangle' ? cornerRadius(el.cornerRadius) : 0;
  if (radius > 0) {
    ctx.body.push(
      `<rect width="${el.width}" height="${el.height}" rx="${radius}" fill="${fill ?? 'none'}" stroke="${stroke ? rgbaToCss(stroke.color) : 'none'}" stroke-width="${stroke?.width ?? 2}" opacity="${el.opacity}"${transform}/>`,
    );
  } else {
    ctx.body.push(
      `<rect width="${el.width}" height="${el.height}" fill="${fill ?? 'none'}" stroke="${stroke ? rgbaToCss(stroke.color) : 'none'}" stroke-width="${stroke?.width ?? 2}" opacity="${el.opacity}"${transform}/>`,
    );
  }
}

function cornerRadius(value: number | [number, number, number, number]): number {
  return Array.isArray(value) ? value[0]! : value;
}

function solidFill(fills: Element['fills']): string | null {
  const solid = fills.find((f) => f.type === 'solid');
  return solid ? rgbaToCss(solid.color) : null;
}

function roughPaths(el: Element): string[] {
  const gen = rough.generator();
  let drawable: Drawable | null = null;
  const w = el.width;
  const h = el.height;
  const options = {
    roughness: el.roughness,
    seed: el.roughSeed,
    strokeWidth: el.strokes[0]?.width ?? 2,
    stroke: el.strokes[0] ? rgbaToCss(el.strokes[0].color) : undefined,
    fill: solidFill(el.fills) ?? undefined,
    fillStyle: el.fills[0]?.type === 'hachure' ? 'hachure' : 'solid',
  };

  if (el.type === 'rectangle') {
    drawable = gen.rectangle(0, 0, w, h, options);
  } else if (el.type === 'ellipse') {
    drawable = gen.ellipse(w / 2, h / 2, w, h, options);
  } else {
    return [];
  }

  return drawableToPaths(drawable);
}

interface RoughOpSet {
  type: string;
  ops: Array<{ op: string; data: number[] }>;
}

function drawableToPaths(drawable: Drawable): string[] {
  const paths: string[] = [];
  for (const raw of drawable.sets) {
    const op = raw as RoughOpSet;
    let d = '';
    for (const item of op.ops) {
      if (item.op === 'move') d += `M ${item.data[0]} ${item.data[1]} `;
      else if (item.op === 'lineTo') d += `L ${item.data[0]} ${item.data[1]} `;
      else if (item.op === 'bcurveTo') {
        d += `C ${item.data[0]} ${item.data[1]} ${item.data[2]} ${item.data[3]} ${item.data[4]} ${item.data[5]} `;
      }
    }
    if (d) paths.push(d.trim());
  }
  return paths;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

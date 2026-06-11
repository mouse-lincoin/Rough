import type { Drawable } from 'roughjs/bin/core';

interface RoughOpSet {
  type: string;
  stroke?: string;
  strokeWidth?: number;
  ops: Array<{ op: string; data: number[] }>;
}

export function drawRoughDrawable(ctx: CanvasRenderingContext2D, drawable: Drawable): void {
  for (const raw of drawable.sets) {
    const op = raw as RoughOpSet;
    ctx.beginPath();
    for (const item of op.ops) {
      if (item.op === 'move') {
        ctx.moveTo(item.data[0], item.data[1]);
      } else if (item.op === 'bcurveTo') {
        ctx.bezierCurveTo(item.data[0], item.data[1], item.data[2], item.data[3], item.data[4], item.data[5]);
      } else if (item.op === 'lineTo') {
        ctx.lineTo(item.data[0], item.data[1]);
      }
    }
    if (op.type === 'fill') {
      ctx.fillStyle = op.stroke ?? '#000';
      ctx.fill();
    } else {
      ctx.strokeStyle = op.stroke ?? '#000';
      ctx.lineWidth = op.strokeWidth ?? 1;
      ctx.stroke();
    }
  }
}

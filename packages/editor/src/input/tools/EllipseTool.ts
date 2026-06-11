import type { Element } from '@rough/schema';
import { createEllipse } from '../../document/elementFactory.js';
import type { EditorContext } from '../../EditorContext.js';
import { AddElementCommand } from '../../commands/ElementCommands.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class EllipseTool implements Tool {
  readonly name = 'ellipse';
  private start: { x: number; y: number } | null = null;
  private preview: Element | null = null;

  constructor(private ctx: EditorContext) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.start = { ...e.world };
    const defaults = this.ctx.getElementDefaults();
    this.preview = createEllipse(e.world.x, e.world.y, 1, 1, defaults);
    this.ctx.document.addElement(this.preview);
    this.ctx.rebuildScene();
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.start || !this.preview) return;
    let w = e.world.x - this.start.x;
    let h = e.world.y - this.start.y;
    let x = this.start.x;
    let y = this.start.y;

    if (e.shiftKey) {
      const size = Math.max(Math.abs(w), Math.abs(h));
      w = w < 0 ? -size : size;
      h = h < 0 ? -size : size;
    }
    if (e.altKey) {
      x = this.start.x - w;
      y = this.start.y - h;
    } else {
      if (w < 0) {
        x = this.start.x + w;
        w = -w;
      }
      if (h < 0) {
        y = this.start.y + h;
        h = -h;
      }
    }

    const updated = createEllipse(x, y, w, h, {
      roughness: this.preview.roughness,
      roughSeed: this.preview.roughSeed,
      sortKey: this.preview.sortKey,
    });
    updated.id = this.preview.id;
    this.preview = updated;
    this.ctx.document.setElement(updated);
    this.ctx.rebuildScene();
  }

  onPointerUp(): void {
    if (!this.preview) return;
    const el = this.preview;
    this.ctx.document.removeElement(el.id);
    if (el.width >= 1 && el.height >= 1) {
      this.ctx.runCommand(new AddElementCommand(this.ctx.document, el));
    } else {
      this.ctx.rebuildScene();
    }
    this.preview = null;
    this.start = null;
    this.ctx.switchTool('select');
  }

  onKeyDown(): boolean {
    return false;
  }

  cancel(): void {
    if (this.preview) {
      this.ctx.document.removeElement(this.preview.id);
      this.ctx.rebuildScene();
    }
    this.preview = null;
    this.start = null;
  }
}

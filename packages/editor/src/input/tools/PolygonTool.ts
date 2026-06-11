import type { Element } from '@rough/schema';
import { createPolygon } from '../../document/elementFactory.js';
import type { EditorContext } from '../../EditorContext.js';
import { AddElementCommand } from '../../commands/ElementCommands.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class PolygonTool implements Tool {
  readonly name = 'polygon';
  private start: { x: number; y: number } | null = null;
  private preview: Element | null = null;
  private sides = 6;

  constructor(private ctx: EditorContext) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.start = { ...e.world };
    const defaults = this.ctx.getElementDefaults();
    this.preview = createPolygon(e.world.x, e.world.y, 1, 1, this.sides, defaults);
    this.ctx.document.addElement(this.preview);
    this.ctx.rebuildScene();
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.start || !this.preview) return;
    const x = Math.min(this.start.x, e.world.x);
    const y = Math.min(this.start.y, e.world.y);
    const w = Math.abs(e.world.x - this.start.x);
    const h = Math.abs(e.world.y - this.start.y);
    const updated = createPolygon(x, y, w, h, this.sides, {
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
    if (el.width > 2 && el.height > 2) {
      this.ctx.runCommand(new AddElementCommand(this.ctx.document, el));
    }
    this.preview = null;
    this.start = null;
    this.ctx.switchTool('select');
  }

  onKeyDown(e: KeyboardEvent): boolean {
    if (e.key >= '3' && e.key <= '9') {
      this.sides = parseInt(e.key, 10);
      return true;
    }
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

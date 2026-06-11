import type { Element } from '@rough/schema';
import { snapAngle } from '@rough/shared';
import { createLine } from '../../document/elementFactory.js';
import type { EditorContext } from '../../EditorContext.js';
import { AddElementCommand } from '../../commands/ElementCommands.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class LineTool implements Tool {
  readonly name = 'line';
  private start: { x: number; y: number } | null = null;
  private preview: Element | null = null;

  constructor(private ctx: EditorContext) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.start = { ...e.world };
    const defaults = this.ctx.getElementDefaults();
    this.preview = createLine(e.world.x, e.world.y, e.world.x, e.world.y, defaults);
    this.ctx.document.addElement(this.preview);
    this.ctx.rebuildScene();
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.start || !this.preview) return;
    let endX = e.world.x;
    let endY = e.world.y;
    if (e.shiftKey) {
      const snapped = snapAngle(endX - this.start.x, endY - this.start.y);
      endX = this.start.x + snapped.x;
      endY = this.start.y + snapped.y;
    }
    const updated = createLine(this.start.x, this.start.y, endX, endY, {
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
    this.ctx.runCommand(new AddElementCommand(this.ctx.document, el));
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

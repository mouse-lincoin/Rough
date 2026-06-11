import type { TextElement } from '@rough/schema';
import { createText } from '../../document/elementFactory.js';
import type { EditorContext } from '../../EditorContext.js';
import { AddElementCommand } from '../../commands/ElementCommands.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class TextTool implements Tool {
  readonly name = 'text';
  private start: { x: number; y: number } | null = null;
  private preview: TextElement | null = null;

  constructor(private ctx: EditorContext) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.start = { ...e.world };
    const defaults = this.ctx.getElementDefaults();
    this.preview = createText(e.world.x, e.world.y, 1, 24, defaults, 'auto-width');
    this.ctx.document.addElement(this.preview);
    this.ctx.rebuildScene();
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.start || !this.preview) return;
    const w = Math.abs(e.world.x - this.start.x);
    const h = Math.abs(e.world.y - this.start.y);
    if (w < 4 && h < 4) return;
    const x = Math.min(this.start.x, e.world.x);
    const y = Math.min(this.start.y, e.world.y);
    const updated = createText(x, y, Math.max(w, 40), Math.max(h, 24), {
      roughness: this.preview.roughness,
      roughSeed: this.preview.roughSeed,
      sortKey: this.preview.sortKey,
    }, 'fixed');
    updated.id = this.preview.id;
    this.preview = updated;
    this.ctx.document.setElementPreview(updated);
    this.ctx.rebuildScene();
  }

  onPointerUp(e: NormalizedPointerEvent): void {
    if (!this.preview) return;
    const el = this.preview;
    this.ctx.document.removeElement(el.id);

    const dragDist = this.start
      ? Math.hypot(e.world.x - this.start.x, e.world.y - this.start.y)
      : 0;

    let finalEl: TextElement;
    if (dragDist < 4) {
      const defaults = this.ctx.getElementDefaults();
      finalEl = createText(e.world.x, e.world.y, 1, 24, defaults, 'auto-width');
    } else {
      finalEl = el;
    }

    this.ctx.runCommand(new AddElementCommand(this.ctx.document, finalEl));
    this.ctx.selection.select([finalEl.id]);
    this.preview = null;
    this.start = null;
    this.ctx.switchTool('select');
    this.ctx.startTextEditing(finalEl);
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

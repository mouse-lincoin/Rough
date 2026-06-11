import type { Element } from '@rough/schema';
import { simplifyPath } from '@rough/shared';
import { createPath } from '../../document/elementFactory.js';
import type { EditorContext } from '../../EditorContext.js';
import { AddElementCommand } from '../../commands/ElementCommands.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class PenTool implements Tool {
  readonly name = 'pen';
  private points: { x: number; y: number }[] = [];
  private preview: Element | null = null;

  constructor(private ctx: EditorContext) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.points = [{ ...e.world }];
    const defaults = this.ctx.getElementDefaults();
    this.preview = createPath(this.points, defaults);
    this.ctx.document.addElement(this.preview);
    this.ctx.rebuildScene();
  }

  onPointerMove(e: NormalizedPointerEvent): void {
    if (!this.preview) return;
    this.points.push({ ...e.world });
    const simplified = simplifyPath(this.points, 1.5);
    const updated = createPath(simplified, {
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
    if (el.type === 'path' && el.points.length >= 2) {
      this.ctx.runCommand(new AddElementCommand(this.ctx.document, el));
    } else {
      this.ctx.rebuildScene();
    }
    this.preview = null;
    this.points = [];
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
    this.points = [];
  }
}

import type { TextElement } from '@rough/schema';
import type { EditorContext } from '../EditorContext.js';
import type { Viewport } from '../render/viewport.js';
import { UpdateElementsCommand } from '../commands/ElementCommands.js';
import { measureTextLayout } from './textMeasure.js';

export class TextEditorOverlay {
  private textarea: HTMLTextAreaElement | null = null;
  private editingId: string | null = null;

  constructor(
    private container: HTMLElement,
    private ctx: EditorContext,
    private viewport: Viewport,
  ) {}

  startEditing(element: TextElement): void {
    this.stopEditing();
    this.editingId = element.id;

    const ta = document.createElement('textarea');
    ta.className = 'rough-text-editor';
    ta.value = element.text;
    ta.spellcheck = false;
    this.styleTextarea(ta, element);
    this.container.appendChild(ta);
    this.textarea = ta;
    ta.focus();
    ta.select();

    const commit = (): void => {
      if (!this.editingId) return;
      const el = this.ctx.document.getElement(this.editingId);
      if (!el || el.type !== 'text') return;
      const layout = measureTextLayout(
        ta.value,
        el.textStyle,
        el.autoSize === 'fixed' || el.autoSize === 'auto-height' ? el.width : null,
      );
      const updated: TextElement = {
        ...el,
        text: ta.value,
        width: el.autoSize === 'auto-width' ? Math.max(layout.width, 1) : el.width,
        height: el.autoSize === 'fixed' ? el.height : Math.max(layout.height, el.textStyle.fontSize),
      };
      this.ctx.runCommand(new UpdateElementsCommand(this.ctx.document, [updated]));
      this.stopEditing();
    };

    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.stopEditing(false);
      }
      e.stopPropagation();
    });
  }

  private styleTextarea(ta: HTMLTextAreaElement, el: TextElement): void {
    const screen = this.viewport.worldToScreen({ x: el.x, y: el.y });
    const zoom = this.viewport.zoom;
    const style = el.textStyle;
    ta.style.position = 'absolute';
    ta.style.left = `${screen.x}px`;
    ta.style.top = `${screen.y}px`;
    ta.style.width = `${el.width * zoom}px`;
    ta.style.minHeight = `${el.height * zoom}px`;
    ta.style.font = `${style.fontWeight} ${style.fontSize * zoom}px/${style.lineHeight} ${style.fontFamily}`;
    ta.style.color = `rgba(${style.color.r},${style.color.g},${style.color.b},${style.color.a})`;
    ta.style.textAlign = style.textAlign;
    ta.style.border = '1px solid #6965DB';
    ta.style.outline = 'none';
    ta.style.resize = 'none';
    ta.style.padding = '0';
    ta.style.margin = '0';
    ta.style.background = 'rgba(255,255,255,0.9)';
    ta.style.zIndex = '10';
  }

  stopEditing(commit = true): void {
    if (this.textarea && !commit) {
      this.textarea.remove();
    }
    if (this.textarea && commit) {
      this.textarea.blur();
      return;
    }
    this.textarea = null;
    this.editingId = null;
  }

  isEditing(): boolean {
    return this.editingId !== null;
  }

  destroy(): void {
    this.stopEditing(false);
    this.textarea?.remove();
  }
}

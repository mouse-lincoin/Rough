import type { EditorContext } from '../../EditorContext.js';
import type { EditorHost } from '../../EditorContext.js';
import type { NormalizedPointerEvent } from '../../types.js';
import type { Tool } from './BaseTool.js';

export class CommentTool implements Tool {
  readonly name = 'comment';

  constructor(
    _ctx: EditorContext,
    private host: EditorHost & { placeComment: (x: number, y: number) => void },
  ) {}

  onPointerDown(e: NormalizedPointerEvent): void {
    this.host.placeComment(e.world.x, e.world.y);
  }

  onPointerMove(): void {}

  onPointerUp(): void {}

  onKeyDown(): boolean {
    return false;
  }

  cancel(): void {}
}

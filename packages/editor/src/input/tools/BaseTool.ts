import type { NormalizedPointerEvent } from '../../types.js';

export interface Tool {
  readonly name: string;
  onPointerDown(e: NormalizedPointerEvent): void;
  onPointerMove(e: NormalizedPointerEvent): void;
  onPointerUp(e: NormalizedPointerEvent): void;
  onKeyDown(e: KeyboardEvent): boolean;
  cancel(): void;
}

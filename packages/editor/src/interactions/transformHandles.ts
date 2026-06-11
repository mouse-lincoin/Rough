import type { Vec2 } from '@rough/schema';

export type HandleType =
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w'
  | 'rotate';

const HANDLE_SIZE = 8;
const ROTATE_ZONE = 12;

export function getHandlePositions(corners: Vec2[]): Vec2[] {
  const [tl, tr, br, bl] = corners;
  const top = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
  const right = { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 };
  const bottom = { x: (bl.x + br.x) / 2, y: (bl.y + br.y) / 2 };
  const left = { x: (tl.x + bl.x) / 2, y: (tl.y + bl.y) / 2 };
  return [tl, top, tr, right, br, bottom, bl, left];
}

const HANDLE_TYPES: HandleType[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function hitTestHandle(screen: Vec2, corners: Vec2[]): HandleType | null {
  const positions = getHandlePositions(corners);
  const hs = HANDLE_SIZE / 2 + 2;
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (Math.abs(screen.x - p.x) <= hs && Math.abs(screen.y - p.y) <= hs) {
      return HANDLE_TYPES[i];
    }
  }

  for (const corner of corners) {
    const dx = screen.x - corner.x;
    const dy = screen.y - corner.y;
    const dist = Math.hypot(dx, dy);
    if (dist > HANDLE_SIZE && dist < HANDLE_SIZE + ROTATE_ZONE) {
      return 'rotate';
    }
  }
  return null;
}

export function applyResize(
  handle: HandleType,
  startBounds: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  shiftKey: boolean,
  altKey: boolean,
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = startBounds;
  const aspect = width / height || 1;

  const applyH = (left: boolean, right: boolean): void => {
    if (left) {
      x += dx;
      width -= dx;
    }
    if (right) {
      width += dx;
    }
  };
  const applyV = (top: boolean, bottom: boolean): void => {
    if (top) {
      y += dy;
      height -= dy;
    }
    if (bottom) {
      height += dy;
    }
  };

  switch (handle) {
    case 'nw':
      applyH(true, false);
      applyV(true, false);
      break;
    case 'n':
      applyV(true, false);
      break;
    case 'ne':
      applyH(false, true);
      applyV(true, false);
      break;
    case 'e':
      applyH(false, true);
      break;
    case 'se':
      applyH(false, true);
      applyV(false, true);
      break;
    case 's':
      applyV(false, true);
      break;
    case 'sw':
      applyH(true, false);
      applyV(false, true);
      break;
    case 'w':
      applyH(true, false);
      break;
    default:
      break;
  }

  if (shiftKey && handle !== 'n' && handle !== 's' && handle !== 'e' && handle !== 'w') {
    if (width / height > aspect) {
      width = height * aspect;
    } else {
      height = width / aspect;
    }
  }

  if (altKey) {
    const cx = startBounds.x + startBounds.width / 2;
    const cy = startBounds.y + startBounds.height / 2;
    width = Math.max(Math.abs(width), 1);
    height = Math.max(Math.abs(height), 1);
    x = cx - width / 2;
    y = cy - height / 2;
  }

  width = Math.max(width, 1);
  height = Math.max(height, 1);

  return { x, y, width, height };
}

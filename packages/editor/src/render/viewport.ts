import type { Vec2 } from '@rough/schema';
import { clamp } from '@rough/shared';

export class Viewport {
  offset: Vec2 = { x: 0, y: 0 };
  zoom = 1;

  worldToScreen(world: Vec2): Vec2 {
    return {
      x: (world.x - this.offset.x) * this.zoom,
      y: (world.y - this.offset.y) * this.zoom,
    };
  }

  screenToWorld(screen: Vec2): Vec2 {
    return {
      x: screen.x / this.zoom + this.offset.x,
      y: screen.y / this.zoom + this.offset.y,
    };
  }

  pan(dx: number, dy: number): void {
    this.offset.x -= dx / this.zoom;
    this.offset.y -= dy / this.zoom;
  }

  zoomAt(screenPoint: Vec2, factor: number, minZoom = 0.1, maxZoom = 8): void {
    const newZoom = clamp(this.zoom * factor, minZoom, maxZoom);
    const worldBefore = this.screenToWorld(screenPoint);
    this.zoom = newZoom;
    const worldAfter = this.screenToWorld(screenPoint);
    this.offset.x += worldBefore.x - worldAfter.x;
    this.offset.y += worldBefore.y - worldAfter.y;
  }

  getWorldBounds(screenWidth: number, screenHeight: number): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    const topLeft = this.screenToWorld({ x: 0, y: 0 });
    const bottomRight = this.screenToWorld({ x: screenWidth, y: screenHeight });
    return {
      minX: topLeft.x,
      minY: topLeft.y,
      maxX: bottomRight.x,
      maxY: bottomRight.y,
    };
  }
}

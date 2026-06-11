import type { Element } from '@rough/schema';
import type { Mat2D } from './transforms.js';

export class SceneNode {
  element: Element;
  parent: SceneNode | null = null;
  children: SceneNode[] = [];
  worldMatrix: Mat2D = [1, 0, 0, 1, 0, 0];
  matrixDirty = true;

  constructor(element: Element) {
    this.element = element;
  }
}

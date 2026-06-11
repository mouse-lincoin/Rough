import type { Element } from '@rough/schema';
import type { Mat2D } from './transforms.js';
import type { ShadowMeta } from '../components/instanceExpansion.js';

export class SceneNode {
  element: Element;
  parent: SceneNode | null = null;
  children: SceneNode[] = [];
  worldMatrix: Mat2D = [1, 0, 0, 1, 0, 0];
  matrixDirty = true;
  shadowMeta: ShadowMeta | null = null;
  isShadow = false;

  constructor(element: Element, shadowMeta: ShadowMeta | null = null) {
    this.element = element;
    this.shadowMeta = shadowMeta;
    this.isShadow = shadowMeta !== null;
  }
}

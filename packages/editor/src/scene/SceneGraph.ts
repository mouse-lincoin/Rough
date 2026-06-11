import type { ComponentDef, Element, ID } from '@rough/schema';
import { expandAllInstances } from '../components/instanceExpansion.js';
import { elementLocalMatrix, matMultiply, type Mat2D } from './transforms.js';
import { SceneNode } from './SceneNode.js';
import type { ShadowMeta } from '../components/instanceExpansion.js';

export class SceneGraph {
  private nodes = new Map<ID, SceneNode>();
  roots: SceneNode[] = [];
  shadowMeta = new Map<ID, ShadowMeta>();

  rebuild(
    elements: Record<ID, Element>,
    components: Record<ID, ComponentDef> = {},
  ): void {
    this.nodes.clear();
    this.roots = [];
    this.shadowMeta.clear();

    const { expandedElements, shadowMeta } = expandAllInstances(elements, components);
    this.shadowMeta = shadowMeta;

    for (const el of Object.values(expandedElements)) {
      const meta = shadowMeta.get(el.id) ?? null;
      this.nodes.set(el.id, new SceneNode({ ...el }, meta));
    }

    for (const node of this.nodes.values()) {
      const parentId = node.element.parentId;
      if (parentId && this.nodes.has(parentId)) {
        const parent = this.nodes.get(parentId)!;
        node.parent = parent;
        parent.children.push(node);
      } else {
        this.roots.push(node);
      }
    }

    const sortFn = (a: SceneNode, b: SceneNode): number => {
      const cmp = a.element.sortKey.localeCompare(b.element.sortKey);
      return cmp !== 0 ? cmp : a.element.id.localeCompare(b.element.id);
    };

    const sortTree = (nodes: SceneNode[]): void => {
      nodes.sort(sortFn);
      for (const n of nodes) sortTree(n.children);
    };
    sortTree(this.roots);

    for (const root of this.roots) {
      this.updateWorldMatrix(root, [1, 0, 0, 1, 0, 0]);
    }
  }

  private updateWorldMatrix(node: SceneNode, parentWorld: Mat2D): void {
    const el = node.element;
    const local = elementLocalMatrix(el.x, el.y, el.width, el.height, el.rotation);
    node.worldMatrix = matMultiply(parentWorld, local);
    node.matrixDirty = false;
    for (const child of node.children) {
      this.updateWorldMatrix(child, node.worldMatrix);
    }
  }

  getNode(id: ID): SceneNode | undefined {
    return this.nodes.get(id);
  }

  getShadowMeta(id: ID): ShadowMeta | undefined {
    return this.shadowMeta.get(id);
  }

  *traverseBottomUp(): Generator<SceneNode> {
    const walk = function* (nodes: SceneNode[]): Generator<SceneNode> {
      const sorted = [...nodes].sort((a, b) => {
        const cmp = a.element.sortKey.localeCompare(b.element.sortKey);
        return cmp !== 0 ? cmp : a.element.id.localeCompare(b.element.id);
      });
      for (const node of sorted) {
        yield* walk(node.children);
        yield node;
      }
    };
    yield* walk(this.roots);
  }

  *traverseTopDown(): Generator<SceneNode> {
    const walk = function* (nodes: SceneNode[]): Generator<SceneNode> {
      const sorted = [...nodes].sort((a, b) => {
        const cmp = b.element.sortKey.localeCompare(a.element.sortKey);
        return cmp !== 0 ? cmp : b.element.id.localeCompare(a.element.id);
      });
      for (const node of sorted) {
        yield* walk(node.children);
        yield node;
      }
    };
    yield* walk(this.roots);
  }
}

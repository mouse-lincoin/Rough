import type { ComponentDef, Element, FrameElement, ID, InstanceElement } from '@rough/schema';
import { createId } from '@rough/shared';
import type { DocumentStore } from '@rough/document';
import type { Command } from '../undo/Command.js';
import { componentHash, remapComponentIds } from '../components/instanceExpansion.js';
import {
  applyLayoutToDocument,
  defaultAutoLayout,
  inferAutoLayoutDirection,
} from '../layout/autoLayout.js';
import { createFrame } from '../document/elementFactory.js';

export function detachInstanceToElements(
  store: DocumentStore,
  instance: InstanceElement,
): Element[] {
  const component = store.getComponent(instance.componentId);
  if (!component) return [];

  const root = component.elements[component.rootId];
  const scaleX = root && root.width > 0 ? instance.width / root.width : 1;
  const scaleY = root && root.height > 0 ? instance.height / root.height : 1;

  const idMap = new Map<ID, ID>();
  for (const innerId of Object.keys(component.elements)) {
    idMap.set(innerId, innerId === component.rootId ? instance.id : createId());
  }

  const detached: Element[] = [];
  for (const [innerId, templateEl] of Object.entries(component.elements)) {
    const override = instance.overrides[innerId];
    let el = structuredClone(templateEl);
    if (override) {
      if (override.text !== undefined && el.type === 'text') el = { ...el, text: override.text };
      if (override.fills) el = { ...el, fills: structuredClone(override.fills) };
      if (override.strokes) el = { ...el, strokes: structuredClone(override.strokes) };
      if (override.visible !== undefined) el = { ...el, visible: override.visible };
      if (override.opacity !== undefined) el = { ...el, opacity: override.opacity };
    }

    const newId = idMap.get(innerId)!;
    detached.push({
      ...el,
      id: newId,
      parentId:
        innerId === component.rootId
          ? instance.parentId
          : templateEl.parentId
            ? (idMap.get(templateEl.parentId) ?? instance.id)
            : instance.parentId,
      x: instance.x + el.x * scaleX,
      y: instance.y + el.y * scaleY,
      width: el.width * scaleX,
      height: el.height * scaleY,
      sortKey: innerId === component.rootId ? instance.sortKey : el.sortKey,
    });
  }

  return detached;
}

function collectSubtree(elements: Record<ID, Element>, rootId: ID): Element[] {
  const result: Element[] = [];
  const walk = (id: ID): void => {
    const el = elements[id];
    if (!el) return;
    result.push(structuredClone(el));
    for (const child of Object.values(elements)) {
      if (child.parentId === id) walk(child.id);
    }
  };
  walk(rootId);
  return result;
}

export class CreateComponentFromSelectionCommand implements Command {
  private inner: CreateComponentCommand | null = null;
  private wrappedFrameId: ID | null = null;
  private beforeTargets: Element[] = [];

  constructor(
    private store: DocumentStore,
    private selectionIds: ID[],
  ) {}

  get instanceId(): ID | null {
    return this.inner?.instanceId ?? null;
  }

  execute(): void {
    const elements = this.store.getElements();
    const targets = this.selectionIds
      .map((id) => elements[id])
      .filter((e): e is Element => e !== undefined);
    if (targets.length === 0) return;

    this.beforeTargets = targets.map((e) => structuredClone(e));

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of targets) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    const parentId = targets[0].parentId;
    const defaults = {
      roughness: 1,
      roughSeed: Math.floor(Math.random() * 2 ** 31),
      sortKey: this.store.getNextSortKey(parentId),
      parentId,
    };
    const frame = createFrame(minX, minY, maxX - minX, maxY - minY, defaults);
    frame.name = '组件';
    this.wrappedFrameId = frame.id;

    const reparented = targets.map((el) => ({
      ...el,
      parentId: frame.id,
      x: el.x - minX,
      y: el.y - minY,
    }));

    this.store.setElement(frame);
    this.store.setElements(reparented);

    this.inner = new CreateComponentCommand(this.store, frame.id);
    this.inner.execute();
  }

  undo(): void {
    this.inner?.undo();
    if (this.wrappedFrameId) this.store.removeElement(this.wrappedFrameId);
    this.store.setElements(this.beforeTargets);
  }
}

export class RemoveComponentCommand implements Command {
  private removedComponent: ComponentDef | null = null;
  private removedInstances: InstanceElement[] = [];
  private detachedElements: Element[] = [];

  constructor(
    private store: DocumentStore,
    private componentId: ID,
  ) {}

  execute(): void {
    const component = this.store.getComponent(this.componentId);
    if (!component) return;
    this.removedComponent = structuredClone(component);

    const instances = Object.values(this.store.getElements()).filter(
      (e): e is InstanceElement => e.type === 'instance' && e.componentId === this.componentId,
    );
    this.removedInstances = instances.map((i) => structuredClone(i));

    const detached: Element[] = [];
    for (const instance of instances) {
      detached.push(...detachInstanceToElements(this.store, instance));
      this.store.removeElement(instance.id);
    }
    if (detached.length > 0) {
      this.store.setElements(detached);
      this.detachedElements = detached;
    }

    this.store.removeComponent(this.componentId);
  }

  undo(): void {
    for (const el of this.detachedElements) {
      if (!this.removedInstances.some((i) => i.id === el.id)) {
        this.store.removeElement(el.id);
      }
    }
    if (this.removedComponent) this.store.setComponent(this.removedComponent);
    for (const instance of this.removedInstances) {
      this.store.setElement(instance);
    }
  }
}

export class CreateComponentCommand implements Command {
  private componentId: ID | null = null;
  instanceId: ID | null = null;
  private removedSubtree: Element[] = [];

  constructor(
    private store: DocumentStore,
    private frameId: ID,
  ) {}

  execute(): void {
    const elements = this.store.getElements();
    const frame = elements[this.frameId];
    if (!frame || frame.type !== 'frame') return;

    const subtree = collectSubtree(elements, frame.id);
    this.removedSubtree = subtree.map((e) => structuredClone(e));

    const componentId = createId();
    this.componentId = componentId;

    const componentElements: Record<ID, Element> = {};
    for (const el of subtree) {
      componentElements[el.id] = {
        ...el,
        parentId: el.id === frame.id ? null : el.parentId,
      };
    }

    const component: ComponentDef = {
      id: componentId,
      name: frame.name || '组件',
      description: '',
      rootId: frame.id,
      elements: componentElements,
      semantic: frame.semantic,
    };

    this.store.setComponent(component);

    const instance: InstanceElement = {
      id: frame.id,
      type: 'instance',
      name: frame.name,
      parentId: frame.parentId,
      sortKey: frame.sortKey,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      rotation: frame.rotation,
      opacity: frame.opacity,
      visible: frame.visible,
      locked: frame.locked,
      fills: frame.fills,
      strokes: frame.strokes,
      effects: frame.effects,
      semantic: frame.semantic,
      roughness: frame.roughness,
      roughSeed: frame.roughSeed,
      componentId,
      overrides: {},
    };

    this.instanceId = instance.id;
    for (const el of subtree) {
      if (el.id !== frame.id) this.store.removeElement(el.id);
    }
    this.store.setElement(instance);
  }

  undo(): void {
    if (this.instanceId) this.store.removeElement(this.instanceId);
    this.store.setElements(this.removedSubtree);
    if (this.componentId) this.store.removeComponent(this.componentId);
  }
}

export class InstantiateComponentCommand implements Command {
  instanceId: ID | null = null;
  private addedComponentId: ID | null = null;

  constructor(
    private store: DocumentStore,
    private source: ComponentDef,
    private x: number,
    private y: number,
    private parentId: ID | null = null,
  ) {}

  execute(): void {
    const components = this.store.getComponents();
    const hash = componentHash(this.source);
    let componentId = this.source.id;
    const existing = Object.values(components).find(
      (c) => c.name === this.source.name && componentHash(c) === hash,
    );
    if (existing) {
      componentId = existing.id;
    } else {
      componentId = createId();
      this.addedComponentId = componentId;
      const remapped = remapComponentIds(this.source, componentId);
      this.store.setComponent(remapped);
    }

    const component = this.store.getComponent(componentId)!;
    const root = component.elements[component.rootId];

    const instance: InstanceElement = {
      id: createId(),
      type: 'instance',
      name: component.name,
      parentId: this.parentId,
      sortKey: this.store.getNextSortKey(this.parentId),
      x: this.x,
      y: this.y,
      width: root?.width ?? 200,
      height: root?.height ?? 100,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fills: [],
      strokes: [],
      effects: [],
      semantic: component.semantic,
      roughness: 1,
      roughSeed: Math.floor(Math.random() * 2 ** 31),
      componentId,
      overrides: {},
    };

    this.instanceId = instance.id;
    this.store.addElement(instance);
  }

  undo(): void {
    if (this.instanceId) this.store.removeElement(this.instanceId);
    if (this.addedComponentId) this.store.removeComponent(this.addedComponentId);
  }
}

export class DetachInstanceCommand implements Command {
  private before: InstanceElement | null = null;
  private detached: Element[] = [];

  constructor(
    private store: DocumentStore,
    private instanceId: ID,
  ) {}

  execute(): void {
    const instance = this.store.getElement(this.instanceId);
    if (!instance || instance.type !== 'instance') return;
    this.before = structuredClone(instance);

    this.detached = detachInstanceToElements(this.store, instance);
    this.store.removeElement(instance.id);
    this.store.setElements(this.detached);
  }

  undo(): void {
    for (const el of this.detached) {
      if (el.id !== this.instanceId) this.store.removeElement(el.id);
    }
    if (this.before) this.store.setElement(this.before);
  }
}

export class UpdateInstanceOverrideCommand implements Command {
  private before: InstanceElement | null = null;

  constructor(
    private store: DocumentStore,
    private instanceId: ID,
    private innerNodeId: ID,
    private patch: Partial<import('@rough/schema').OverridableProps>,
  ) {}

  execute(): void {
    const instance = this.store.getElement(this.instanceId);
    if (!instance || instance.type !== 'instance') return;
    this.before = structuredClone(instance);
    const overrides = { ...instance.overrides };
    overrides[this.innerNodeId] = { ...overrides[this.innerNodeId], ...this.patch };
    this.store.setElement({ ...instance, overrides });
  }

  undo(): void {
    if (this.before) this.store.setElement(this.before);
  }
}

export class ApplyAutoLayoutCommand implements Command {
  private before: Element[] = [];
  private after: Element[] = [];

  constructor(
    private store: DocumentStore,
    private targetIds: ID[],
  ) {}

  execute(): void {
    const elements = this.store.getElements();
    const targets = this.targetIds
      .map((id) => elements[id])
      .filter((e): e is Element => e !== undefined);

    if (targets.length === 0) return;

    let frame: FrameElement;
    const toUpdate: Element[] = [];

    if (targets.length === 1 && targets[0].type === 'frame') {
      frame = { ...targets[0] };
      if (!frame.autoLayout) {
        frame.autoLayout = defaultAutoLayout('horizontal');
        toUpdate.push(frame);
      }
    } else {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const el of targets) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
      }
      const parentId = targets[0].parentId;
      const direction = inferAutoLayoutDirection(targets);
      const defaults = {
        roughness: 1,
        roughSeed: Math.floor(Math.random() * 2 ** 31),
        sortKey: this.store.getNextSortKey(parentId),
        parentId,
      };
      frame = createFrame(minX, minY, maxX - minX, maxY - minY, defaults);
      frame.autoLayout = defaultAutoLayout(direction);
      frame.name = 'Auto Layout';
      toUpdate.push(frame);

      for (const el of targets) {
        toUpdate.push({
          ...el,
          parentId: frame.id,
          x: el.x - minX,
          y: el.y - minY,
        });
      }
    }

    this.before = [...targets, ...toUpdate].map((e) => structuredClone(elements[e.id] ?? e));

    const merged = { ...elements };
    for (const el of toUpdate) merged[el.id] = el;

    const layoutUpdates = applyLayoutToDocument(merged);
    for (const el of layoutUpdates) merged[el.id] = el;

    this.after = [...toUpdate, ...layoutUpdates];
    const unique = new Map<ID, Element>();
    for (const el of this.after) unique.set(el.id, el);
    this.after = [...unique.values()];

    this.store.setElements(this.after);
  }

  undo(): void {
    const ids = new Set(this.after.map((e) => e.id));
    for (const id of ids) {
      if (!this.before.find((b) => b.id === id)) {
        this.store.removeElement(id);
      }
    }
    this.store.setElements(this.before.filter((b) => this.store.getElement(b.id) || ids.has(b.id)));
  }
}

export class UpdateComponentCommand implements Command {
  private before: ComponentDef | null = null;

  constructor(
    private store: DocumentStore,
    private componentId: ID,
    private elements: Element[],
  ) {}

  execute(): void {
    const component = this.store.getComponent(this.componentId);
    if (!component) return;
    this.before = structuredClone(component);

    const elementsRecord = { ...component.elements };
    for (const el of this.elements) {
      elementsRecord[el.id] = el;
    }

    this.store.setComponent({ ...component, elements: elementsRecord });
  }

  undo(): void {
    if (this.before) this.store.setComponent(this.before);
  }
}

import type {
  ComponentDef,
  Element,
  ID,
  InstanceElement,
  OverridableProps,
  TextElement,
} from '@rough/schema';

export const SHADOW_SEP = '__';

export function shadowId(instanceId: ID, innerNodeId: ID): ID {
  return `${instanceId}${SHADOW_SEP}${innerNodeId}`;
}

export function parseShadowId(id: ID): { instanceId: ID; innerNodeId: ID } | null {
  const idx = id.indexOf(SHADOW_SEP);
  if (idx < 0) return null;
  return { instanceId: id.slice(0, idx), innerNodeId: id.slice(idx + SHADOW_SEP.length) };
}

export interface ShadowMeta {
  instanceId: ID;
  innerNodeId: ID;
  componentId: ID;
}

function mergeOverride(el: Element, override: Partial<OverridableProps>): Element {
  const merged = { ...el } as Element;
  if (override.text !== undefined && merged.type === 'text') {
    (merged as TextElement).text = override.text;
  }
  if (override.fills !== undefined) merged.fills = structuredClone(override.fills);
  if (override.strokes !== undefined) merged.strokes = structuredClone(override.strokes);
  if (override.visible !== undefined) merged.visible = override.visible;
  if (override.opacity !== undefined) merged.opacity = override.opacity;
  return merged;
}

export function expandInstance(
  instance: InstanceElement,
  component: ComponentDef,
): { elements: Record<ID, Element>; shadowMeta: Map<ID, ShadowMeta> } {
  const shadowMeta = new Map<ID, ShadowMeta>();
  const elements: Record<ID, Element> = {};
  const root = component.elements[component.rootId];
  if (!root) return { elements, shadowMeta };

  const scaleX = root.width > 0 ? instance.width / root.width : 1;
  const scaleY = root.height > 0 ? instance.height / root.height : 1;

  for (const [innerId, templateEl] of Object.entries(component.elements)) {
    const override = instance.overrides[innerId];
    const merged = override ? mergeOverride(templateEl, override) : templateClone(templateEl);
    const sid = shadowId(instance.id, innerId);

    const parentShadowId =
      templateEl.parentId === null
        ? instance.id
        : shadowId(instance.id, templateEl.parentId);

    elements[sid] = {
      ...merged,
      id: sid,
      parentId: parentShadowId,
      x: merged.x * scaleX,
      y: merged.y * scaleY,
      width: merged.width * scaleX,
      height: merged.height * scaleY,
    };

    shadowMeta.set(sid, {
      instanceId: instance.id,
      innerNodeId: innerId,
      componentId: instance.componentId,
    });
  }

  return { elements, shadowMeta };
}

function templateClone(el: Element): Element {
  return structuredClone(el);
}

export function expandAllInstances(
  pageElements: Record<ID, Element>,
  components: Record<ID, ComponentDef>,
): {
  expandedElements: Record<ID, Element>;
  shadowMeta: Map<ID, ShadowMeta>;
} {
  const expandedElements = { ...pageElements };
  const shadowMeta = new Map<ID, ShadowMeta>();

  for (const el of Object.values(pageElements)) {
    if (el.type !== 'instance') continue;
    const component = components[el.componentId];
    if (!component) continue;
    const { elements: shadows, shadowMeta: meta } = expandInstance(el, component);
    Object.assign(expandedElements, shadows);
    for (const [k, v] of meta) shadowMeta.set(k, v);
  }

  return { expandedElements, shadowMeta };
}

/** Apply component template updates while preserving instance overrides */
export function mergeComponentWithOverrides(
  instance: InstanceElement,
  component: ComponentDef,
): Record<ID, Element> {
  const { elements } = expandInstance(instance, component);
  return elements;
}

export function remapComponentIds(
  def: ComponentDef,
  newComponentId: ID,
): ComponentDef {
  const idMap = new Map<ID, ID>();
  for (const oldId of Object.keys(def.elements)) {
    idMap.set(oldId, `${newComponentId}_${oldId.slice(-8)}`);
  }

  const elements: Record<ID, Element> = {};
  for (const [oldId, el] of Object.entries(def.elements)) {
    const newId = idMap.get(oldId)!;
    elements[newId] = {
      ...structuredClone(el),
      id: newId,
      parentId: el.parentId ? (idMap.get(el.parentId) ?? null) : null,
    };
  }

  return {
    ...def,
    id: newComponentId,
    rootId: idMap.get(def.rootId) ?? def.rootId,
    elements,
  };
}

const OVERRIDABLE_PATCH_KEYS = new Set(['text', 'fills', 'strokes', 'visible', 'opacity']);

export function getBlockedOverrideKeys(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).filter((key) => !OVERRIDABLE_PATCH_KEYS.has(key));
}

export function componentHash(def: ComponentDef): string {
  const payload = JSON.stringify({ name: def.name, elements: def.elements });
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

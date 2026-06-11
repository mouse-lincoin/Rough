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
): Record<ID, Element> {
  const elements: Record<ID, Element> = {};
  const root = component.elements[component.rootId];
  if (!root) return elements;

  const scaleX = root.width > 0 ? instance.width / root.width : 1;
  const scaleY = root.height > 0 ? instance.height / root.height : 1;

  for (const [innerId, templateEl] of Object.entries(component.elements)) {
    const override = instance.overrides[innerId];
    const merged = override ? mergeOverride(templateEl, override) : structuredClone(templateEl);
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
  }

  return elements;
}

export function expandAllInstances(
  pageElements: Record<ID, Element>,
  components: Record<ID, ComponentDef>,
): Record<ID, Element> {
  const expanded = { ...pageElements };
  for (const el of Object.values(pageElements)) {
    if (el.type !== 'instance') continue;
    const component = components[el.componentId];
    if (!component) continue;
    Object.assign(expanded, expandInstance(el, component));
  }
  return expanded;
}

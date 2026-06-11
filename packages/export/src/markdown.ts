import type {
  ComponentDef,
  Element,
  FrameElement,
  ID,
  RoughDocument,
  SemanticTag,
  TextElement,
} from '@rough/schema';
import { expandAllInstances } from './instanceExpand.js';
import { getDirectChildren, resolveExportTargets } from './scope.js';

const SEMANTIC_LABELS: Partial<Record<SemanticTag, string>> = {
  navbar: 'NavBar',
  sidebar: 'Sidebar',
  tabs: 'Tabs',
  breadcrumb: 'Breadcrumb',
  button: 'Button',
  input: 'Input',
  select: 'Select',
  switch: 'Switch',
  checkbox: 'Checkbox',
  search: 'Search',
  card: 'Card',
  table: 'Table',
  list: 'List',
  'list-item': 'List item',
  avatar: 'Avatar',
  'image-placeholder': 'Image',
  badge: 'Badge',
  modal: 'Modal',
  toast: 'Toast',
  'empty-state': 'Empty state',
  'chart-line': 'Line chart',
  'chart-bar': 'Bar chart',
  'chart-pie': 'Pie chart',
  heading: 'Heading',
  paragraph: 'Paragraph',
  label: 'Label',
  divider: 'Divider',
  icon: 'Icon',
  annotation: 'Annotation',
  page: 'Page',
};

export function inferMarkdown(
  doc: RoughDocument,
  pageId: ID,
  frameIds?: ID[],
): string {
  const page = doc.pages[pageId];
  if (!page) return '';

  const expanded = expandAllInstances(page.elements, doc.components);
  const targets = frameIds ?? resolveExportTargets(expanded, []);
  if (targets.length === 0) return '';

  const sections = targets.map((frameId) => {
    const frame = expanded[frameId];
    if (!frame || frame.type !== 'frame') return '';
    return renderFrame(frame, page.name, expanded, doc.components);
  });

  return sections.filter(Boolean).join('\n\n');
}

function renderFrame(
  frame: FrameElement,
  pageName: string,
  elements: Record<ID, Element>,
  components: Record<ID, ComponentDef>,
): string {
  const preset =
    frame.preset === 'mobile' ? 'Mobile' : frame.preset === 'desktop' ? 'Desktop' : 'Custom';
  const title = `# Page: ${pageName}(${preset} ${Math.round(frame.width)}×${Math.round(frame.height)})`;
  const annotations: string[] = [];
  const body = renderChildren(frame.id, elements, components, 0, annotations);
  const lines = [title, ...body];
  if (annotations.length > 0) {
    lines.push(`- 标注: ${annotations.join(';')}`);
  }
  return lines.join('\n');
}

function renderChildren(
  parentId: ID,
  elements: Record<ID, Element>,
  components: Record<ID, ComponentDef>,
  depth: number,
  annotations: string[],
): string[] {
  const children = getDirectChildren(elements, parentId).filter((e) => e.visible);
  const rows = clusterRows(children);
  const lines: string[] = [];

  for (const row of rows) {
    for (const el of row) {
      if (el.semantic === 'annotation') {
        const text = collectText(el, elements);
        if (text) annotations.push(text);
        continue;
      }

      const indent = '  '.repeat(depth);
      const line = describeElement(el, elements, components, depth, annotations);
      if (line) lines.push(`${indent}${line}`);
    }
  }

  return lines;
}

function describeElement(
  el: Element,
  elements: Record<ID, Element>,
  components: Record<ID, ComponentDef>,
  depth: number,
  annotations: string[],
): string | null {
  if (el.type === 'instance') {
    const component = components[el.componentId];
    if (component) {
      const shadows = expandAllInstances({ [el.id]: el }, { [component.id]: component });
      const innerChildren = getDirectChildren(shadows, el.id).filter((c) => c.visible);
      return describeSemanticContainer(el, innerChildren, components, depth, annotations, shadows);
    }
  }

  if (el.semantic) {
    const children = getDirectChildren(elements, el.id).filter((c) => c.visible);
    if (isContainer(el) && children.length > 0) {
      return describeSemanticContainer(el, children, components, depth, annotations, elements);
    }
    return formatSemanticLine(el, elements);
  }

  if (isContainer(el)) {
    const childLines = renderChildren(el.id, elements, components, depth + 1, annotations);
    if (childLines.length > 0) {
      const indent = '  '.repeat(depth);
      return [`${indent}- ${el.name}:`, ...childLines.map((l) => `  ${l}`)].join('\n').trim();
    }
  }

  if (el.type === 'text') {
    const text = (el as TextElement).text.trim();
    return text ? `- Text: ${text}` : null;
  }

  if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'frame') {
    return `- Box(${Math.round(el.width)}×${Math.round(el.height)})`;
  }

  return null;
}

function describeSemanticContainer(
  el: Element,
  children: Element[],
  components: Record<ID, ComponentDef>,
  depth: number,
  annotations: string[],
  lookup: Record<ID, Element>,
): string {
  const label = semanticLabel(el.semantic);
  const desc = describeSemanticContent(el, children, lookup);

  if (isContainer(el) && children.some((c) => c.semantic || isContainer(c))) {
    const childLines = renderChildren(el.id, lookup, components, depth + 1, annotations);
    if (childLines.length > 0) {
      return `- ${label}${desc ? `: ${desc}` : ''}:\n${childLines.map((l) => `  ${l}`).join('\n')}`;
    }
  }

  return `- ${label}${desc ? `: ${desc}` : ''}`;
}

function describeSemanticContent(
  el: Element,
  children: Element[],
  lookup: Record<ID, Element>,
): string {
  if (el.semantic === 'tabs') {
    const labels = children
      .filter((c): c is TextElement => c.type === 'text')
      .map((c) => c.text.trim())
      .filter(Boolean);
    if (labels.length > 0) return `[${labels.join(', ')}]`;
  }

  if (el.semantic === 'navbar') {
    const texts = collectTextsFromSubtree(el.id, lookup);
    if (texts.length > 0) return texts.join(', ');
  }

  if (el.semantic === 'list') {
    return '(无限滚动)';
  }

  if (el.semantic === 'card' || el.semantic === 'list-item') {
    const parts = collectTextsFromSubtree(el.id, lookup);
    const placeholders = children
      .filter((c) => c.semantic === 'image-placeholder')
      .map(() => '缩略图占位');
    const combined = [...placeholders, ...parts];
    if (combined.length > 0) return combined.join(' + ');
  }

  const texts = collectTextsFromSubtree(el.id, lookup);
  if (texts.length > 0) return texts.join(', ');

  if (el.type === 'text') return (el as TextElement).text;
  return el.name;
}

function formatSemanticLine(el: Element, lookup: Record<ID, Element>): string {
  const label = semanticLabel(el.semantic);
  const desc = el.type === 'text' ? (el as TextElement).text : collectText(el, lookup);
  return `- ${label}${desc ? `: ${desc}` : ''}`;
}

function semanticLabel(tag: SemanticTag | null): string {
  if (!tag) return 'Box';
  return SEMANTIC_LABELS[tag] ?? tag;
}

function isContainer(el: Element): boolean {
  return el.type === 'frame' || el.type === 'group' || el.type === 'instance';
}

function collectText(el: Element, lookup: Record<ID, Element>): string {
  if (el.type === 'text') return (el as TextElement).text.trim();
  return collectTextsFromSubtree(el.id, lookup).join(', ');
}

function collectTextsFromSubtree(rootId: ID, lookup: Record<ID, Element>): string[] {
  const texts: string[] = [];
  const walk = (id: ID): void => {
    for (const child of getDirectChildren(lookup, id)) {
      if (child.type === 'text') {
        const t = child.text.trim();
        if (t) texts.push(t);
      } else {
        walk(child.id);
      }
    }
  };
  walk(rootId);
  return texts;
}

/** Cluster elements into rows by y-center, then sort by x within each row. */
export function clusterRows(elements: Element[]): Element[][] {
  if (elements.length === 0) return [];
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const heights = sorted.map((e) => e.height).filter((h) => h > 0);
  const medianH =
    heights.length > 0 ? heights.sort((a, b) => a - b)[Math.floor(heights.length / 2)]! : 20;
  const tolerance = medianH * 0.5;

  const rows: Element[][] = [];
  let currentRow: Element[] = [sorted[0]!];
  let rowCenterY = sorted[0]!.y + sorted[0]!.height / 2;

  for (let i = 1; i < sorted.length; i++) {
    const el = sorted[i]!;
    const cy = el.y + el.height / 2;
    if (Math.abs(cy - rowCenterY) <= tolerance) {
      currentRow.push(el);
    } else {
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [el];
      rowCenterY = cy;
    }
  }
  currentRow.sort((a, b) => a.x - b.x);
  rows.push(currentRow);
  return rows;
}

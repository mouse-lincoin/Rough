import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import type { RectangleElement, TextElement } from '@rough/schema';
import { elementToYMap, yMapToElement } from './yjsMapping.js';

const baseRect: RectangleElement = {
  id: 'r1',
  type: 'rectangle',
  name: 'rect',
  parentId: null,
  sortKey: 'a0',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  rotation: 0,
  opacity: 1,
  visible: true,
  locked: false,
  fills: [{ type: 'solid', color: { r: 255, g: 255, b: 255, a: 1 } }],
  strokes: [{ color: { r: 0, g: 0, b: 0, a: 1 }, width: 2, style: 'solid' }],
  effects: [],
  semantic: null,
  roughness: 1,
  roughSeed: 42,
  cornerRadius: 4,
};

const baseText: TextElement = {
  ...baseRect,
  id: 't1',
  type: 'text',
  name: 'text',
  text: 'Hello\nWorld',
  textStyle: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 1.4,
    textAlign: 'left',
    verticalAlign: 'top',
    color: { r: 0, g: 0, b: 0, a: 1 },
  },
  autoSize: 'auto-width',
  fills: [],
};

describe('yjsMapping', () => {
  it('round-trips rectangle element', () => {
    const ydoc = new Y.Doc();
    let ymap!: Y.Map<unknown>;
    ydoc.transact(() => {
      ymap = elementToYMap(baseRect);
      ydoc.getMap('elements').set('r1', ymap);
    });
    const restored = yMapToElement(ymap);
    expect(restored).toEqual(baseRect);
  });

  it('round-trips text element with Y.Text', () => {
    const ydoc = new Y.Doc();
    let ymap!: Y.Map<unknown>;
    ydoc.transact(() => {
      ymap = elementToYMap(baseText);
      ydoc.getMap('elements').set('t1', ymap);
    });
    const restored = yMapToElement(ymap);
    expect(restored).toEqual(baseText);
  });
});

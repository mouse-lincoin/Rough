import { describe, expect, it } from 'vitest';
import { createKitComponent } from '@rough/wireframe-kit';
import type { InstanceElement } from '@rough/schema';
import { SceneGraph } from '../scene/SceneGraph.js';
import { shadowId } from './instanceExpansion.js';

describe('component sync', () => {
  it('master update propagates to instances while overrides persist', () => {
    const navbar = createKitComponent('navbar');
    const logoId = Object.entries(navbar.elements).find(
      ([, e]) => e.type === 'text' && e.text === 'Rough',
    )?.[0];
    expect(logoId).toBeDefined();

    const makeInstance = (id: string, x: number): InstanceElement => ({
      id,
      type: 'instance',
      name: 'Navbar',
      parentId: null,
      sortKey: id,
      x,
      y: 0,
      width: navbar.elements[navbar.rootId].width,
      height: navbar.elements[navbar.rootId].height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fills: [],
      strokes: [],
      effects: [],
      semantic: 'navbar',
      roughness: 1,
      roughSeed: 1,
      componentId: navbar.id,
      overrides: {},
    });

    const inst1 = makeInstance('inst1', 0);
    const inst2 = makeInstance('inst2', 200);
    inst1.overrides[logoId!] = { text: 'CustomNav' };

    const master = structuredClone(navbar);
    (master.elements[logoId!] as import('@rough/schema').TextElement).text = 'Rough v2';

    const pageElements = { inst1, inst2 };
    const graph = new SceneGraph();
    graph.rebuild(pageElements, { [master.id]: master });

    const s1 = graph.getNode(shadowId('inst1', logoId!));
    const s2 = graph.getNode(shadowId('inst2', logoId!));

    expect(s1?.element.type === 'text' ? s1.element.text : '').toBe('CustomNav');
    expect(s2?.element.type === 'text' ? s2.element.text : '').toBe('Rough v2');
  });
});

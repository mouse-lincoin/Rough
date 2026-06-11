import { describe, expect, it } from 'vitest';
import type { FrameElement, RoughDocument, TextElement } from '@rough/schema';
import { clusterRows, inferMarkdown } from './markdown.js';

function text(
  id: string,
  parentId: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  semantic: TextElement['semantic'] = null,
): TextElement {
  return {
    id,
    type: 'text',
    name: id,
    parentId,
    sortKey: id,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: [],
    effects: [],
    semantic,
    roughness: 0,
    roughSeed: 0,
    text: content,
    textStyle: {
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.4,
      textAlign: 'left',
      verticalAlign: 'top',
      color: { r: 0, g: 0, b: 0, a: 1 },
    },
    autoSize: 'auto-width',
  };
}

function frame(id: string, w: number, h: number, preset: FrameElement['preset'] = 'mobile'): FrameElement {
  return {
    id,
    type: 'frame',
    name: '订单列表',
    parentId: null,
    sortKey: id,
    x: 0,
    y: 0,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    fills: [],
    strokes: [],
    effects: [],
    semantic: 'page',
    roughness: 0,
    roughSeed: 0,
    clipsContent: false,
    background: null,
    preset,
    autoLayout: null,
  };
}

describe('clusterRows', () => {
  it('groups elements by y proximity and sorts by x', () => {
    const a = text('a', 'f', 0, 0, 40, 20, 'A');
    const b = text('b', 'f', 60, 2, 40, 20, 'B');
    const c = text('c', 'f', 0, 80, 40, 20, 'C');
    const rows = clusterRows([c, b, a]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.map((e) => e.id)).toEqual(['a', 'b']);
    expect(rows[1]!.map((e) => e.id)).toEqual(['c']);
  });
});

describe('inferMarkdown', () => {
  it('matches PRD E-3 order list structure', () => {
    const f = frame('page', 375, 812);
    const navbar = {
      ...frame('nav', 375, 56, 'mobile'),
      name: 'NavBar',
      parentId: 'page',
      semantic: 'navbar' as const,
      y: 0,
    };
    const navTitle = text('nav-title', 'nav', 60, 16, 120, 24, '我的订单', 'heading');
    const navBack = text('nav-back', 'nav', 16, 16, 32, 24, '返回', 'button');

    const tabs = {
      ...frame('tabs', 375, 40, 'mobile'),
      name: 'Tabs',
      parentId: 'page',
      semantic: 'tabs' as const,
      y: 56,
      height: 40,
    };
    const tab1 = text('t1', 'tabs', 16, 8, 48, 24, '全部', 'label');
    const tab2 = text('t2', 'tabs', 72, 8, 48, 24, '待付款', 'label');
    const tab3 = text('t3', 'tabs', 128, 8, 48, 24, '待发货', 'label');
    const tab4 = text('t4', 'tabs', 184, 8, 48, 24, '已完成', 'label');

    const list = {
      ...frame('list', 375, 600, 'mobile'),
      name: 'List',
      parentId: 'page',
      semantic: 'list' as const,
      y: 96,
      height: 600,
    };
    const card = {
      ...frame('card1', 343, 100, 'mobile'),
      name: 'Card',
      parentId: 'list',
      semantic: 'card' as const,
      x: 16,
      y: 16,
      width: 343,
      height: 100,
    };
    const thumb = {
      ...frame('thumb', 64, 64, 'mobile'),
      name: 'Thumb',
      parentId: 'card1',
      semantic: 'image-placeholder' as const,
      x: 8,
      y: 8,
      width: 64,
      height: 64,
    };
    const product = text('product', 'card1', 80, 16, 160, 24, '商品名', 'label');
    const price = text('price', 'card1', 80, 44, 80, 20, '¥99', 'label');
    const badge = text('badge', 'card1', 260, 16, 60, 20, '待发货', 'badge');

    const note = text('note', 'page', 16, 720, 300, 40, '点击卡片跳转订单详情', 'annotation');
    const note2 = text('note2', 'page', 16, 760, 200, 24, '下拉刷新', 'annotation');

    const elements = {
      [f.id]: f,
      [navbar.id]: navbar,
      [navTitle.id]: navTitle,
      [navBack.id]: navBack,
      [tabs.id]: tabs,
      [tab1.id]: tab1,
      [tab2.id]: tab2,
      [tab3.id]: tab3,
      [tab4.id]: tab4,
      [list.id]: list,
      [card.id]: card,
      [thumb.id]: thumb,
      [product.id]: product,
      [price.id]: price,
      [badge.id]: badge,
      [note.id]: note,
      [note2.id]: note2,
    };

    const doc: RoughDocument = {
      schemaVersion: 1,
      id: 'doc1',
      name: '订单列表',
      pages: {
        p1: { id: 'p1', name: '订单列表', elements, background: { r: 248, g: 248, b: 244, a: 1 } },
      },
      pageOrder: ['p1'],
      components: {},
      assets: {},
    };

    const md = inferMarkdown(doc, 'p1', ['page']);
    expect(md).toContain('# Page: 订单列表(Mobile 375×812)');
    expect(md).toContain('NavBar');
    expect(md).toContain('我的订单');
    expect(md).toContain('Tabs');
    expect(md).toContain('全部');
    expect(md).toContain('待付款');
    expect(md).toContain('List');
    expect(md).toContain('Card');
    expect(md).toContain('商品名');
    expect(md).toContain('标注:');
    expect(md).toContain('点击卡片跳转订单详情');
    expect(md).toContain('下拉刷新');
  });
});

import type { ComponentDef } from '@rough/schema';
import { createId } from '@rough/shared';
import {
  ACCENT,
  FILL_LIGHT,
  SURFACE,
  kitEllipse,
  kitFrame,
  kitLine,
  kitRect,
  kitText,
  makeComponentDef,
} from './builder.js';
import { BORDER, INK, STROKE, TEXT_BODY, TEXT_HEADING, TEXT_SMALL } from './styles.js';

export type KitComponentId =
  | 'navbar'
  | 'sidebar'
  | 'tabs'
  | 'breadcrumb'
  | 'button'
  | 'input'
  | 'select'
  | 'switch'
  | 'checkbox'
  | 'search'
  | 'card'
  | 'table'
  | 'list-item'
  | 'avatar'
  | 'image-placeholder'
  | 'badge'
  | 'modal'
  | 'toast'
  | 'empty-state'
  | 'chart-line'
  | 'chart-bar'
  | 'chart-pie';

function navbar(): ComponentDef {
  const root = kitFrame(createId(), 'Navbar', null, 0, 0, 360, 56, 'navbar');
  const logo = kitText(createId(), 'Logo', root.id, 16, 16, 80, 24, 'Rough', TEXT_HEADING, 'heading');
  const link1 = kitText(createId(), 'Link', root.id, 120, 18, 48, 20, '首页', TEXT_BODY, 'button');
  const link2 = kitText(createId(), 'Link', root.id, 180, 18, 48, 20, '产品', TEXT_BODY, 'button');
  const cta = kitRect(createId(), 'CTA', root.id, 280, 12, 64, 32, ACCENT, 'button');
  const ctaText = kitText(createId(), 'CTA Text', root.id, 292, 18, 40, 20, '登录', { ...TEXT_BODY, color: SURFACE }, 'label');
  return makeComponentDef('Navbar', 'navbar', root, [logo, link1, link2, cta, ctaText]);
}

function sidebar(): ComponentDef {
  const root = kitFrame(createId(), 'Sidebar', null, 0, 0, 200, 400, 'sidebar');
  const items = ['仪表盘', '订单', '设置'].map((label, i) =>
    kitText(createId(), label, root.id, 16, 16 + i * 36, 160, 28, label, TEXT_BODY, 'list-item'),
  );
  return makeComponentDef('Sidebar', 'sidebar', root, items);
}

function tabs(): ComponentDef {
  const root = kitFrame(createId(), 'Tabs', null, 0, 0, 320, 40, 'tabs');
  const t1 = kitText(createId(), 'Tab1', root.id, 8, 10, 60, 20, '概览', TEXT_BODY, 'tabs');
  const t2 = kitText(createId(), 'Tab2', root.id, 80, 10, 60, 20, '详情', TEXT_BODY, 'tabs');
  const line = kitRect(createId(), 'Indicator', root.id, 8, 34, 60, 3, ACCENT);
  return makeComponentDef('Tabs', 'tabs', root, [t1, t2, line]);
}

function breadcrumb(): ComponentDef {
  const root = kitFrame(createId(), 'Breadcrumb', null, 0, 0, 280, 24, 'breadcrumb');
  const t = kitText(createId(), 'Crumb', root.id, 0, 2, 260, 20, '首页 / 订单 / 详情', TEXT_SMALL);
  return makeComponentDef('Breadcrumb', 'breadcrumb', root, [t]);
}

function button(): ComponentDef {
  const root = kitFrame(createId(), 'Button', null, 0, 0, 96, 36, 'button');
  const bg = kitRect(createId(), 'BG', root.id, 0, 0, 96, 36, ACCENT, 'button');
  const label = kitText(createId(), 'Label', root.id, 28, 8, 40, 20, '按钮', { ...TEXT_BODY, color: SURFACE }, 'label');
  return makeComponentDef('Button', 'button', root, [bg, label]);
}

function input(): ComponentDef {
  const root = kitFrame(createId(), 'Input', null, 0, 0, 240, 64, 'input');
  const label = kitText(createId(), 'Label', root.id, 0, 0, 80, 18, '邮箱', TEXT_SMALL, 'label');
  const field = kitRect(createId(), 'Field', root.id, 0, 24, 240, 36, SURFACE, 'input');
  const ph = kitText(createId(), 'Placeholder', root.id, 12, 32, 200, 20, 'name@example.com', { ...TEXT_BODY, color: BORDER }, 'paragraph');
  return makeComponentDef('Input', 'input', root, [label, field, ph]);
}

function select(): ComponentDef {
  const root = kitFrame(createId(), 'Select', null, 0, 0, 200, 36, 'select');
  const field = kitRect(createId(), 'Field', root.id, 0, 0, 200, 36, SURFACE, 'select');
  const val = kitText(createId(), 'Value', root.id, 12, 8, 160, 20, '请选择', TEXT_BODY);
  return makeComponentDef('Select', 'select', root, [field, val]);
}

function switchKit(): ComponentDef {
  const root = kitFrame(createId(), 'Switch', null, 0, 0, 48, 24, 'switch');
  const track = kitRect(createId(), 'Track', root.id, 0, 0, 48, 24, FILL_LIGHT, 'switch');
  const thumb = kitEllipse(createId(), 'Thumb', root.id, 26, 2, 20, ACCENT);
  return makeComponentDef('Switch', 'switch', root, [track, thumb]);
}

function checkbox(): ComponentDef {
  const root = kitFrame(createId(), 'Checkbox', null, 0, 0, 120, 24, 'checkbox');
  const box = kitRect(createId(), 'Box', root.id, 0, 2, 20, 20, SURFACE, 'checkbox');
  const label = kitText(createId(), 'Label', root.id, 28, 2, 80, 20, '记住我', TEXT_BODY, 'label');
  return makeComponentDef('Checkbox', 'checkbox', root, [box, label]);
}

function search(): ComponentDef {
  const root = kitFrame(createId(), 'Search', null, 0, 0, 280, 40, 'search');
  const field = kitRect(createId(), 'Field', root.id, 0, 0, 280, 40, SURFACE, 'search');
  const ph = kitText(createId(), 'Placeholder', root.id, 12, 10, 200, 20, '搜索…', { ...TEXT_BODY, color: BORDER });
  return makeComponentDef('Search', 'search', root, [field, ph]);
}

function card(): ComponentDef {
  const root = kitFrame(createId(), 'Card', null, 0, 0, 280, 160, 'card');
  const bg = kitRect(createId(), 'BG', root.id, 0, 0, 280, 160, SURFACE, 'card');
  const title = kitText(createId(), 'Title', root.id, 16, 16, 200, 24, '卡片标题', TEXT_HEADING, 'heading');
  const body = kitText(createId(), 'Body', root.id, 16, 48, 240, 60, '卡片描述内容占位', TEXT_BODY, 'paragraph');
  return makeComponentDef('Card', 'card', root, [bg, title, body]);
}

function table(): ComponentDef {
  const root = kitFrame(createId(), 'Table', null, 0, 0, 360, 180, 'table');
  const children: ReturnType<typeof kitRect>[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      children.push(
        kitRect(createId(), `Cell ${r}-${c}`, root.id, c * 90, r * 45, 88, 43, r === 0 ? FILL_LIGHT : SURFACE, 'table'),
      );
    }
  }
  const header = kitText(createId(), 'Header', root.id, 8, 12, 80, 20, '列 A', TEXT_SMALL, 'label');
  return makeComponentDef('Table', 'table', root, [...children, header]);
}

function listItem(): ComponentDef {
  const root = kitFrame(createId(), 'List Item', null, 0, 0, 320, 56, 'list-item');
  const av = kitEllipse(createId(), 'Avatar', root.id, 12, 12, 32, FILL_LIGHT);
  const title = kitText(createId(), 'Title', root.id, 56, 12, 200, 20, '列表项标题', TEXT_BODY, 'heading');
  const sub = kitText(createId(), 'Sub', root.id, 56, 32, 200, 16, '副标题', TEXT_SMALL, 'paragraph');
  return makeComponentDef('List Item', 'list-item', root, [av, title, sub]);
}

function avatar(): ComponentDef {
  const root = kitFrame(createId(), 'Avatar', null, 0, 0, 48, 48, 'avatar');
  const circle = kitEllipse(createId(), 'Circle', root.id, 0, 0, 48, FILL_LIGHT);
  return makeComponentDef('Avatar', 'avatar', root, [circle]);
}

function imagePlaceholder(): ComponentDef {
  const root = kitFrame(createId(), 'Image', null, 0, 0, 200, 120, 'image-placeholder');
  const box = kitRect(createId(), 'Box', root.id, 0, 0, 200, 120, FILL_LIGHT, 'image-placeholder');
  const x1 = kitLine(createId(), root.id, 20, 20, 180, 100, { color: BORDER, width: 2, style: 'solid' });
  const x2 = kitLine(createId(), root.id, 180, 20, 20, 100, { color: BORDER, width: 2, style: 'solid' });
  return makeComponentDef('Image Placeholder', 'image-placeholder', root, [box, x1, x2]);
}

function badge(): ComponentDef {
  const root = kitFrame(createId(), 'Badge', null, 0, 0, 48, 22, 'badge');
  const bg = kitRect(createId(), 'BG', root.id, 0, 0, 48, 22, ACCENT, 'badge');
  const t = kitText(createId(), 'Text', root.id, 10, 2, 28, 18, '新', { ...TEXT_SMALL, color: SURFACE }, 'label');
  return makeComponentDef('Badge', 'badge', root, [bg, t]);
}

function modal(): ComponentDef {
  const root = kitFrame(createId(), 'Modal', null, 0, 0, 320, 200, 'modal');
  const bg = kitRect(createId(), 'BG', root.id, 0, 0, 320, 200, SURFACE, 'modal');
  const title = kitText(createId(), 'Title', root.id, 16, 16, 200, 24, '对话框', TEXT_HEADING, 'heading');
  const body = kitText(createId(), 'Body', root.id, 16, 48, 280, 80, '对话框内容占位', TEXT_BODY, 'paragraph');
  const btn = kitRect(createId(), 'OK', root.id, 220, 156, 80, 32, ACCENT, 'button');
  return makeComponentDef('Modal', 'modal', root, [bg, title, body, btn]);
}

function toast(): ComponentDef {
  const root = kitFrame(createId(), 'Toast', null, 0, 0, 280, 48, 'toast');
  const bg = kitRect(createId(), 'BG', root.id, 0, 0, 280, 48, INK, 'toast');
  const t = kitText(createId(), 'Msg', root.id, 16, 14, 240, 20, '操作成功', { ...TEXT_BODY, color: SURFACE });
  return makeComponentDef('Toast', 'toast', root, [bg, t]);
}

function emptyState(): ComponentDef {
  const root = kitFrame(createId(), 'Empty', null, 0, 0, 240, 160, 'empty-state');
  const icon = kitEllipse(createId(), 'Icon', root.id, 96, 16, 48, FILL_LIGHT);
  const t = kitText(createId(), 'Text', root.id, 24, 80, 192, 40, '暂无数据', TEXT_BODY, 'paragraph');
  return makeComponentDef('Empty State', 'empty-state', root, [icon, t]);
}

function chartLine(): ComponentDef {
  const root = kitFrame(createId(), 'Chart Line', null, 0, 0, 280, 160, 'chart-line');
  const bg = kitRect(createId(), 'BG', root.id, 0, 0, 280, 160, SURFACE, 'chart-line');
  const line = kitLine(createId(), root.id, 24, 120, 80, 60, STROKE);
  const line2 = kitLine(createId(), root.id, 80, 60, 160, 90, { ...STROKE, color: ACCENT });
  const line3 = kitLine(createId(), root.id, 160, 90, 256, 40, STROKE);
  return makeComponentDef('Chart Line', 'chart-line', root, [bg, line, line2, line3]);
}

function chartBar(): ComponentDef {
  const root = kitFrame(createId(), 'Chart Bar', null, 0, 0, 280, 160, 'chart-bar');
  const bars = [60, 90, 45, 110].map((h, i) =>
    kitRect(createId(), `Bar ${i}`, root.id, 24 + i * 60, 160 - h, 40, h, i % 2 === 0 ? ACCENT : FILL_LIGHT),
  );
  return makeComponentDef('Chart Bar', 'chart-bar', root, bars);
}

function chartPie(): ComponentDef {
  const root = kitFrame(createId(), 'Chart Pie', null, 0, 0, 160, 160, 'chart-pie');
  const c = kitEllipse(createId(), 'Pie', root.id, 20, 20, 120, SURFACE);
  const slice = kitEllipse(createId(), 'Slice', root.id, 50, 30, 60, ACCENT);
  return makeComponentDef('Chart Pie', 'chart-pie', root, [c, slice]);
}

const FACTORIES: Record<KitComponentId, () => ComponentDef> = {
  navbar,
  sidebar,
  tabs,
  breadcrumb,
  button,
  input,
  select,
  switch: switchKit,
  checkbox,
  search,
  card,
  table,
  'list-item': listItem,
  avatar,
  'image-placeholder': imagePlaceholder,
  badge,
  modal,
  toast,
  'empty-state': emptyState,
  'chart-line': chartLine,
  'chart-bar': chartBar,
  'chart-pie': chartPie,
};

export const KIT_CATEGORIES: { label: string; ids: KitComponentId[] }[] = [
  { label: '导航', ids: ['navbar', 'sidebar', 'tabs', 'breadcrumb'] },
  { label: '表单', ids: ['button', 'input', 'select', 'switch', 'checkbox', 'search'] },
  { label: '内容', ids: ['card', 'table', 'list-item', 'avatar', 'image-placeholder', 'badge'] },
  { label: '反馈', ids: ['modal', 'toast', 'empty-state'] },
  { label: '图表', ids: ['chart-line', 'chart-bar', 'chart-pie'] },
];

export function createKitComponent(id: KitComponentId): ComponentDef {
  return FACTORIES[id]();
}

export function getAllKitComponents(): ComponentDef[] {
  return (Object.keys(FACTORIES) as KitComponentId[]).map((id) => createKitComponent(id));
}

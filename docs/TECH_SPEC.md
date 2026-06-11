# Rough — 技术开发文档(TECH SPEC)

> 本文档是 Rough 的工程实现规格书,目标读者是 **LLM 代码生成器或开发者**。
> 按本文档从上到下实施,即可完成整个产品。文档中所有类型定义、目录结构、算法描述均为规范性约定(normative),生成代码时必须遵守。
>
> 范围说明:本文档在 [PRD](./PRD.md) 基础上扩充,**包含 Figma 的主干功能**(组件与实例、Auto Layout、图层面板、属性面板、多页面、实时协作、评论),但保持 Rough 的定位:手绘风格、键盘优先、导出即输入。与 PRD 冲突之处以本文档为准。

- **状态**:v1.1(Phase 0-7 已实施;实现状态与已知差距见 [附录 B](#附录-b--实现状态与已知差距))
- **配套文档**:[PRD.md](./PRD.md)

---

## 目录

1. [产品功能总览](#1-产品功能总览)
2. [技术选型](#2-技术选型)
3. [系统架构](#3-系统架构)
4. [目录结构](#4-目录结构)
5. [数据模型(核心)](#5-数据模型核心)
6. [渲染引擎](#6-渲染引擎)
7. [交互系统](#7-交互系统)
8. [功能模块详细规格](#8-功能模块详细规格)
9. [实时协作](#9-实时协作)
10. [后端与 API](#10-后端与-api)
11. [持久化与离线](#11-持久化与离线)
12. [性能预算](#12-性能预算)
13. [测试要求](#13-测试要求)
14. [编码规范](#14-编码规范)
15. [分阶段实施指令(给 LLM)](#15-分阶段实施指令给-llm)

---

## 1. 产品功能总览

| 模块 | 功能 | 阶段 |
| --- | --- | --- |
| 画布 | 无限画布、平移缩放、网格、标尺 | P1 |
| 图形 | 矩形、椭圆、多边形、直线、箭头、自由路径(画笔)、图片 | P1 |
| 文本 | 画布内编辑、字号/字重/行高/对齐、自动换行 | P2 |
| Frame | 嵌套容器、预设尺寸、裁剪溢出 | P2 |
| 选择变换 | 单选/多选/框选、8 向缩放、旋转、编组 | P1 |
| 图层面板 | 树形列表、拖拽排序、重命名、锁定、隐藏 | P3 |
| 属性面板 | 位置/尺寸/旋转/圆角/透明度、填充、描边、阴影/模糊 | P3 |
| 对齐 | 智能参考线、吸附、对齐/分布命令 | P3 |
| Auto Layout | 横/纵向流式布局、间距、内边距、hug/fill/fixed | P4 |
| 组件 | 主组件、实例、属性覆盖、跨页面引用 | P4 |
| 线框组件库 | 带语义标签的占位组件(按钮/导航/卡片/表格…) | P4 |
| 多页面 | 页面增删改、切换 | P3 |
| 历史 | 撤销/重做(≥100 步)、命令合并 | P1 |
| 导出 | PNG / SVG / JSON / 结构化 Markdown / AI Prompt | P5 |
| 持久化 | 本地优先(IndexedDB)、自动保存、多文档 | P2 |
| 协作 | 多人实时编辑(CRDT)、在线光标、选区同步 | P6 |
| 评论 | 画布锚点评论、回复、已解决状态 | P6 |
| 分享 | 只读/可编辑链接、GitHub OAuth | P6 |
| 渲染风格 | 手绘模式(rough.js)/ 整洁模式一键切换 | P1 |

---

## 2. 技术选型

| 层 | 选型 | 版本基线 | 说明 |
| --- | --- | --- | --- |
| 语言 | TypeScript(strict) | 5.x | 全仓库,禁止 `any`(见编码规范) |
| 前端框架 | React | 18+ | 仅用于 UI 面板;画布渲染不走 React |
| 构建 | Vite | 5+ | monorepo 下的 app 构建 |
| 画布 | 原生 Canvas 2D 自绘 | — | 不用 Konva/Fabric,保证性能与控制力 |
| 手绘渲染 | roughjs | 4.x | 生成 Drawable 后缓存 |
| 状态 | zustand | 4.x | UI 状态;文档状态走自研 Store(见 §3.2) |
| CRDT | yjs + y-indexeddb + y-websocket | 13.x | 文档数据的唯一事实源 |
| 协作服务 | Hocuspocus(基于 y-websocket) | 2.x | 鉴权钩子 + 持久化钩子 |
| 后端 | Node.js + Fastify | 20 / 4.x | REST API |
| 数据库 | PostgreSQL + Drizzle ORM | 16 / 最新 | 文档元数据、用户、评论 |
| 对象存储 | S3 兼容(MinIO 本地) | — | 文档快照、图片资源、导出产物 |
| 鉴权 | GitHub OAuth + JWT(httpOnly cookie) | — | 匿名可用,登录解锁同步/协作 |
| 单测 | Vitest | 1.x | 核心算法 100% 覆盖目标见 §13 |
| E2E | Playwright | 1.x | 关键用户路径 |
| 代码质量 | ESLint + Prettier | — | CI 强制 |
| Monorepo | pnpm workspaces + turborepo | — | 包拆分见 §4 |

---

## 3. 系统架构

### 3.1 总览

```
┌─────────────────────────────────────────────────────────┐
│ apps/web (React Shell)                                  │
│  ┌───────────┐ ┌───────────┐ ┌────────────┐             │
│  │ LayerPanel│ │ Properties│ │ Toolbar 等  │  ← React    │
│  └─────┬─────┘ └─────┬─────┘ └─────┬──────┘             │
│        └──────────┬──┴─────────────┘                    │
│              EditorContext(zustand: UI state)           │
│                   │                                     │
│  ┌────────────────▼──────────────────────────────┐      │
│  │ packages/editor(命令式内核,无 React 依赖)     │      │
│  │  ToolManager → InputPipeline → Commands        │      │
│  │  SceneGraph(读模型,从 Y.Doc 派生)             │      │
│  │  Renderer(Canvas 2D,RAF 循环)                │      │
│  └────────────────┬──────────────────────────────┘      │
│                   │                                     │
│  ┌────────────────▼──────────────────────────────┐      │
│  │ packages/document(Y.Doc 封装 + Schema)        │      │
│  │  y-indexeddb(本地) y-websocket(协作)        │      │
│  └────────────────┬──────────────────────────────┘      │
└───────────────────┼─────────────────────────────────────┘
                    │ WebSocket / REST
┌───────────────────▼─────────────────────────────────────┐
│ apps/server (Fastify + Hocuspocus)                      │
│  REST: auth / documents / share / comments / assets     │
│  WS:  Yjs sync + awareness                              │
│  PostgreSQL ──── S3(快照、图片)                        │
└─────────────────────────────────────────────────────────┘
```

### 3.2 关键架构决策(必须遵守)

1. **Y.Doc 是文档数据的唯一事实源**。所有文档变更必须通过 `DocumentStore` 的事务 API 写入 Y.Doc;React 面板和 Canvas 渲染器都只是 Y.Doc 的订阅者。本地单机模式 = 只挂 y-indexeddb provider,协作模式 = 再挂 y-websocket provider,**业务代码零修改**。
2. **画布渲染不经过 React**。`packages/editor` 是纯 TS 命令式内核,React 只渲染面板 UI。两者通过 zustand store(UI 状态:当前工具、选中 ID 集、视口)和 DocumentStore 事件通信。
3. **SceneGraph 是派生只读模型**。Y.Doc 变更 → 增量更新 SceneGraph(含缓存的世界变换矩阵、包围盒)→ 标记 dirty → RAF 中重绘。禁止渲染器直接读 Y.Doc。
4. **所有用户操作 = Command**。Command 携带 `do` 语义(对 Y.Doc 的事务),undo/redo 由 `Y.UndoManager`(trackedOrigins = 本地 origin)实现,不自己维护反向操作。
5. **扁平元素表 + 父子 ID 引用 + fractional index 排序**。不存嵌套树,保证 CRDT 合并语义简单。

---

## 4. 目录结构

```
rough/
├── package.json                  # pnpm workspace root
├── turbo.json
├── docs/
│   ├── PRD.md
│   └── TECH_SPEC.md
├── apps/
│   ├── web/                      # 前端应用
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── routes/           # 文件列表页 / 编辑器页 / 分享只读页
│   │       ├── components/
│   │       │   ├── Toolbar/
│   │       │   ├── LayerPanel/
│   │       │   ├── PropertiesPanel/
│   │       │   ├── PagesPanel/
│   │       │   ├── ComponentLibrary/   # 线框组件库面板
│   │       │   ├── CommentLayer/
│   │       │   ├── ExportDialog/
│   │       │   ├── ShareDialog/
│   │       │   └── CanvasHost.tsx      # 挂载 editor 内核的容器
│   │       ├── stores/           # zustand UI stores
│   │       └── styles/
│   └── server/                   # 后端
│       └── src/
│           ├── index.ts
│           ├── auth/             # GitHub OAuth + JWT
│           ├── routes/           # documents / share / comments / assets
│           ├── collab/           # Hocuspocus server + hooks
│           ├── db/               # drizzle schema + migrations
│           └── storage/          # S3 client
├── packages/
│   ├── schema/                   # ★ 类型与 Schema(零依赖,前后端共享)
│   │   └── src/
│   │       ├── elements.ts       # §5 全部类型定义
│   │       ├── styles.ts
│   │       ├── document.ts
│   │       └── version.ts        # schemaVersion + 迁移
│   ├── document/                 # Y.Doc 封装
│   │   └── src/
│   │       ├── DocumentStore.ts  # 事务 API、元素 CRUD、订阅
│   │       ├── yjsMapping.ts     # Element <-> Y.Map 映射
│   │       ├── fractionalIndex.ts
│   │       └── undo.ts
│   ├── editor/                   # ★ 画布内核(无 React)
│   │   └── src/
│   │       ├── Editor.ts         # 入口:组装下面所有子系统
│   │       ├── scene/
│   │       │   ├── SceneGraph.ts
│   │       │   ├── SceneNode.ts
│   │       │   ├── transforms.ts # 矩阵运算
│   │       │   └── bounds.ts     # AABB / OBB
│   │       ├── render/
│   │       │   ├── Renderer.ts   # RAF 主循环、双画布
│   │       │   ├── shapeRenderers/  # 每种元素一个 renderer
│   │       │   ├── roughCache.ts # rough.js Drawable 缓存
│   │       │   ├── overlay.ts    # 选择框、手柄、参考线、协作光标
│   │       │   └── viewport.ts   # 世界<->屏幕坐标
│   │       ├── input/
│   │       │   ├── InputPipeline.ts  # pointer/keyboard 事件归一化
│   │       │   ├── ToolManager.ts
│   │       │   └── tools/        # §7.2 每个工具一个状态机
│   │       ├── interactions/
│   │       │   ├── hitTest.ts
│   │       │   ├── selection.ts
│   │       │   ├── transformHandles.ts
│   │       │   ├── snapping.ts
│   │       │   └── marquee.ts
│   │       ├── layout/
│   │       │   └── autoLayout.ts # §8.6 布局求解器
│   │       ├── text/
│   │       │   ├── textMeasure.ts
│   │       │   └── textEditorOverlay.ts
│   │       └── commands/         # 所有 Command 定义
│   ├── export/                   # 导出器(纯函数,可在 worker 跑)
│   │   └── src/
│   │       ├── png.ts
│   │       ├── svg.ts
│   │       ├── json.ts
│   │       ├── markdown.ts       # 结构化大纲
│   │       └── aiPrompt.ts       # AI Prompt 生成
│   ├── wireframe-kit/            # 线框组件库定义(数据,非代码组件)
│   │   └── src/definitions/*.ts
│   └── shared/                   # 工具函数(id、geometry、color)
└── e2e/                          # Playwright 测试
```

---

## 5. 数据模型(核心)

> 本节类型置于 `packages/schema`。生成代码时**逐字采用**,可补充注释但不得改名、改语义。

### 5.1 基础类型

```ts
export type ID = string; // nanoid(12)

export interface Vec2 { x: number; y: number }

export type RGBA = { r: number; g: number; b: number; a: number }; // 0-255, a: 0-1

export type FractionalIndex = string; // 见 §5.7
```

### 5.2 样式

```ts
export type FillStyle =
  | { type: 'solid'; color: RGBA }
  | { type: 'hachure'; color: RGBA; gap: number; angle: number } // 手绘排线填充
  | { type: 'image'; assetId: ID; mode: 'fill' | 'fit' | 'tile' };

export interface Stroke {
  color: RGBA;
  width: number;             // px(世界坐标)
  style: 'solid' | 'dashed' | 'dotted';
}

export type Effect =
  | { type: 'drop-shadow'; offset: Vec2; blur: number; color: RGBA }
  | { type: 'layer-blur'; radius: number };

export interface TextStyle {
  fontFamily: string;        // 默认 'Rough Sans'(内置手写体)+ 'Inter'
  fontSize: number;
  fontWeight: 400 | 500 | 700;
  lineHeight: number;        // 倍数,默认 1.4
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  color: RGBA;
}
```

### 5.3 元素(Element)

```ts
export type ElementType =
  | 'frame' | 'group' | 'rectangle' | 'ellipse' | 'polygon'
  | 'line' | 'arrow' | 'path' | 'text' | 'image' | 'instance';

export interface BaseElement {
  id: ID;
  type: ElementType;
  name: string;                       // 图层面板显示名
  parentId: ID | null;                // null = 页面根
  sortKey: FractionalIndex;           // 同级排序(越大越靠上层)
  // 几何:x/y 相对父元素左上角;rotation 绕自身中心,弧度
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  opacity: number;                    // 0-1
  visible: boolean;
  locked: boolean;
  fills: FillStyle[];
  strokes: Stroke[];
  effects: Effect[];
  semantic: SemanticTag | null;       // §5.6,导出链路的根基
  roughness: number;                  // 0 = 整洁,1 = 默认糙,2 = 很糙
  roughSeed: number;                  // rough.js 随机种子,创建时固定
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  clipsContent: boolean;              // 默认 true
  background: RGBA | null;
  autoLayout: AutoLayout | null;      // §5.5
  preset: 'mobile' | 'desktop' | 'custom';
}

export interface GroupElement extends BaseElement { type: 'group' }

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  cornerRadius: number | [number, number, number, number];
}

export interface EllipseElement extends BaseElement { type: 'ellipse' }

export interface PolygonElement extends BaseElement {
  type: 'polygon';
  sides: number;                      // 3-12
}

export interface LineElement extends BaseElement {
  type: 'line';
  // 端点存储为相对元素原点的局部坐标
  points: [Vec2, Vec2];
}

export interface ArrowElement extends BaseElement {
  type: 'arrow';
  points: Vec2[];                     // ≥2,支持折线
  routing: 'straight' | 'orthogonal' | 'curved';
  startBinding: ArrowBinding | null;  // §8.4 吸附绑定
  endBinding: ArrowBinding | null;
  startHead: 'none' | 'arrow' | 'dot';
  endHead: 'none' | 'arrow' | 'dot';
  label: string | null;               // 线上文字
}

export interface ArrowBinding {
  elementId: ID;
  // 锚点 = 目标元素局部坐标系下的归一化位置(0-1)
  anchor: Vec2;
  gap: number;                        // 与目标边缘的间距,默认 4
}

export interface PathElement extends BaseElement {
  type: 'path';
  points: Vec2[];                     // 自由画笔采样点(局部坐标)
  pressure?: number[];
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;                       // 纯文本 + '\n'
  textStyle: TextStyle;
  autoSize: 'auto-width' | 'auto-height' | 'fixed';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: ID;
  naturalSize: Vec2;
}

export interface InstanceElement extends BaseElement {
  type: 'instance';
  componentId: ID;
  overrides: Record<string, Partial<OverridableProps>>;
  // key = 组件内部节点 ID;可覆盖属性白名单见 §8.7
}

export type OverridableProps = {
  text: string;
  fills: FillStyle[];
  strokes: Stroke[];
  visible: boolean;
  opacity: number;
};

export type Element =
  | FrameElement | GroupElement | RectangleElement | EllipseElement
  | PolygonElement | LineElement | ArrowElement | PathElement
  | TextElement | ImageElement | InstanceElement;
```

### 5.4 文档 / 页面 / 组件

```ts
export interface RoughDocument {
  schemaVersion: number;              // 当前 = 1
  id: ID;
  name: string;
  pages: Record<ID, Page>;
  pageOrder: ID[];
  components: Record<ID, ComponentDef>;
  assets: Record<ID, AssetRef>;       // 图片元数据(实际二进制在 S3/IndexedDB)
}

export interface Page {
  id: ID;
  name: string;
  elements: Record<ID, Element>;      // ★ 扁平表
  background: RGBA;
}

export interface ComponentDef {
  id: ID;
  name: string;
  description: string;
  // 组件模板 = 一棵独立的扁平元素子树,rootId 指向其根 Frame
  rootId: ID;
  elements: Record<ID, Element>;
  semantic: SemanticTag | null;
}

export interface AssetRef {
  id: ID;
  mime: string;
  width: number; height: number;
  sha256: string;                     // 内容寻址,去重
}
```

### 5.5 Auto Layout

```ts
export interface AutoLayout {
  direction: 'horizontal' | 'vertical';
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  alignItems: 'start' | 'center' | 'end';
  justifyContent: 'start' | 'center' | 'end' | 'space-between';
}

// 子元素参与布局的尺寸策略,挂在 BaseElement 之外的扩展字段:
export interface LayoutChild {
  sizingX: 'fixed' | 'hug' | 'fill';
  sizingY: 'fixed' | 'hug' | 'fill';
}
// 实现:BaseElement 增加可选字段 layoutChild?: LayoutChild
```

### 5.6 语义标签(导出链路根基)

```ts
// 贴近 HTML/ARIA 语义,导出 AI Prompt / 代码骨架时直接映射
export type SemanticTag =
  | 'page' | 'navbar' | 'sidebar' | 'tabs' | 'breadcrumb'
  | 'button' | 'input' | 'select' | 'switch' | 'checkbox' | 'search'
  | 'card' | 'table' | 'list' | 'list-item' | 'avatar' | 'image-placeholder'
  | 'badge' | 'modal' | 'toast' | 'empty-state'
  | 'chart-line' | 'chart-bar' | 'chart-pie'
  | 'heading' | 'paragraph' | 'label' | 'divider' | 'icon' | 'annotation';
```

### 5.7 Fractional Index(同级排序)

- 实现 `generateKeyBetween(a: string | null, b: string | null): string`(参考 figma 的 fractional indexing 算法,base62 字符集)。
- 同级元素按 `sortKey` 字符串升序 = 渲染从下到上。
- 协作冲突(两人同时插入同位置)允许产生相同 key:tie-break 按 `id` 字典序。
- **单测必须覆盖**:头插、尾插、两 key 之间反复插入 50 次不超过 30 字符。

### 5.8 Yjs 映射

```
Y.Doc
├── meta: Y.Map        { name, schemaVersion }
├── pages: Y.Map<pageId, Y.Map>
│     └── 每页: { name, background, elements: Y.Map<elementId, Y.Map<prop, value>> }
├── pageOrder: Y.Array<pageId>
├── components: Y.Map<componentId, Y.Map>   # 结构同 pages.elements
└── assets: Y.Map<assetId, plain object>
```

规则:

- 元素的每个**顶层属性**是 Y.Map 的一个 entry(细粒度合并:A 改颜色、B 改位置不冲突)。
- `points` / `fills` 等数组属性整体替换(不做数组内 CRDT,简化)。
- `TextElement.text` 使用 `Y.Text`(协作打字必须字符级合并)。
- 所有本地写入必须包在 `doc.transact(fn, LOCAL_ORIGIN)` 中;`Y.UndoManager` 只跟踪 `LOCAL_ORIGIN`,保证撤销不会回滚别人的操作。

---

## 6. 渲染引擎

### 6.1 双画布结构

| 画布 | 内容 | 重绘时机 |
| --- | --- | --- |
| `mainCanvas` | 所有文档元素 | 场景 dirty 或视口变化 |
| `overlayCanvas` | 选择框、变换手柄、参考线、框选矩形、协作光标、评论锚点 | 每帧(内容轻) |

- 两者均按 `devicePixelRatio` 缩放,CSS 尺寸 = 容器尺寸。
- RAF 主循环:`if (sceneDirty || viewportDirty) renderMain(); renderOverlay();`

### 6.2 坐标系

- **世界坐标**:文档空间,无限。
- **屏幕坐标**:像素。`screen = (world - viewport.offset) * viewport.zoom`。
- 元素局部 → 世界:沿 parent 链累乘 `translate(x,y) ∘ rotate(rotation, center)`;世界矩阵缓存在 SceneNode 上,父级变更时级联失效。
- zoom 范围 `[0.1, 8]`,缩放以光标位置为锚点。

### 6.3 渲染流程(renderMain)

1. 从 SceneGraph 取当前页根节点列表(按 sortKey 升序)。
2. **视口剔除**:节点世界 AABB 与视口矩形不相交则跳过(子树整体跳过需用含子树的合并 AABB)。
3. 对每个节点:`ctx.save()` → 应用世界矩阵 → 应用 opacity/effects → 调用对应 shapeRenderer → 若是 `clipsContent` 的 Frame 则 `ctx.clip()` 后递归子节点 → `ctx.restore()`。
4. Frame 名称在 zoom ≥ 0.3 时绘制在框体左上角外侧(屏幕空间固定字号)。

### 6.4 手绘渲染与缓存(roughCache)

- 用 `rough.generator()` 生成 `Drawable`,**缓存 key** = `hash(type, w, h, cornerRadius, fills, strokes, roughness, roughSeed)`。几何/样式不变时复用,拖动元素不重新生成。
- `roughness = 0` 时绕过 rough.js,用原生 Canvas path 画整洁图形(整洁模式)。
- 缓存用 LRU(上限 2000 条)。
- 拖拽 resize 过程中:实时用整洁模式预览,`pointerup` 后再生成 rough Drawable(避免 resize 每帧重生成抖动)。

### 6.5 文本渲染

- `textMeasure.ts`:基于离屏 canvas `measureText` 实现贪心换行(按词,CJK 按字符),结果缓存 key = `hash(text, style, maxWidth)`。
- 渲染:逐行 `fillText`,行高 = `fontSize * lineHeight`。
- `autoSize: 'auto-width'`:宽 = 最长行宽;`'auto-height'`:固定宽,高随行数;`'fixed'`:溢出裁剪。

### 6.6 图片

- 资源加载:`assetId → IndexedDB blob → createImageBitmap`,内存 LRU 缓存;未加载完成时渲染打叉占位矩形。

---

## 7. 交互系统

### 7.1 输入管线

```
PointerEvent / KeyboardEvent / WheelEvent
  → InputPipeline(归一化:屏幕→世界坐标、修饰键、双击检测、按压检测)
  → 全局优先级处理:空格平移 > 当前工具
  → ToolManager.activeTool.handle(event)
```

- 滚轮:默认平移(`deltaX/Y`),`Ctrl/Cmd+滚轮` 缩放,`Shift+滚轮` 水平平移。
- 触控板双指捏合 = 缩放(`ctrlKey` 的 wheel 事件)。

### 7.2 工具(每个是独立状态机)

| 工具 | 快捷键 | 状态机要点 |
| --- | --- | --- |
| select | `V` / `Esc` | idle → (pointerdown 命中元素) dragging-move;(命中手柄) dragging-resize/rotate;(命中空白) marquee。双击 Frame/Group 进入内部选择,双击 Text 进入文本编辑 |
| frame | `F` | 拖拽画框;单击 = 弹预设(Mobile 375×812 / Desktop 1440×900) |
| rectangle | `R` | 拖拽创建,`Shift` 锁正方形,`Alt` 中心扩展;松手后自动切回 select |
| ellipse | `O` | 同上,`Shift` 锁正圆 |
| polygon | `Y` | 同上,属性面板可改边数 |
| line | `L` | 两点拖拽,`Shift` 锁 0/45/90° |
| arrow | `A` | 同 line + 端点吸附(§8.4) |
| pen(自由画笔) | `P` | 采样 pointermove(RDP 算法简化点,ε=1.5 世界单位) |
| text | `T` | 单击 = auto-width 文本并立即进入编辑;拖拽 = fixed 宽度 |
| hand | `H` / 按住空格 | 平移视口 |
| comment | `C` | 单击放置评论锚点(§8.10) |

工具切换规则:绘制类工具完成一次创建后自动回到 `select`;按住 `Alt` 再画可连续创建。

### 7.3 命中测试(hitTest)

- 自上而下(sortKey 降序、先子后父)遍历;`visible=false`、`locked=true` 跳过。
- 将世界点逆变换到元素局部坐标后判定:
  - rectangle/frame/image:点在矩形内(含圆角修正);
  - ellipse:椭圆方程;
  - line/arrow/path:点到折线段距离 ≤ `max(strokeWidth/2 + 4, 8/zoom)`;
  - text:行包围盒;
  - 仅 hachure/无填充的封闭图形:只命中描边环带(宽 8/zoom),**点击空心不选中**(与 Figma 一致)。
- Frame:优先命中子元素;点 Frame 名称标签 = 选中 Frame 本身。
- Group/Instance:命中任意后代时返回顶层 Group/Instance(除非处于"深入选择"模式:双击进入,Esc 退出)。

### 7.4 选择与变换

- 选中态 = `Set<ID>`(UI store)。点击 = 单选;`Shift+点击` = 增减选;空白拖拽 = 框选(默认相交即选)。
- 选择框:多选时显示合并 AABB;单选旋转元素显示 OBB。
- 8 个缩放手柄 + 4 角外侧旋转区。手柄屏幕尺寸固定 8px(随 zoom 反向缩放)。
- resize 规则:`Shift` 锁比例;`Alt` 中心对称;文本 resize 改宽度并切为 auto-height;Frame resize 默认不缩放子元素(子元素位置不变),`Cmd+拖拽` = 连同子元素等比缩放。
- rotate:`Shift` 锁 15° 步进。
- 键盘:方向键移动 1px,`Shift+方向键` 10px;`Cmd+D` 原位偏移 (16,16) 复制;`Alt+拖拽` 复制并拖动。

### 7.5 吸附与智能参考线(snapping)

- 阈值:屏幕 8px(换算到世界 = `8/zoom`)。
- 候选源:同一父容器内的兄弟元素 + 父 Frame 边界;候选值 = 每个元素的 `left/centerX/right/top/centerY/bottom`。
- 拖动/resize 时对被拖元素的 6 个值逐一找最近候选,命中则吸附并在 overlay 画红色参考线;**等间距检测**:与两个以上兄弟形成相等 gap 时显示间距标注。
- 实现要求:候选值预先收集并排序,二分查找;开启网格吸附(`Shift+G` 切换)时再叠加 8px 网格取整。

---

## 8. 功能模块详细规格

### 8.1 图层面板(LayerPanel)

- 树形展示当前页元素(顺序 = sortKey 降序,上面 = 上层),Frame/Group/Instance 可折叠。
- 行内容:类型图标 + 名称(双击重命名)+ hover 时显示 锁定/隐藏 按钮。
- 单击选中(与画布选中双向同步,选中元素自动滚动可见);`Shift+点击` 范围选;`Cmd+点击` 增减选。
- 拖拽:同级重排(改 sortKey)、跨容器移动(改 parentId,坐标换算保持世界位置不变)。拖拽指示线显示插入位置;拖到 Frame 行中部高亮 = 移入该 Frame。
- 虚拟滚动(>200 行时),用 `@tanstack/react-virtual`。

### 8.2 属性面板(PropertiesPanel)

按当前选中类型动态分区;多选显示公共属性,数值不一致显示 `Mixed`:

| 分区 | 内容 |
| --- | --- |
| 对齐 | 左/中/右/顶/中/底对齐 + 横/纵等间距分布(≥2 选中可用;对齐参照:多选 = 合并包围盒,单选 = 父容器) |
| 位置尺寸 | X / Y / W / H / 旋转角 / 圆角(矩形:可展开四角独立) |
| Auto Layout | Frame 专属,见 §8.6 |
| 填充 | Fill 列表:增删、类型切换(solid/hachure/image)、颜色(预设 12 色板 + hex 输入) |
| 描边 | 颜色 / 宽度 1-8 / 线型 |
| 效果 | drop-shadow(offset/blur/color)、layer-blur |
| 文本 | 字体(2 种内置)、字号、字重、行高、对齐 |
| 糙度 | 0/1/2 三档 + 「重掷骰子」按钮(随机 roughSeed) |
| 语义 | SemanticTag 下拉(带搜索) |
| 实例 | 显示主组件名、「跳到主组件」「Detach」按钮 |

- 数值输入框:支持拖拽标签横向滑动改值、`↑↓` 步进、输入简单算式(`100+20`)。
- 所有修改通过 Command 提交;拖拽滑动过程中的连续变更合并为一个 undo 步(transaction 合并窗口 200ms)。

### 8.3 多页面(PagesPanel)

- 左栏顶部页面列表:新建、重命名、删除(至少保留一页)、拖拽排序(pageOrder)。
- 切页 = 切换 SceneGraph 根 + 重置选中;每页独立视口状态(记忆 offset/zoom)。

### 8.4 箭头吸附绑定

- arrow 工具拖拽端点靠近元素(阈值 12px 屏幕距离)时高亮目标轮廓,松手写入 `ArrowBinding{elementId, anchor}`,anchor = 命中点在目标局部坐标的归一化位置。
- 目标元素移动/缩放后:`SceneGraph` 变更监听中重算被绑定箭头端点世界坐标 = 目标锚点沿「锚点→另一端」方向退到形状边缘 + gap(矩形/椭圆边缘求交,多边形按边求交)。
- 删除目标元素时:绑定解除,端点固化为当前世界坐标。
- `orthogonal` 路由:简单 L/Z 形折线(起终点方向各引出 ≥16px 后用 1-2 个直角连接,不做避障)。

### 8.5 编组 / Frame 嵌套

- `Cmd+G` 编组:新建 Group,parent = 被选元素的共同父,坐标换算保持世界位置;`Cmd+Shift+G` 解组。
- 拖拽元素进出 Frame:松手时取指针下最深的 Frame 作为新 parent(被拖元素自身及后代除外),进出时坐标换算;Frame 高亮提示。
- `clipsContent` 在属性面板可关。

### 8.6 Auto Layout(简化 Flex)

布局求解器 `autoLayout.ts`,纯函数:

```ts
function solveLayout(frame: FrameElement, children: Element[]): Map<ID, Rect>
```

规则(单轴流式,**不做 wrap、不做嵌套百分比**):

1. 主轴:`fixed` 子元素用自身尺寸;`hug` 文本/Frame 用内容尺寸;`fill` 子元素均分剩余空间(剩余 = frame 内尺寸 − padding − gap×(n−1) − fixed/hug 总和,最小 0)。
2. 交叉轴:`fill` = 撑满;否则按 `alignItems` 对齐。
3. Frame 自身 `hug`:尺寸 = 内容 + padding(与子 `fill` 互斥,子有 fill 时该轴强制 fixed)。
4. 求解发生在 Command 提交阶段:任何影响布局的变更(增删子、改尺寸、改布局参数)→ 重算并把结果写回子元素 x/y/w/h(布局结果是显式数据,渲染器无布局逻辑)。
5. 在 Auto Layout Frame 内拖拽子元素 = 重排序(显示插入指示线),不允许自由摆放;拖出边界 = 移出该 Frame。

交互入口:选中 Frame 或多选元素按 `Shift+A` = 套用 Auto Layout(多选时自动包一层 Frame,方向按元素排布推断)。

### 8.7 组件系统

- **创建**:选中单个 Frame(或自动包 Frame)→ `Cmd+Alt+K` → 子树深拷贝进 `document.components`,原位替换为 `InstanceElement`。
- **实例化**:从资源面板(本文档组件列表 + 线框组件库)拖入画布。
- **渲染**:SceneGraph 将 instance 展开为「影子子树」(组件模板节点 + overrides 合并),影子节点只读、不进 Y.Doc。
- **覆盖(overrides)**:在实例内双击深入选择影子节点,修改白名单属性(`text/fills/strokes/visible/opacity`)→ 写入 `instance.overrides[innerNodeId]`。修改非白名单属性时提示 Detach。
- **主组件编辑**:双击主组件直接编辑;变更后所有实例的影子树重建(overrides 保留,按 innerNodeId 匹配,匹配不到的 override 丢弃)。
- **Detach**:实例展开为普通子树(overrides 合并后落盘),断开 componentId。
- **删除主组件**:已有实例自动 Detach。
- 不做:variants、组件属性(props)、嵌套实例 override 透传(嵌套实例可放置但只能整体 override)。

### 8.8 线框组件库(wireframe-kit)

- 每个定义 = 一个 `ComponentDef` 工厂函数(参数:无),内含语义标签。清单(P0 全部实现):
  `navbar, sidebar, tabs, breadcrumb, button, input, select, switch, checkbox, search, card, table(3×4 占位), list-item, avatar, image-placeholder, badge, modal, toast, empty-state, chart-line, chart-bar, chart-pie`
- 面板:分类 + 搜索;拖入画布时将该 ComponentDef 复制进当前文档 `components`(按 name+hash 去重),落点创建 instance。
- 所有 kit 组件用内置样式常量(黑白灰 + 一个强调色),保持手绘糙感。

### 8.9 历史(Undo/Redo)

- `Y.UndoManager`,scope = pages + components,trackedOrigins = `{LOCAL_ORIGIN}`,`captureTimeout: 200`。
- 撤销后:若被撤销元素已被协作者删除,Yjs 自动空操作,不报错。
- 选中态不进历史,但 undo/redo 后将选中集设为受影响元素(从 stack item 的 meta 读取)。
- 容量 ≥ 100 步。

### 8.10 评论

- 数据走 REST(不进 Y.Doc),锚定:`{ pageId, elementId | null, worldPos }`;元素删除后锚点退化为 worldPos。
- 画布上渲染头像气泡锚点(overlay 层,屏幕空间固定大小);点击展开线程浮层(回复、resolve)。
- 右侧评论列表面板:全部/未解决过滤,点击跳转视口到锚点。
- 协作在线时通过 WS 频道广播 `comment:created/updated` 事件刷新。

### 8.11 导出

入口 `Cmd+E`,导出对象 = 当前选中(无选中 = 当前页全部顶层 Frame)。

| 格式 | 规格 |
| --- | --- |
| PNG | 离屏 canvas 按世界包围盒渲染,1x/2x/4x;多 Frame = zip 打包 |
| SVG | 独立序列化器:rough Drawable → `<path>`;文本 → `<text>`(不转曲);图片内联 base64 |
| JSON | `RoughDocument` 子集 + schemaVersion;支持从 JSON 导入(粘贴/拖文件) |
| Markdown | 见下方算法 |
| AI Prompt | Markdown 结构 + 固定指令前后缀,一键复制 |

**Markdown 结构推断算法**(`export/markdown.ts`):

1. 以 Frame 为页面单位,取其子树;
2. 子元素排序:按 y 聚类成「行」(行高容差 = 元素高度中位数 × 0.5),行内按 x 排序;
3. 输出节点:`semantic` 非空 → `- {Semantic}: {text 或 name}`;容器递归缩进;无语义的纯图形聚合为 `- Box(WxH)`;
4. `annotation` 语义的便签/文本单独汇总到末尾「标注」一节;
5. 输出尺寸、预设设备名作为标题元信息。

**AI Prompt 模板**(`export/aiPrompt.ts`):

```
你是前端工程师。请基于以下线框结构生成 {framework} 页面骨架代码,
只关注结构与语义,使用占位数据,不要追求视觉精确:

{markdown 结构}

要求:组件化拆分、语义化标签、TODO 注释标记交互逻辑。
```

`framework` 选项:React+Tailwind(默认)/ Vue / 纯 HTML。

### 8.12 快捷键总表(必须全部实现)

```
工具:  V 选择 | F Frame | R 矩形 | O 椭圆 | Y 多边形 | L 直线 | A 箭头 | P 画笔 | T 文本 | H 抓手 | C 评论
编辑:  Cmd+Z 撤销 | Cmd+Shift+Z 重做 | Cmd+C/X/V 复制剪切粘贴 | Cmd+D 副本 | Delete 删除
       Cmd+G 编组 | Cmd+Shift+G 解组 | Cmd+Alt+K 创建组件 | Shift+A AutoLayout
层级:  ] 上移一层 | [ 下移一层 | Cmd+] 置顶 | Cmd+[ 置底
视图:  Cmd+0 100% | Cmd+1 适应全部 | Cmd+2 适应选中 | Cmd+\ 切换面板 | Shift+G 网格吸附
       Cmd++ / Cmd+- 缩放 | 空格拖拽平移
样式:  Cmd+Alt+C 复制样式 | Cmd+Alt+V 粘贴样式
其他:  Cmd+E 导出 | Cmd+/ 快捷键面板 | Esc 取消/退出深入选择 | Enter 进入容器选择子级
```

- 粘贴:支持跨文档(剪贴板写入自定义 MIME `application/x-rough+json` + PNG 兜底);粘贴图片文件 = 创建 ImageElement。

---

## 9. 实时协作

### 9.1 同步

- Provider:`y-websocket` 客户端 → Hocuspocus 服务端,room = `documentId`。
- 服务端鉴权钩子:握手时验证 JWT 或 share token,区分 read-only(拒绝写入 update)/ read-write。
- 持久化钩子:`onStoreDocument`(防抖 2s)将 Y.Doc 二进制存 S3 `snapshots/{docId}/latest.bin`,并每 50 个版本存一个历史快照。
- 离线编辑:y-indexeddb 常开;重连后 Yjs 自动差量同步。

### 9.2 Awareness(在线状态)

```ts
interface AwarenessState {
  user: { id: string; name: string; color: string }; // color 从 8 色池按 clientId 取模
  cursor: Vec2 | null;        // 世界坐标
  selection: ID[];
  viewport: { offset: Vec2; zoom: number };
  pageId: ID;
}
```

- 渲染(overlay):同页协作者的光标(名字标签)+ 选区描边(用对方颜色);光标位置 60ms 节流 + 渲染端线性插值。
- 顶栏头像列表;点击头像 = 跟随其视口(spotlight 模式,自己操作即退出)。

### 9.3 冲突语义(验收用例)

| 场景 | 期望 |
| --- | --- |
| A 改颜色,B 同时移动同一元素 | 两者都生效(属性级合并) |
| A 删除元素,B 同时修改它 | 删除胜(元素消失,B 端选中清空,不崩溃) |
| A/B 同时在同一文本打字 | Y.Text 字符级合并,无丢字 |
| A undo | 只回滚 A 自己的操作 |

---

## 10. 后端与 API

### 10.1 数据库 Schema(Drizzle / PostgreSQL)

```
users          (id, github_id, name, avatar_url, created_at)
documents      (id, owner_id→users, name, thumbnail_key, schema_version,
                created_at, updated_at, deleted_at)
share_links    (token PK, document_id→documents, mode 'view'|'edit',
                created_at, revoked_at)
comments       (id, document_id, page_id, element_id?, world_x, world_y,
                author_id→users, body, resolved_at, parent_id?  -- 回复
                created_at)
assets         (id, document_id, sha256, mime, width, height, s3_key, created_at)
```

### 10.2 REST API

统一前缀 `/api/v1`,JSON,错误格式 `{ error: { code, message } }`:

```
POST   /auth/github/callback        # OAuth 换 JWT cookie
GET    /me
POST   /documents                   # 创建(可附带初始 Y.Doc 二进制,用于本地文档上云)
GET    /documents                   # 我的文档列表(含缩略图 URL)
GET    /documents/:id               # 元数据
PATCH  /documents/:id               # 改名
DELETE /documents/:id               # 软删除
POST   /documents/:id/share         # 创建分享链接 {mode} → {token}
DELETE /share/:token                # 撤销
GET    /share/:token                # 解析 token → {documentId, mode}(匿名可访问)
GET    /documents/:id/comments
POST   /documents/:id/comments
PATCH  /comments/:id                # 编辑 / resolve
DELETE /comments/:id
POST   /documents/:id/assets        # 图片上传(≤5MB, png/jpg/webp/svg)→ {assetId, url}
GET    /assets/:id                  # 302 → S3 签名 URL
WS     /collab/:documentId?token=   # Hocuspocus
```

权限:文档 owner 全权;`edit` share token = 读写协作;`view` token = 只读 WS + 评论只读。匿名未登录用户:纯本地模式,所有云端口不可用(UI 引导登录)。

### 10.3 部署形态

- 单容器即可跑全部后端(Fastify 同进程挂 Hocuspocus);`docker-compose.yml` 提供 `web + server + postgres + minio` 本地一键起。

---

## 11. 持久化与离线

- 本地:每个文档一个 y-indexeddb database(`rough-doc-{id}`);文档列表元数据存 `rough-meta` IndexedDB。
- 匿名→登录迁移:把本地文档逐个 `POST /documents` 上云(带 Y.Doc 二进制),成功后标记 synced。
- 缩略图:文档关闭/空闲 10s 时离屏渲染当前页 → 512px PNG → 本地存 + 已登录则上传。
- Schema 迁移:加载时若 `schemaVersion < CURRENT`,跑 `packages/schema/version.ts` 中的逐版本迁移函数链。

---

## 12. 性能预算

| 指标 | 预算 | 测量方式 |
| --- | --- | --- |
| 冷启动到可绘制 | < 1.5s(本地文档) | Lighthouse / 自埋点 |
| 1000 元素拖拽/缩放 | ≥ 55fps | e2e 性能测试(Playwright + tracing) |
| 5000 元素打开渲染首帧 | < 500ms | 同上 |
| 协作光标延迟 | < 200ms(同区域) | 手测 |
| 主 bundle(gzip) | < 400KB(rough.js/yjs 可拆 chunk) | CI 检查 |

实现要求回顾:视口剔除、rough Drawable 缓存、文本测量缓存、世界矩阵缓存、overlay 与 main 分层、resize 期间整洁预览。

---

## 13. 测试要求

### 13.1 单元测试(Vitest,CI 必须全绿)

必须覆盖的纯函数模块(目标行覆盖 ≥ 90%):

- `fractionalIndex`(§5.7 的所有用例)
- `transforms` / `bounds`(旋转元素的世界 AABB、点逆变换)
- `hitTest`(每种元素类型 + 旋转 + 嵌套 Frame 裁剪)
- `snapping`(吸附命中/不命中边界值)
- `autoLayout.solveLayout`(fixed/hug/fill 组合矩阵)
- `export/markdown`(行聚类、语义映射、标注汇总)
- `yjsMapping`(Element ↔ Y.Map 往返相等)
- `schema/version`(迁移链)

### 13.2 E2E(Playwright)

1. 画矩形 → 改颜色 → undo/redo → 刷新页面内容还在;
2. 画两个框 + 箭头吸附 → 移动框 → 箭头跟随;
3. 拖入线框组件 → 导出 Markdown 断言结构;
4. 双浏览器上下文协作:A 画图 B 可见、光标互见、A undo 不影响 B 的元素;
5. 创建组件 → 拖两个实例 → 改主组件 → 实例同步,override 的文本保留。

---

## 14. 编码规范

1. TypeScript strict;禁止 `any`(确需逃逸用 `unknown` + 类型守卫);公共 API 必须显式返回类型。
2. `packages/editor`、`packages/export`、`packages/schema` **禁止 import React**(CI lint 规则强制)。
3. 所有跨包导入走包名(`@rough/schema`),禁止相对路径穿透。
4. 文档写操作只允许出现在 `commands/` 与 `DocumentStore`,渲染与工具代码只读。
5. 几何运算统一世界坐标单位 = CSS px;角度一律弧度,UI 层显示再转角度。
6. 命名:Command 类 `XxxCommand`;工具 `XxxTool`;Y.Doc 字段 camelCase。
7. 每个 PR 范围 = §15 的一个 Phase 或其子项;CI:lint + typecheck + unit + (Phase≥5 时) e2e。

---

## 15. 分阶段实施指令(给 LLM)

> 按 Phase 顺序生成。每个 Phase 完成后必须:能编译、单测绿、验收清单逐条通过,再进入下一个 Phase。
> 每个 Phase 的产出都必须是可运行的应用,不允许「等后面再接通」的死代码。

### Phase 0 — 脚手架

- pnpm monorepo(§4 全部包的空骨架 + tsconfig 引用关系)、Vite app 可启动、ESLint/Prettier/Vitest/CI 配置、`packages/schema` 全量类型落地。
- **验收**:`pnpm build && pnpm test && pnpm lint` 全绿;浏览器打开显示空画布容器。

### Phase 1 — 画布内核

- 双画布渲染器、视口(平移/缩放/坐标换算)、SceneGraph(此阶段可先用内存普通对象,接口与 Y.Doc 版一致)、select/hand/rectangle/ellipse/line/pen 工具、命中测试、选择与 8 向变换、旋转、内存版 undo 栈、手绘渲染 + roughCache + 整洁模式切换。
- **验收**:能画/选/移/缩/转/删图形,undo 100 步,1000 矩形拖拽流畅。

### Phase 2 — 文档化与持久化

- `packages/document` 落地:Y.Doc 映射、DocumentStore 事务 API、`Y.UndoManager` 替换内存 undo、y-indexeddb 持久化、多文档列表页、Frame 工具 + 嵌套 + 裁剪、文本元素(测量/换行/画布内编辑 overlay)、图片粘贴导入(本地 IndexedDB 存 blob)。
- **验收**:刷新不丢数据;§9.3 的 undo 语义在单机成立;Frame 内裁剪正确;文本编辑流畅。

### Phase 3 — 面板与编辑深度

- 图层面板(树、拖拽排序、跨容器移动、锁定隐藏)、属性面板全分区(§8.2)、多页面、对齐分布命令、吸附与智能参考线、编组/解组、复制粘贴(含跨文档 MIME)、快捷键总表全部接通、多边形/箭头工具 + 箭头吸附绑定(§8.4)。
- **验收**:§8.12 快捷键全部生效;箭头跟随移动;图层面板与画布选中双向同步。

### Phase 4 — 布局与组件

- Auto Layout 求解器 + 交互(§8.6)、组件系统全流程(§8.7)、线框组件库 22 个定义 + 面板(§8.8)、语义标签编辑。
- **验收**:§13.2 用例 5 通过;hug/fill 组合行为正确;拖入 navbar 组件可改文字。

### Phase 5 — 导出

- PNG/SVG/JSON 导出与 JSON 导入、Markdown 结构推断、AI Prompt 生成、导出对话框。
- **验收**:用 Rough 画出「订单列表」示例页,导出 Markdown 与 §PRD E-3 示例结构一致;SVG 在浏览器打开与画布一致。

### Phase 6 — 后端、协作与评论

- Fastify 服务 + Postgres schema + GitHub OAuth、文档云同步、Hocuspocus 协作(鉴权/持久化钩子)、Awareness 光标与选区、分享链接(view/edit)、评论系统、docker-compose。
- **验收**:§9.3 全部冲突用例通过;只读链接无法写入;评论锚点跟随元素。

### Phase 7 — 打磨

- 性能预算逐项达标(§12)、空状态/加载态/错误态、快捷键帮助面板(`Cmd+/`)、缩略图、E2E 全量补齐。
- **验收**:§12 表格全部达标;Playwright 全绿。

---

## 附录 A — 给 LLM 的生成约定

1. 生成代码时若本文档某细节未覆盖,按「Figma 的对应行为」实现,并在代码注释中标记 `// SPEC-GAP: <决策>`。
2. 不引入本文档未列出的重型依赖(如组件库、Konva、Redux);小型工具库(nanoid、lru-cache 等)允许。
3. UI 视觉基调:浅色为主、黑白灰 + 单一强调色 `#6965DB`、圆角 8px、面板字号 12-13px;画布默认背景 `#F8F8F4`。
4. 所有面板文案使用中文,代码注释与标识符使用英文。
5. 每个 Phase 输出后,先自检对应「验收」清单,再继续。

---

## 附录 B — 实现状态与已知差距

> 基于对 main 分支的实施审查(构建/lint/单测/E2E 全绿;真实 UI 冒烟通过;1000 元素拖拽实测 ~60fps,主 bundle gzip ~200KB,均达 §12 预算)。本附录是规格与现状的差距清单,**后续迭代应以此为待办来源**;修复某项后请同步更新本节。

### B.1 模块总评

| 模块 | 状态 |
| --- | --- |
| 画布内核(渲染/视口/工具/命中/变换)§6-§7 | ✅ 达标(细节差距见 B.2) |
| 文档层(Yjs/撤销/本地持久化)§5、§8.9、§11 | ✅ 达标 |
| 图层/属性/页面面板 §8.1-§8.3 | ✅ 主干达标(属性面板部分分区缩水) |
| 箭头绑定 §8.4、编组/Frame 嵌套 §8.5 | ✅ 主干达标 |
| Auto Layout §8.6 | ⚠️ 求解器正确,交互与 justifyContent 有缺口 |
| 组件系统 §8.7、线框组件库 §8.8 | ✅ 达标(22 个组件齐全) |
| 导出 §8.11 | ✅ 五格式齐全(SVG 覆盖部分图形) |
| 协作 §9 | ✅ 主编辑器已接入(光标插值/跟随模式未做) |
| 后端 §10 | ✅ REST/DB/S3 齐全(前端走 DEV_AUTH 开发登录) |
| 评论 §8.10 | ✅ 锚点/浮层/跳转已接通(退化逻辑有 bug,见 B.2) |

### B.2 已知差距清单(按优先级)

**正确性问题(优先修)**

1. 评论锚点退化:绑定元素被删除后,DB 中存的元素局部坐标被当作世界坐标回退渲染,锚点会跳位(§8.10 要求退化为 worldPos)。
2. 旋转元素跨容器移动:reparent 坐标换算未考虑绕中心旋转,旋转非 0 的元素拖入/拖出 Frame 或图层面板跨容器移动时会跳位(§8.1/§8.5)。
3. 评论放置:`C` 工具绑定的是当前选中元素而非点击处 hitTest 结果(§7.2)。
4. schema 迁移链:框架存在但 `DocumentStore.load` 不执行迁移,`migrations` 为空(§11);schemaVersion 升级前必须补上。

**功能缺口(规格明确但未实现)**

5. 效果渲染:`Effect`(drop-shadow / layer-blur)有数据模型,渲染器与属性面板均未实现(§5.2/§8.2)。
6. 箭头:线上 `label` 字段未渲染;`orthogonal` 折线路由未实现;吸附时无目标高亮(§8.4)。
7. 吸附:等间距检测与间距标注未做;resize 过程不吸附(§7.5)。
8. 变换:多选无变换手柄;Alt+拖拽复制、方向键微移未实现;文本 resize 不切 auto-height(§7.4)。
9. 属性面板:填充仅 solid(hachure/image 未接 UI)、描边无颜色/线型、圆角无四角独立、无拖拽标签改值(§8.2)。
10. Auto Layout:`justifyContent` 未参与求解;布局内拖拽重排(插入指示线)未做;Frame hug 尺寸不写回;子项 sizing 无 UI(§8.6)。
11. 组件:删除主组件不会自动 Detach 实例(会产生孤儿实例);创建组件不支持自动包 Frame;非白名单 override 静默忽略而非提示 Detach(§8.7)。
12. 页面列表无拖拽排序(API 已有);线框组件「拖入」实为点击固定落点(§8.3/§8.8)。
13. SVG 导出不支持 path/polygon/arrow 图形(§8.11)。

**工程与体验**

14. 协作:连接失败静默无重试;顶栏「协作」徽章不反映真实 WS 状态;无协作者头像列表与跟随(spotlight)模式;光标无线性插值(§9.2)。
15. 云同步:登录迁移非原子(可能产生孤儿云文档);失败无逐文档容错;缩略图未上传云端(§11)。
16. 后端:GitHub OAuth 前端回调页未做(开发用 DEV_AUTH);快照无「每 50 版本」历史;docker-compose 缺 web 服务;协作 WS 为独立端口而非 `/collab/:documentId` 路径(§9.1/§10)。
17. E2E 测试经 `__ROUGH_E2E__` 桥直调内核命令,未覆盖真实鼠标键盘路径;无自动化性能回归测试(§12/§13)。

### B.3 与规格的已声明偏离(可接受)

- `fractionalIndex` 使用 npm `fractional-indexing` 库而非自研(满足 §5.7 全部单测约束)。
- Y.Doc 增加了 `pageViewports`(每页视口记忆,§8.3 需要)与 `meta.id`,§5.8 未列出。
- 缩略图存全局 `rough-thumbnails` IndexedDB,而非每文档一库。
- 评论实时刷新通过 awareness 字段 + 20s 轮询实现,未建专用 WS 频道。

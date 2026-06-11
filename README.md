# Rough

> 破产版 Figma —— 面向开发者的轻量设计工作台。
>
> 先画结构、对齐方案,再写代码。

**快、糙、有用。** 不跟 Figma 比精美,比的是「从想法到可执行方案」要多久。

## 这是什么

Rough 是给开发者用的草图工作台。写代码之前,你往往需要快速表达「这个页面大概长什么样、由哪几块组成、数据怎么流」——Figma 太重,白板涂鸦工具画完只能截图。Rough 卡在中间这个位置:

- **画得快**:打开即用,无需登录;键盘优先,`R` 矩形、`T` 文字、`F` 拖一个 Frame
- **长得糙**:默认手绘风格线条,从视觉上告诉所有人「这是草稿,随便改」
- **导得出**:画完不是一张死图,而是能导出为结构化 Markdown、给 AI 的 Prompt、JSON——直接成为写代码的起点

## 为什么不用 Figma / Excalidraw

| | Figma | Excalidraw | Rough |
| --- | --- | --- | --- |
| 上手到画出第一个线框 | 分钟级,概念多 | 秒级 | 秒级 |
| 线框组件库(按钮/导航/表格占位) | 有,但藏在设计系统里 | 基本没有 | 内置,拖入即用 |
| 导出页面结构给 AI / 写代码 | ❌ | ❌ | ✅ 核心功能 |
| 像素级精修 | ✅ | ❌ | ❌ 刻意不做 |

一句话:**Excalidraw 画完是一张图,Rough 画完是一份方案。**

## 核心功能

覆盖 Figma 的主干能力,但每一项都按「够用就好」实现:

- 🖌️ **无限画布**:矩形/椭圆/多边形/直线/箭头/自由画笔/文本/图片,全部手绘风格(可一键切整洁模式);1000 元素拖拽实测 ~60fps
- 📐 **Frame 与嵌套**:Mobile / Desktop 预设尺寸、内容裁剪、画布拖拽进出 Frame 自动换父级、多页面
- 🗂️ **图层面板 + 属性面板**:树形图层、拖拽排序与跨容器移动、锁定/隐藏;位置尺寸/圆角/填充/描边宽度/透明度/糙度/语义标签
- 📏 **对齐系统**:智能参考线、网格吸附、对齐/分布命令
- 🧩 **组件与实例**:主组件 + 实例 + 文本/填充等属性覆盖、主组件改动实例同步、Detach(刻意不做 variants)
- 📦 **Auto Layout**:简化版 Flex——方向、间距、内边距、hug/fill/fixed
- 🧱 **线框组件库**:导航栏、按钮、输入框、卡片、表格、模态框等 22 个占位组件,全部带语义标签
- 🔗 **连接线**:箭头吸附图形锚点,目标移动时自动跟随,删除目标自动固化
- 👥 **实时协作**:多人编辑(Yjs CRDT)、在线光标与选区、画布锚点评论、只读/可编辑分享链接、登录后本地文档上云
- 📤 **导出即输入**(`Cmd+E`):
  - PNG(1x/2x/4x,多 Frame 自动打包 zip)/ SVG
  - 结构化 Markdown(按布局推断组件树大纲)
  - **AI Prompt**(React+Tailwind / Vue / 纯 HTML 三种模板,一键复制粘进 Cursor / Copilot 生成页面骨架)
  - JSON(开放 schema,支持导入,数据不锁死)
- 💾 **本地优先**:自动存 IndexedDB,关浏览器不丢;无后端也能完整使用单机功能

实现状态与规格的已知差距见 [TECH_SPEC 附录 B](docs/TECH_SPEC.md#附录-b--实现状态与已知差距)。

## 快速开始

### 纯前端(单机模式,无需后端)

```bash
git clone https://github.com/mouse-lincoin/Rough.git
cd Rough
pnpm install
pnpm dev
```

打开 `http://localhost:5173`,按 `R` 画第一个矩形。文档自动保存在浏览器 IndexedDB。

### 带后端(登录 / 云同步 / 协作 / 评论 / 分享)

```bash
docker compose up -d        # postgres + minio + server(REST :3000, 协作 WS :3001)
pnpm dev
```

开发模式下后端开启 `DEV_AUTH`,点「登录同步」即可用开发账号登录,无需配置 GitHub OAuth。

### 常用命令

```bash
pnpm build          # 构建全部包
pnpm test           # 单元测试(Vitest)
pnpm test:e2e       # E2E 测试(Playwright,首次需 pnpm --filter @rough/e2e exec playwright install chromium)
pnpm lint           # ESLint
pnpm typecheck      # TypeScript 检查
pnpm check:bundle   # 检查主 bundle 体积预算
```

## 常用快捷键

| 按键 | 操作 |
| --- | --- |
| `V` / `H` | 选择 / 抓手 |
| `F` | Frame |
| `R` / `O` / `Y` | 矩形 / 椭圆 / 多边形 |
| `L` / `A` / `P` | 直线 / 箭头 / 画笔 |
| `T` / `C` | 文本 / 评论 |
| `空格 + 拖拽` | 平移画布 |
| `Cmd + 滚轮` | 缩放(`Cmd+0` 100%,`Cmd+1` 适应全部,`Cmd+2` 适应选中) |
| `Cmd + Z` / `Cmd + Shift + Z` | 撤销 / 重做 |
| `Cmd + G` / `Cmd + Shift + G` | 编组 / 解组 |
| `Cmd + Alt + K` / `Shift + A` | 创建组件 / 套用 Auto Layout |
| `[` `]` / `Cmd + [` `Cmd + ]` | 层级上下移 / 置底置顶 |
| `Cmd + Alt + C` / `Cmd + Alt + V` | 复制样式 / 粘贴样式 |
| `Cmd + E` | 导出 |
| `Cmd + /` | 完整快捷键面板 |

## 仓库结构

```
apps/web              前端应用(React 面板 + 画布宿主)
apps/server           后端(Fastify REST + Hocuspocus 协作)
packages/schema       类型与文档 Schema(前后端共享,零依赖)
packages/document     Y.Doc 封装:事务 API、撤销、y-indexeddb 持久化
packages/editor       画布内核(无 React):渲染、工具、命中、吸附、布局、组件
packages/export       导出器:PNG / SVG / JSON / Markdown / AI Prompt
packages/wireframe-kit  22 个线框组件定义
e2e                   Playwright 端到端测试
```

## 技术栈

- **前端**:React + TypeScript + Vite(pnpm monorepo + turborepo)
- **画布**:Canvas 2D 自绘 + [rough.js](https://roughjs.com/) 手绘渲染(React 只渲染面板,画布不走 React)
- **文档数据**:Yjs CRDT 作为唯一事实源 + y-indexeddb 本地持久化
- **协作**:Hocuspocus(y-websocket)+ Awareness 光标
- **后端**:Fastify + PostgreSQL(Drizzle)+ S3(MinIO),docker compose 一键起
- **测试**:Vitest(核心算法单测)+ Playwright(E2E)

## 路线图

- [x] **Phase 0 脚手架**:pnpm monorepo、类型定义、空画布容器、CI
- [x] **Phase 1 能画**:画布内核 —— 图形、选择变换、手绘渲染、撤销重做
- [x] **Phase 2 能存**:Yjs 文档化、IndexedDB 持久化、多文档列表、Frame/文本/图片
- [x] **Phase 3 能编辑**:图层面板、属性面板、多页面、对齐吸附、箭头绑定、快捷键
- [x] **Phase 4 能复用**:Auto Layout、组件与实例、线框组件库
- [x] **Phase 5 能落地**:PNG/SVG/JSON/Markdown/AI Prompt 导出
- [x] **Phase 6 能协作**:实时协作、评论、分享链接、登录与云同步
- [x] **Phase 7 打磨**:性能预算达标(1000 元素 ~60fps、主 bundle gzip ~200KB)、E2E 用例

主干已全部落地;剩余打磨项(效果渲染、箭头标签、等间距参考线、GitHub OAuth 前端回调等)见 [TECH_SPEC 附录 B](docs/TECH_SPEC.md#附录-b--实现状态与已知差距)。

## 文档

- [产品需求文档(PRD)](docs/PRD.md) —— 定位、用户、场景、指标
- [技术开发文档(TECH SPEC)](docs/TECH_SPEC.md) —— 完整工程规格:架构、数据模型、渲染/交互算法、API、分阶段实施指令与实现状态

## 设计哲学

1. **糙是特性,不是缺陷** —— 手绘线条降低「终稿」预期,鼓励快速试错
2. **键盘优先** —— 高频操作不进工具栏
3. **结构优先于样式** —— 不做调色板和字体面板,做组件占位、层级、连线、标注
4. **输出即输入** —— 画完的东西要能变成写代码的起点
5. **本地优先** —— 打开即用,数据在你手里

## 明确不做

像素级设计、设计系统管理、高保真原型动效、矢量插画、生产级代码生成。要这些,请用 Figma —— 我们是破产版,破产得理直气壮。

## License

MIT

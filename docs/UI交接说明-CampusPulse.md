# 校园寻物局 2.0 — Campus Pulse UI 交接说明

## 0. 文档信息

| 项 | 内容 |
|---|---|
| 文档用途 | 交接本次前端 UI/UX 重构的范围、设计决策与落地细节 |
| 分支 | `feature/campus-pulse-ui` |
| 对照基线 | `campus-lost-found-main.zip`（2026-10-04 导出，100 个文件） |
| UI 代码提交 | `2764b0b` feat(ui): 引入 Campus Pulse 设计系统并完成全站视觉重构 |
| 前置提交 | `e03715e` feat: campus-lost-found full project with map interaction（= zip 基线 + 地图交互增量） |
| 技术边界 | 仅前端展示层；后端接口、数据库结构、权限逻辑未改动 |
| 撰写日期 | 2026-10-27 |

---

## 1. 一页结论

1. **做了什么**：在 zip 基线之上，建立了一套设计令牌驱动的视觉系统，新增 12 个基础 UI 组件与 10 个业务组件，重构 9 个页面，把原来「内联 style + 原生控件」的界面改为「CSS Modules + 设计令牌」。
2. **改动量**：UI 代码提交 69 个文件、+3969 / −301 行（新增 55、修改 14），其中页面层 +1346 / −255；另有 1 个文档提交，新增 5 个文件（3 份设计规格、1 份架构分析、1 份本说明）。
3. **可运行性**：`tsc -b && vite build` 通过；产物 `index.css` 52.73 kB（gzip 12.73 kB）、`index.js` 439.62 kB（gzip 141.06 kB）。
4. **功能等价性**：全部业务 API 的路径与参数结构未变；认领幂等键、竞态防护、角色守卫、XSS 转义、Leaflet 初始化与绘制状态机均保留（详见 §5）。
5. **需要提前知道的两件事**：
   - 本分支**不能直接与 `main` 合并**：本分支根提交是孤立根（与远端 `main` 无共同祖先），`main` 已演进到 431 个文件并自带另一套 AppShell/CampusMap 体系。本分支的定位是**可独立运行的 UI 参考实现**，接入主线需按 §9 移植。
   - 视觉层已可评审，但**未做端到端回归**：没有真实后端联调、没有三档设备浏览器矩阵、没有对比度工具与键盘走查（详见 §7）。

---

## 2. 上传内容与取舍

`D:\huawei` 下共 5 类内容，本次只上传第 1 类：

| 源路径 | 是否上传 | 处置与原因 |
|---|---|---|
| `clf/campus-lost-found-main/` | **是** | 主体。UI 重构、设计规格、架构分析均在此 |
| `campus-lost-found-main.zip` | 否 | 仅作为对照基线，已在 §3 逐文件核对后写入结论；不重复提交二进制 |
| `usst/usst-campus-lost-found-main/` | 否 | 独立的 Flask + Jinja + SQLite 原型（"勇者驿站"游戏委托板风格），与本仓库 tech stack 不同，且带有 `lost_found.db`、`__pycache__`，混入会污染主干 |
| `didactic/...demo-repository-main/` | 否 | GitHub 演示仓库模板（仅 `.github/workflows`），与项目无关 |
| `.env`、`node_modules/`、`dist/`、`backend/.venv/`、`backend/storage/*`、`*.tsbuildinfo`、`.codeartsdoer/` 本地配置 | 否 | 已在 `.gitignore` 中排除。**`.env` 内含 `JWT_SECRET` 与 `ADMIN_PASSWORD`，从未进入版本库**，如这两个值曾用于线上环境，建议轮换 |

---

## 3. 与 zip 基线的对照

### 3.1 两级增量

```
campus-lost-found-main.zip (2026-10-04, 100 文件)
        │
        ├── 第一级：地图交互（提交 e03715e，9 个文件改动）
        │
        └── 第二级：Campus Pulse UI 重构（提交 2764b0b，69 个文件）
```

### 3.2 第一级：地图交互（`e03715e`，本次未修改，仅作说明）

逐文件哈希核对结果：zip 的 100 个文件与 `e03715e` 的 100 个文件**文件名完全一致，其中 91 个内容完全相同，9 个不同**。这 9 个差异构成"地图交互"特性：

| 文件 | 变更实质 |
|---|---|
| `backend/app/api/v1/items.py` | 精确坐标 `norm_x/norm_y/layer_id` 仅对物主返回，其他用户置空 |
| `backend/app/api/v1/layers.py` | 新增 `GET /layers/{layer_id}/items`（返回 `MapItemOut`） |
| `backend/app/api/v1/me.py` | `/me/items` 响应模型改为 `MyItemOut`（带坐标） |
| `backend/app/schemas/item.py` | 新增 `MyItemOut` |
| `backend/app/schemas/layer.py` | 新增 `MapItemOut` |
| `frontend/src/pages/MapView.tsx` | 地图绘制（标点/范围/路线）、点位选中、图例 |
| `frontend/src/pages/ItemDetail.tsx` | 增加"在地图查看位置"入口 |
| `frontend/src/pages/MyDelegations.tsx` | 增加"地图定位"入口 |
| `frontend/src/types.ts` | 新增 `MapItem`、`MyRoute`、`RouteKind` 等类型 |

> 结论：团队若要判断"这次 UI 到底改了什么"，应以 **`e03715e` 为基线**、而不是 zip。zip 与 `e03715e` 的差异属于地图能力，不属于视觉设计。

### 3.3 第二级：UI 重构（`2764b0b`）

| 分组 | 新增 | 修改 | 说明 |
|---|---|---|---|
| 设计系统 | 2 | 2 | `styles/tokens.css`、`styles/global.css` 新增；`main.tsx` 改引入、`index.css` 收敛为兼容层 |
| 基础 UI 组件 | 23 | 0 | `components/ui/` 下 12 个组件（11 个 CSS Module + 1 个复用 Badge 的 StatusBadge） |
| 业务组件 | 20 | 1 | 10 个组件各带 CSS Module；`Layout.tsx` 改为 AppShell 包装 |
| 页面 | 9 | 9 | 9 个页面各新增 1 个 CSS Module |
| 其他 | 1 | 2 | `css-modules.d.ts` 新增；`package.json` / `package-lock.json` 修改 |
| **合计** | **55** | **14** | 对应 `git show --stat 2764b0b`：69 files changed, +3969 / −301 |

### 3.4 未触碰面（可视为"零风险区"）

`backend/**`、`frontend/src/App.tsx`（路由表）、`frontend/src/api/client.ts`（拦截器）、`frontend/src/auth/AuthContext.tsx`、`frontend/src/components/RequireAuth.tsx`、`frontend/src/types.ts` 全部未改动。

---

## 4. UI 设计说明

### 4.1 设计定位

| 维度 | 基线（zip） | 现在 |
|---|---|---|
| 主题 | 无主题，功能可用 | **Campus Pulse · 校园信号站**：把每条寻物/拾获信息视为一个等待回应的信号 |
| 样式组织 | 页面内联 `style={{}}`，全局仅 `index.css` 22 行 | 2 个全局样式文件 + 30 个 CSS Module，色值 100% 走令牌 |
| 品牌呈现 | 仅 `<h1>大厅</h1>` 文本 | 导航品牌标 + Hero 品牌区 + 登录/注册品牌区（含标语「让每一件失物都有回家的路」） |
| 信息辨识 | 纯文本堆叠 | 类型色条 + 状态徽章 + 元信息三层结构 |
| 状态反馈 | `加载中…` / `暂无` / 红色错误文本 | 统一的 Loading / Empty / Error 三态组件 |

### 4.2 色彩系统

令牌定义于 `frontend/src/styles/tokens.css`，共 59 个自定义属性，其中色彩 18 个：

| 令牌 | 色值 | 语义与使用位置 |
|---|---|---|
| `--color_primary` | `#315CF5` | 主操作：主按钮、导航激活态、链接、寻物地图标记 |
| `--color_primary_light` / `_dark` | `#E8EEFE` / `#1E3FCC` | 主色浅底（消息条、激活项）、按压态 |
| `--color_secondary` | `#7B61FF` | 科技/模拟标识：绘制预览、模拟点位标签、徽章 |
| `--color_secondary_light` | `#EDE8FF` | Hero 渐变端色、次级浅底 |
| `--color_coral` | `#FF8B5E` | **寻物**类型：TypeTag、卡片色条、表单主题、模拟点位 |
| `--color_coral_light` | `#FFE8D9` | 寻物图标底 |
| `--color_mint` | `#16B8A6` | **拾获**类型：TypeTag、卡片色条、表单主题、拾获地图标记 |
| `--color_mint_light` | `#D4F5F0` | 拾获图标底、已标定标签 |
| `--color_background` | `#F5F7FB` | 页面底色 |
| `--color_surface` | `#FFFFFF` | 卡片/面板/导航底 |
| `--color_text` / `_secondary` | `#0F172A` / `#64748B` | 主文本 / 元信息 |
| `--color_border` | `#E5EAF2` | 分隔线与输入框描边 |
| `--color_danger` / `_light` | `#DC2626` / `#FEE2E2` | 危险操作、拒绝、错误 |
| `--color_gray` / `_light` | `#94A3B8` / `#F1F5F9` | 已撤销状态、时间戳、分段控件底 |

**状态徽章映射**（`components/ui/StatusBadge.tsx`）：

| 业务状态 | 令牌 | 视觉 |
|---|---|---|
| `searching` 寻找中 | primary | 蓝底白字 |
| `reviewing` 核验中 | secondary | 紫底白字 |
| `found` 已找回 / `returned` 已归还 | mint | 青底白字 |
| `pending` 待认领 | coral | 橙底白字 |
| `withdrawn` 已撤销 | gray | 灰底白字 |

**类型语义**：寻物 = Coral，拾获 = Mint，两者在 Tag、卡片左侧 4px 色条、表单主题（`.lostTheme` / `.foundTheme`）、地图标记、图例五处保持一致。

### 4.3 尺度与动效令牌

| 类别 | 令牌 | 取值 |
|---|---|---|
| 间距（8 档） | `spacing_xs…4xl` | 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 px |
| 圆角（5 档） | `radius_small…full` | 6 / 10 / 16 / 20 / 9999 px |
| 阴影（3 档） | `shadow_small…large` | 1px→3px / 4px→12px / 12px→32px，均带双层散射 |
| 字号（7 档） | `font_size_xs…3xl` | 12 / 14 / 16 / 18 / 22 / 28 / 32 px |
| 字重（4 档） | `font_weight_normal…bold` | 400 / 500 / 600 / 700 |
| 动效时长（3 档） | `duration_fast…slow` | 150 / 250 / 400 ms |
| 缓动（3 条） | `easing_standard` / `_out` / `_in_out` | `cubic-bezier(0.4,0,0.2,1)` 等 |
| 层级（4 档） | `z_index_base…modal` | 1 / 100 / 1000 / 2000 |
| 布局（4 项） | `max_width_content` / `_form`、`nav_height`、`bottom_nav_height` | 1000 / 480 / 56 / 64 px |

### 4.4 组件分层

```
tokens.css / global.css          ← 唯一色值来源
   └── components/ui/*           ← 12 个无业务语义的基础组件
         └── components/*        ← 10 个带业务语义的复合组件
               └── pages/*       ← 9 个路由级页面（仅负责取数与拼装）
```

### 4.5 基础 UI 组件（`components/ui/`）

| 组件 | 关键 props | 设计要点 |
|---|---|---|
| `Button` | `variant(primary/secondary/danger/ghost)`、`size(sm/md/lg)`、`loading` | loading 时内嵌旋转指示器并自动 `disabled`；按压 `scale(.97)` |
| `Card` | `variant(default/elevated/outlined)`、`onClick` | `elevated` 悬停上浮 3px + 阴影升级 |
| `TextInput` | `label`、`error`、`onChange(value)` | `htmlFor` 与 `id` 由 label 派生，自动关联；error 描边转 danger 并出 `role="alert"` 文案 |
| `SelectInput` | `options[{value,label}]`、`label`、`error` | 与 TextInput 同一套描边/焦点/错误规则 |
| `TextArea` | `label`、`maxLength`、`error` | `resize: vertical` |
| `Tag` | `variant(coral/mint/primary/secondary/gray)` | 轻量类型标识（寻物/拾获/模拟/私密） |
| `Badge` | `variant(含 danger)` | 实心状态徽章 |
| `StatusBadge` | `status: ItemStatus` | 六状态 → 色彩的唯一映射点 |
| `EmptyState` | `title`、`description`、`actionLabel`、`onAction` | 空列表统一呈现，可带"清除筛选"动作 |
| `ErrorState` | `message`、`onRetry` | `role="alert"`，可选重试按钮 |
| `LoadingIndicator` | `size`、`label` | 三段可选尺寸 |
| `Skeleton` | `variant(text/card/circle)`、`width`、`height` | **已实现，当前未接入页面**（见 §6） |

### 4.6 业务组件（`components/`）

| 组件 | 职责 | 关键设计 |
|---|---|---|
| `AppShell` | 应用骨架 | `TopNav` + `<main>` + `BottomNav`；`<main>` 在移动端预留 `bottom_nav_height + safe-area` |
| `TopNav` | 桌面导航 | 品牌标 + 5 项主链接 + staff 专属「认领审核」+ 角色文字 + 退出；`NavLink` 激活态换主色 |
| `BottomNav` | 移动导航 | 4 项图标+文字（大厅/地图/发布/我的），`aria-label`，触控区 ≥44×44px，`≥769px` 隐藏 |
| `HeroSection` | 首页首屏 | 主色→紫色渐变卡，SVG 节点连线做"信号波纹"背景；双入口卡（寻物/Coral、拾获/Mint）带图标底 |
| `SearchFilter` | 大厅筛选 | 主行=搜索框 + 三态分段控件（全部/寻物/拾获）+「更多筛选」；展开行放状态下拉；下方回显已选筛选片与"清除全部" |
| `ItemCard` | 列表卡片 | 左侧 4px 类型色条 + 类型 Tag + 标题单行截断 + 类别·地点 + 状态徽章 + 时间；整卡为 `Link` |
| `CandidateCard` | 候选匹配 | 标题 + 拾获 Tag + 类别·地点 + 匹配依据 + 来源 Tag（规则推荐/缓存/模型/模拟点位） |
| `ClaimForm` | 认领表单 | 「私密」标签 + 证据 TextArea + 关联寻物 SelectInput + 提交按钮（提交后转"已提交申请"并禁用） |
| `TicketCard` | 工单卡 | 工单号前 8 位 + 状态 Badge + 结果 + 按角色/状态分支的操作（接单 / 反馈 / 授权路线 / 已授权） |
| `ReviewPanel` | 认领审核详情 | 拾获信息 + 关联寻物链接 + **私密证据区（带「私密」Tag）** + 主次分明的审核按钮 |

### 4.7 页面级改造

| 页面 | 改造前（基线） | 改造后 | 变更行数 |
|---|---|---|---|
| `Home` | `<h1>大厅</h1>` + 三个原生 select/input + `<ul><li>` 平铺 | Hero 品牌区 + 双入口 → 筛选条 → 响应式卡片栅格（`auto-fill minmax(280px,1fr)`）→ 三态占位 | +56 −34（另 +28 CSS） |
| `ItemForm` | 原生控件 grid，无分区 | 三段分区（发布类型/物品信息/地点信息）；类型改为两张分段卡（`aria-pressed`），页面主题随 `direction` 在 Coral/Mint 间切换 | +94 −21（+105 CSS） |
| `ItemDetail` | 纵向文本流 | 双栏：主栏（描述、位置两张 outlined Card）+ 侧栏（候选匹配 / 认领表单）；顶部 Tag + StatusBadge + 标题 | +74 −36（+95 CSS） |
| `Login` / `Register` | 居中表单，无品牌 | 渐变底 + 品牌区（logo 标、站名、标语）+ 白卡表单，两页风格完全对齐 | +29 −12 / +33 −15（各 +67 CSS） |
| `MyDelegations` | 三段 `<ul><li>`，徽章为文字 join | 徽章区（Badge 列表）+ 三个分区，每项为 outlined Card，含类型 Tag、状态徽章、地图定位按钮 | +84 −37（+64 CSS） |
| `Tickets` | `article.card` 简样式 | 学生申请区（SelectInput + Button）+ `TicketCard` 列表 + `EmptyState` | +60 −29（+49 CSS） |
| `StaffClaims` | 列表与详情纵向堆叠 | 两栏 `280px + 1fr`（移动端降为单栏）+ 状态筛选 + `ReviewPanel` | +70 −29（+91 CSS） |
| `MapView` | 内联样式控件，标记色 `#2563eb/#16a34a` | 标题 + 图层选择 + 四态分段按钮组 + 绘制提示 Card + 选中信息 Card + 图例；标记色改为 `#315CF5/#16B8A6/#7B61FF/#FF8B5E` | +83 −42（+197 CSS） |

### 4.7.1 关键页面布局示意

**首页大厅（≥1025px）**——Hero → 筛选条 → 卡片栅格，三段垂直节奏：

```
┌────────────────────────────────────────────────────────┐
│ ○ 校园寻物局    大厅 发布 地图 我的委托 工单    学生 退出 │ ← TopNav 56px
├────────────────────────────────────────────────────────┤
│ ╭────────────────────────────────────────────────────╮ │
│ │                ○ 校园寻物局                          │ │
│ │              今天，有什么线索？                       │ │ ← Hero（主色→紫渐变
│ │        从校园的某个角落，找回属于你的东西。            │ │   + SVG 信号网背景）
│ │   ┌────────────────┐  ┌────────────────┐            │ │
│ │   │ 🔍 我丢了东西   │  │ ✓ 我捡到了东西 │            │ │ ← Coral / Mint 双入口
│ │   │   发布寻物信息  │  │   发布拾获信息 │            │ │
│ │   └────────────────┘  └────────────────┘            │ │
│ ╰────────────────────────────────────────────────────╯ │
│ [ 搜索类别……        ✕] [ 全部 │寻物│拾获 ] [更多筛选 •] │ ← SearchFilter
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│ │▎[寻物]       │ │▎[拾获]       │ │▎[寻物] [模拟]│      │ ← ItemCard：
│ │ 蓝色雨伞      │ │ 校园卡        │ │ 钥匙串        │      │   4px 类型色条
│ │ 雨具 · 图书馆 │ │ 证件 · 一食堂 │ │ 钥匙 · 操场   │      │   + 标题截断
│ │ [寻找中]  3小时│ │ [待认领] 1天  │ │ [已找回] 2天  │      │   + 状态徽章
│ └──────────────┘ └──────────────┘ └──────────────┘      │
└────────────────────────────────────────────────────────┘
```

**认领审核（工作人员，≥769px）**——两栏工作台，证据区强制视觉区分：

```
┌────────────────────────────────────────────────────────┐
│ 认领审核                                                │
│ [ 状态：待核验 ▾ ]                                      │
│ ┌────────────────┬───────────────────────────────────┐ │
│ │ ▌CLM-8f2a 待核验│ 蓝色雨伞                  [待核验] │ │
│ │ ───────────────│ 雨具 · 图书馆 2F                   │ │
│ │  CLM-1b93 已通过│ 查看拾获详情　查看关联寻物          │ │
│ │  CLM-77c0 已拒绝│ ┌───────────────────────────────┐ │ │
│ │                │ │ 私密认领证据             [私密]│ │ │ ← 证据区二次标识
│ │  280px 列表栏   │ │ 伞柄内侧有一道浅划痕，伞骨…     │ │ │
│ │  选中项：主色描边│ └───────────────────────────────┘ │ │
│ │  + 主色浅底     │ [通过核验]  [拒绝申请]             │ │ ← 主/危 双层级
│ └────────────────┴───────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

**移动端外壳（≤768px）**——顶部导航隐藏，底部导航固定并预留安全区：

```
┌──────────────┐        导航切换规则：
│              │        ≥769px → 仅 TopNav
│   内容区      │        ≤768px → 仅 BottomNav（fixed, 64px）
│  padding 12px│        main 预留 64px + env(safe-area-inset-bottom)
│              │
├──────────────┤
│ 🏠   🗺   ➕   👤 │     触控区 ≥44×44px；激活项换主色
│ 大厅 地图 发布 我的│
└──────────────┘
```


### 4.8 响应式

实现为**两档**（`≤768px` / `≥769px`），通过 CSS Module 媒体查询：

| 规则 | 移动端（≤768px） | 桌面端（≥769px） |
|---|---|---|
| 导航 | 固定底部 `BottomNav`（含 `env(safe-area-inset-bottom)`） | 顶部 `TopNav`，`BottomNav` `display:none` |
| 内容留白 | `padding: 12px`，底部预留 64px + 安全区 | `padding: 24px`，`max-width: 1000px` 居中 |
| 卡片列表 | 单列 | `auto-fill` 多列（≥280px 起） |
| Hero 双入口 | 纵向铺满宽度 | 横向并排 |
| 审核页 | 单栏 | `280px + 1fr` |

### 4.9 可访问性

- 语义标签：`nav` / `main` / `section` / `article` / `header` / `label`，导航含 `aria-label`（"主导航"/"底部导航"）。
- 表单：`label` 与控件通过派生 `id` 关联；错误文案 `role="alert"`；状态消息 `role="status"`。
- 键盘：全局 `:focus-visible` 为主色 2px outline（offset 2px）。
- 触控：移动端可点元素最小 44×44px（`BottomNav` 项、分段控件、Hero 卡片）。
- 动效降级：`@media (prefers-reduced-motion: reduce)` 将动画/过渡压到 0.01ms。

---

## 5. 保留的业务逻辑清单

| 逻辑 | 位置 | 状态 |
|---|---|---|
| 全部 API 路径与参数结构（`/items`、`/items/:id/candidates`、`/claims`、`/tickets`、`/layers/:id/items`、`/me/*`） | 各页面 | 未改 |
| 认领幂等键 `idempotency_key`（`crypto.randomUUID`）+ 输入变更后重置 | `ItemDetail.tsx` | 未改 |
| 列表请求竞态防护（`active` 标志 + cleanup） | `Home.tsx`、`ItemDetail.tsx`、`StaffClaims.tsx` | 未改 |
| `busy` / `submitted` 防重复提交 | `ItemForm`、`ItemDetail`、`Tickets`、`StaffClaims` | 未改 |
| 角色守卫（`role !== 'staff'` → 重定向）、staff 专属入口 | `StaffClaims.tsx`、`TopNav.tsx` | 未改 |
| `esc()` XSS 防护与 `bindTooltip/bindPopup` 转义 | `MapView.tsx:66,246-267` | 未改 |
| Leaflet 初始化、`imageOverlay`、`searchParams` 聚焦、绘制状态机（anchor/circle/polyline）、`modeRef` | `MapView.tsx` | 未改 |
| 授权路线判定（requester + 未授权 + 非 feedback） | `TicketCard.tsx` | 未改 |
| 精确位置仅物主可见（后端已过滤） | 前端仅按 `is_owner` 决定是否渲染 | 未改 |

---

## 6. 与 `spec.md` 的偏差（评审时需确认）

比例尺：`spec.md` 与 `design.md` 位于 `.codeartsdoer/specs/campus_pulse_ui/`，实现与规格并非逐条一致，以下为可核查的偏差：

| # | 规格要求 | 实际实现 | 影响与建议 |
|---|---|---|---|
| 1 | 首页 Hero 展示品牌标语「让每一件失物都有回家的路」 | 首页 Hero 主标题改为「今天，有什么线索？」+ 副标题「从校园的某个角落，找回属于你的东西。」；标语只出现在登录/注册页 | 品牌文案口径不一，需产品确认保留哪一套 |
| 2 | Hero 双入口文案「发布寻物 / 发布拾获」 | 「我丢了东西 / 我捡到了东西」（副文案"发布寻物信息/发布拾获信息"） | 更口语化，需确认是否接受 |
| 3 | 底部导航顺序：大厅、发布、地图、我的 | 大厅、地图、发布、我的 | 视觉优先级变化，需确认 |
| 4 | 三档断点（≤768 / 769–1024 / ≥1025） | 仅两档（≤768 / ≥769），未给平板单独规则 | 平板大屏会呈现桌面多列布局，信息密度偏高 |
| 5 | 加载态可用骨架屏 | `Skeleton` 组件已实现但**未被任何页面引用**；首页用 `LoadingIndicator` | 首屏仍会出现布局跳动，接入骨架屏可改善 |
| 6 | 地图页图层选择器使用统一 `SelectInput` | 仍为原生 `<select>` + 自定义 class；绘制面板的目标选择同理 | 样式与设计系统近似但非同一组件，后续可替换 |
| 7 | 禁止硬编码色值 | CSS 层已 100% 令牌化（`*.module.css` 中 0 处十六进制）；但 `MapView.tsx` 的 Leaflet 标记参数为十六进制字面量 | Leaflet 在 Canvas/SVG 绘制，无法读取 CSS 变量，属客观限制；色值与令牌一致，已在注释层面临时接受 |
| 8 | 所有间距/圆角引用令牌 | 颜色全令牌化；几何值仍有少量固定 px（断点 768/769、触控 44px、类型色条 4px、间隙 2px、`max-width:200/400px`） | 属结构性常量，未令牌化；若要彻底统一，可增补 `--breakpoint_*`、`--touch_target` 类令牌 |
| 9 | 辅助徽章「圆形图标 + 文字描述」 | `MyDelegations` 徽章为 `Badge` 标签列表，未加圆形图标 | 荣誉感偏弱 |
| 10 | 令牌数量与取值 | 规格列 26 个令牌、`spacing_xl=20px`、`font_size_xl=24px`；实现为 59 个、`spacing_xl=24px`、`font_size_xl=22px` | 令牌名与语义不变，属于扩展 + 取值微调；规格文档需同步 |

---

## 7. 验证记录

**已做（可复现）**

| 项 | 方法 | 结果 |
|---|---|---|
| TypeScript 编译 | `npm run build` → `tsc -b` | 通过，无 `any`（人工核查新增组件） |
| 生产构建 | `vite build` | 通过；163 modules；CSS 52.73 kB / gzip 12.73 kB，JS 439.62 kB / gzip 141.06 kB |
| 色值令牌化 | 对 `*.module.css`、`*.css` 扫描十六进制 | `tokens.css` 之外 0 处命中 |
| 基线一致性 | 逐文件 blob 哈希比对 zip 与 `e03715e` | 100 文件同名，91 个完全一致、9 个为地图交互增量 |
| 路由完整性 | 对照 `App.tsx` 与规格 | 7 条受保护路由 + 2 条公开路由，未增删 |

**未做（需在集成环境补做）**

- 真实后端联调回归：发布 → 候选 → 认领 → 核验 → 归还全链路。
- 浏览器矩阵：Chrome / Edge / Safari 在 375 / 768 / 1024 / 1440 四档的实际渲染。
- 对比度工具校验（WCAG AA）与键盘全流程走查。
- Lighthouse 性能与首屏 2s 指标。
- UI 截图存档：页面均需登录态，本次未搭建可复现的截图环境，故 §4.7.1 以线框示意代替真实截图。
- 未新增单元测试；仓库既有后端测试未运行（本次未触碰后端）。

---

## 8. 运行方式

```bash
# 前端
cd frontend
npm install
npm run dev        # 默认 5173，代理到后端 8000（见 vite.config.ts）

# 后端（本次未改动，按仓库原有方式启动）
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

`.env` 未入库，按 `.env.example` 自行创建（`JWT_SECRET`、`ADMIN_PASSWORD`）。

---

## 9. 并入主线的建议

**不要直接对本分支发起 PR。** 本分支的根提交 `e03715e` 是孤立根，与远端 `main` 没有共同祖先；且 `main` 已经演进到 431 个文件（含 AI 助手、双语海报、双视图、自研 `AppShell/CampusMap` 体系），文件路径与组件命名都已不同。

三条路径，按成本从低到高：

| 方案 | 做法 | 适用场景 |
|---|---|---|
| A. 保留为参考实现 | 分支合并进 `main` 前不改动，仅在评审时 `git checkout` 对照 | 只想看视觉方案，不打算现在合并 |
| B. 选择性移植（推荐） | 按 `tokens.css` → `components/ui/*` → 业务组件 → 页面 的顺序，逐层移植到 `main` 既有结构；`main` 已有 `AppShell`，只需吸收令牌与卡片/表单语义 | 想统一视觉语言，但保留 `main` 的功能演进 |
| C. 以 `main` 为基线重做页面层 | 仅取本分支的布局与交互决策，页面在新结构上重写 | `main` 的页面结构与基线差异过大时 |

移植时需要替换的点：`main` 的 `components/AppShell/*` 已存在，避免与本分支的 `AppShell.tsx` 命名冲突；本分支的 `Layout.tsx` 仅做包装，可直接丢弃。

---

## 10. 已知问题与后续项

| 优先级 | 问题 | 建议 |
|---|---|---|
| P1 | `main` 与本分支不可合并（孤立根） | 先定 §9 的方案，再决定是否继续在本分支迭代 |
| P1 | 未做端到端回归 | 集成环境跑一遍 §7 的未做项，尤其认领与审核链路 |
| P2 | `frontend/package.json` 含 `puppeteer-core`（仅本地截图验证使用，代码中无任何引用） | 合并前移除，避免污染生产依赖 |
| P2 | `Skeleton` 未接入 | 首页卡片列表接入骨架屏，替换 `LoadingIndicator` |
| P3 | `MapView` 控件与设计系统半统一（原生 select） | 后续替换为 `SelectInput`，并把图例文案抽到组件 |
| P3 | 品牌文案两套口径（Hero vs 登录页） | 由产品统一 |
| P3 | 平板断点缺失 | 补 `769–1024px` 的列数与留白规则 |

---

## 附录 A. 新增文件清单（55，UI 代码提交）

**设计系统（2）**：`frontend/src/styles/tokens.css`、`frontend/src/styles/global.css`

**基础 UI 组件（23）**：`frontend/src/components/ui/` 下 `Button`、`Card`、`TextInput`、`SelectInput`、`TextArea`、`Badge`、`Tag`、`StatusBadge`、`EmptyState`、`LoadingIndicator`、`Skeleton`、`ErrorState`（各含 `.tsx`，除 `StatusBadge` 外各含 `.module.css`）

**业务组件（20）**：`AppShell`、`TopNav`、`BottomNav`、`HeroSection`、`SearchFilter`、`ItemCard`、`CandidateCard`、`ClaimForm`、`TicketCard`、`ReviewPanel`（各含 `.tsx` + `.module.css`）

**页面样式（9）**：`pages/` 下 `Home`、`ItemForm`、`ItemDetail`、`Login`、`Register`、`MyDelegations`、`Tickets`、`StaffClaims`、`MapView` 的 `.module.css`

**其他（1）**：`frontend/src/css-modules.d.ts`

合计 2 + 23 + 20 + 9 + 1 = 55 个新增文件。

**文档提交另新增 5 个**：`docs/UI交接说明-CampusPulse.md`（本文件）、`docs/architecture-analysis.md`、`.codeartsdoer/specs/campus_pulse_ui/{spec,design,tasks}.md`

## 附录 B. 修改文件清单（14）

`frontend/package.json`、`frontend/package-lock.json`、`frontend/src/main.tsx`、`frontend/src/index.css`、`frontend/src/components/Layout.tsx`、`frontend/src/pages/{Home,ItemForm,ItemDetail,Login,Register,MyDelegations,Tickets,StaffClaims,MapView}.tsx`

## 附录 C. 提交记录

```
2764b0b  feat(ui): 引入 Campus Pulse 设计系统并完成全站视觉重构
         （后一提交为文档与规格：本文件、architecture-analysis、campus_pulse_ui 规格）
e03715e  feat: campus-lost-found full project with map interaction
         （= campus-lost-found-main.zip + 9 个地图交互文件）
```

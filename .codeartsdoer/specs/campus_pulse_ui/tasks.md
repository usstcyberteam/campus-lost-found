# 校园寻物局 2.0 — Campus Pulse UI/UX 工程化升级编码任务规划

## 0. 文档信息

| 项 | 内容 |
|---|---|
| 项目 | 校园寻物局 2.0（Campus Pulse · 校园信号站） |
| 阶段 | 编码任务规划 |
| 特性名 | `campus_pulse_ui` |
| 写入路径 | `.codeartsdoer/specs/campus_pulse_ui/tasks.md` |
| 关联需求 | `.codeartsdoer/specs/campus_pulse_ui/spec.md` |
| 关联设计 | `.codeartsdoer/specs/campus_pulse_ui/design.md` |
| 项目路径 | `D:\huawei\clf\campus-lost-found-main` |

**全局约束**：
- 保留 React + TypeScript + Vite + React Router + CSS Modules + Leaflet
- 禁止引入 ArkTS/ArkUI/鸿蒙结构，禁止迁移到其他框架
- 禁止修改后端业务接口、数据库结构和权限逻辑
- 渐进式视觉与交互重构，不是技术栈迁移
- 所有新增 UI 组件须有完整的 TypeScript 类型定义，禁止使用 any
- 所有组件样式中的色值、间距、圆角、阴影值必须引用设计令牌，禁止硬编码
- 禁止引入 styled-components、emotion 等 CSS-in-JS 库

---

## 阶段A：设计系统 + 首页大厅

### 1. 创建设计令牌文件

- [ ] 创建 `frontend/src/styles/tokens.css`，定义 26 个 CSS 自定义属性，涵盖颜色令牌（color_primary #315CF5、color_secondary #7B61FF、color_coral #FF8B5E、color_mint #16B8A6、color_background #F5F7FB、color_surface #FFFFFF、color_text #0F172A、color_text_secondary #64748B、color_border #E5EAF2、color_danger #DC2626、color_gray #94A3B8）、间距令牌（spacing_xs 4px ~ spacing_4xl 48px）、圆角令牌（radius_small 6px、radius_medium 10px、radius_large 16px）、阴影令牌（shadow_small/medium/large）、字体令牌（font_size_xs 12px ~ font_size_2xl 32px）、动画令牌（duration_fast 150ms、duration_normal 250ms、duration_slow 400ms、easing_standard cubic-bezier(0.4,0,0.2,1)）
  - **依赖**：无
  - **验证**：文件创建后，在浏览器 DevTools 中检查 `:root` 是否包含全部 26 个自定义属性；`npm run build` 构建通过
  - **保留**：无（全新文件）

### 2. 创建全局样式重置文件

- [ ] 创建 `frontend/src/styles/global.css`，包含 CSS Reset（box-sizing、margin/padding 归零、font 继承）、基础排版样式（body 背景色 var(--color_background)、文本色 var(--color_text)、字体族引用）、全局工具类（.page 引用 var(--spacing_2xl) padding 和 max-width、.card 引用 var(--color_surface) 背景 + var(--radius_medium) 圆角 + var(--shadow_small) 阴影、.actions flex 布局引用 var(--spacing_sm) gap）、button/input/select/textarea 基础样式引用令牌、button:disabled 样式、textarea resize:vertical、:focus-visible 样式（var(--color_primary) outline 2px）、prefers-reduced-motion 降级规则
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；浏览器中加载页面后基础排版统一，无浏览器默认样式干扰
  - **保留**：保留 .page/.card/.actions 类名和功能，确保过渡期现有页面不退化

### 3. 更新入口文件 CSS 引用

- [ ] 修改 `frontend/src/main.tsx`，将 `import './index.css'` 替换为 `import './styles/tokens.css'` 和 `import './styles/global.css'`
  - **依赖**：A1、A2
  - **验证**：`npm run build` 构建通过；`npm run dev` 开发服务器启动后页面样式正常加载
  - **保留**：保留 React.StrictMode、BrowserRouter、AuthProvider 结构不变

- [ ] 修改 `frontend/src/index.css`，将内容精简为仅保留过渡期兼容声明（保留 .page/.card/.actions 类名定义但改为引用 tokens 变量），或在确认所有页面迁移完成后删除该文件
  - **依赖**：A1、A2、A3
  - **验证**：`npm run build` 构建通过；现有页面样式不退化
  - **保留**：过渡期保留 .page/.card/.actions 类名，确保未迁移页面功能正常

### 4. 创建 Button UI 组件

- [ ] 创建 `frontend/src/components/ui/Button.tsx` + `Button.module.css`，实现 variant（primary/secondary/danger/ghost）、size（sm/md/lg）、disabled、loading（旋转加载指示器）、onClick、type（button/submit）、ariaLabel 属性；primary 使用 var(--color_primary) 背景 + 白色文字，secondary 使用 var(--color_surface) 背景 + var(--color_primary) 文字 + var(--color_border) 边框，danger 使用 var(--color_danger) 背景，ghost 使用透明背景；按压动画 scale(0.97) + duration_fast；focus-visible 样式
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；在测试页面中渲染各 variant 确认样式正确
  - **保留**：无（全新组件）

### 5. 创建 Card UI 组件

- [ ] 创建 `frontend/src/components/ui/Card.tsx` + `Card.module.css`，实现 variant（default/elevated/outlined）、onClick、children、ariaLabel 属性；default 使用 var(--shadow_small)，elevated 悬停时 translateY(-2px) + var(--shadow_medium)，outlined 使用边框无阴影；圆角 var(--radius_medium)；悬停过渡 duration_normal + easing_standard
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 6. 创建 TextInput UI 组件

- [ ] 创建 `frontend/src/components/ui/TextInput.tsx` + `TextInput.module.css`，实现 value/onChange/placeholder/label/error/disabled/required/type（text/password）/maxLength/ariaLabel 属性；默认边框 var(--color_border)，focus 时 var(--color_primary)，error 时 var(--color_danger) + 错误文案展示；圆角 var(--radius_medium)；padding 引用 var(--spacing_md) var(--spacing_lg)；label 关联（htmlFor + id）；focus-visible 样式
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 7. 创建 SelectInput UI 组件

- [ ] 创建 `frontend/src/components/ui/SelectInput.tsx` + `SelectInput.module.css`，实现 value/onChange/options（{value,label}[]）/placeholder/label/error/disabled/ariaLabel 属性；样式规则同 TextInput（focus/error 边框色变化）；圆角 var(--radius_medium)；label 关联
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 8. 创建 TextArea UI 组件

- [ ] 创建 `frontend/src/components/ui/TextArea.tsx` + `TextArea.module.css`，实现 value/onChange/placeholder/label/error/disabled/required/maxLength/minHeight/ariaLabel 属性；样式规则同 TextInput；resize: vertical；min-height 可配置
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 9. 创建 Badge UI 组件

- [ ] 创建 `frontend/src/components/ui/Badge.tsx` + `Badge.module.css`，实现 variant（primary/secondary/coral/mint/gray）/children 属性；对应色为背景 + 白色文字；圆角 var(--radius_small)；font-size var(--font_size_xs)；padding var(--spacing_xs) var(--spacing_sm)
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 10. 创建 Tag UI 组件

- [ ] 创建 `frontend/src/components/ui/Tag.tsx` + `Tag.module.css`，实现 variant（coral/mint/primary/secondary）/children 属性；轻量级色彩标识，coral 用于寻物、mint 用于拾获；圆角 var(--radius_small)；font-size var(--font_size_xs)
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 11. 创建 EmptyState UI 组件

- [ ] 创建 `frontend/src/components/ui/EmptyState.tsx` + `EmptyState.module.css`，实现 icon（ReactNode）/title/description/actionLabel/onAction 属性；居中布局；actionLabel 存在时渲染 Button variant="secondary"
  - **依赖**：A1（tokens.css）、A4（Button）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 12. 创建 LoadingIndicator UI 组件

- [ ] 创建 `frontend/src/components/ui/LoadingIndicator.tsx` + `LoadingIndicator.module.css`，实现 size（sm/md/lg）/label 属性；旋转动画（1s linear 循环）；prefers-reduced-motion 降级为无动画
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 13. 创建 Skeleton UI 组件

- [ ] 创建 `frontend/src/components/ui/Skeleton.tsx` + `Skeleton.module.css`，实现 variant（text/card/circle）/width/height 属性；闪烁动画（opacity 0.5→1 循环 1.5s ease-in-out）；prefers-reduced-motion 降级
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 14. 创建 ErrorState UI 组件

- [ ] 创建 `frontend/src/components/ui/ErrorState.tsx` + `ErrorState.module.css`，实现 message/onRetry 属性；错误图标 + 红色文案 + 可选重试 Button variant="secondary"
  - **依赖**：A1（tokens.css）、A4（Button）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any
  - **保留**：无（全新组件）

### 15. 创建 StatusBadge 业务组件

- [ ] 创建 `frontend/src/components/ui/StatusBadge.tsx` + `StatusBadge.module.css`，实现 status（ItemStatus）属性；色彩映射：searching→primary、reviewing→secondary、found→mint、pending→coral、returned→mint、withdrawn→gray；文案映射使用 statusLabels
  - **依赖**：A1（tokens.css）、A9（Badge）、types.ts 中 statusLabels
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；渲染各状态确认色彩和文案正确
  - **保留**：无（全新组件）

### 16. 创建 HeroSection 业务组件

- [ ] 创建 `frontend/src/components/HeroSection.tsx` + `HeroSection.module.css`，实现 onPublishLost/onPublishFound 属性；展示品牌名称"校园寻物局"、品牌标语"让每一件失物都有回家的路"、信号波纹动画效果（CSS 动画）、两个快捷入口按钮（寻物用 Coral 色 Button、拾获用 Mint 色 Button）；响应式：移动端单列、桌面端居中
  - **依赖**：A1（tokens.css）、A4（Button）、A10（Tag）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；点击快捷入口按钮触发对应回调
  - **保留**：无（全新组件）

### 17. 创建 SearchFilter 业务组件

- [ ] 创建 `frontend/src/components/SearchFilter.tsx` + `SearchFilter.module.css`，实现 direction/category/status/onDirectionChange/onCategoryChange/onStatusChange 属性；使用 SelectInput 实现类型筛选（全部/寻物/拾获）和状态筛选（全部/6种状态），使用 TextInput 实现类别搜索；响应式：移动端纵向排列、桌面端横向排列
  - **依赖**：A1（tokens.css）、A6（TextInput）、A7（SelectInput）、types.ts 中 statusLabels
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；筛选条件变化触发对应回调
  - **保留**：无（全新组件）

### 18. 创建 ItemCard 业务组件

- [ ] 创建 `frontend/src/components/ItemCard.tsx` + `ItemCard.module.css`，实现 item（Item）/onClick 属性；卡片左侧或顶部类型色条（寻物 Coral、拾获 Mint）；标题（单行截断 ellipsis）+ 类别 + 地点（空时显示"未知地点"）+ StatusBadge + 时间 + 模拟标识 Tag；悬停 translateY(-2px) + shadow_medium + cursor pointer；点击触发 onClick
  - **依赖**：A1（tokens.css）、A5（Card）、A10（Tag）、A15（StatusBadge）、types.ts
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；悬停动画效果正确；点击触发回调
  - **保留**：无（全新组件）

### 19. 重构首页大厅页面

- [ ] 重构 `frontend/src/pages/Home.tsx`，将 `<h1>大厅</h1>` 替换为 `<HeroSection onPublishLost={() => navigate('/publish?direction=lost')} onPublishFound={() => navigate('/publish?direction=found')} />`；将筛选 `<div>` 区域替换为 `<SearchFilter direction={direction} category={category} status={status} onDirectionChange={setDirection} onCategoryChange={setCategory} onStatusChange={setStatus} />`；将 `<ul>` 列表替换为 `<div>` + `items.map(item => <ItemCard item={item} onClick={() => navigate(`/items/${item.id}`)} />)`；将 `<p>加载中…</p>` 替换为 `<LoadingIndicator label="加载中…" />` 或 Skeleton 骨架屏；将 `<p>暂无符合条件的记录</p>` 替换为 `<EmptyState title="暂无符合条件的记录" description="试试调整筛选条件" actionLabel="清除筛选" onAction={clearFilters} />`；将 `<p role="alert">{error}</p>` 替换为 `<ErrorState message={error} onRetry={reload} />`；使用语义化标签 `<main>`/`<section>`
  - **依赖**：A1-A18（全部阶段A组件）
  - **验证**：`npm run build` 构建通过；`npm run dev` 开发服务器中首页功能正常：Hero 区域展示、筛选功能不退化、卡片列表渲染、空状态/加载状态/错误状态展示正确
  - **保留**：保留 useEffect 中 `/items` API 调用逻辑（params 构建、active 竞态防护）；保留 direction/category/status 三个 state 及筛选逻辑；保留 loading/error/items 三个 state

### 20. 阶段A集成验证

- [ ] 执行阶段A全面验证：`npm run build` 构建通过；`npm run dev` 启动后首页功能完整测试（Hero 区域品牌展示、快捷入口跳转、三维筛选功能、卡片列表渲染、卡片悬停动画、卡片点击导航、空状态展示、加载状态展示、错误状态展示）；确认 tokens.css + global.css 合计 gzip 后 ≤15KB；确认无硬编码色值（搜索组件 CSS 文件不含 #315CF5、16px 等具体数值，令牌定义文件除外）
  - **依赖**：A1-A19
  - **验证**：构建通过、功能测试通过、CSS 体积达标、无硬编码值
  - **保留**：全部现有业务功能不退化

---

## 阶段B：导航与发布页

### 21. 创建 TopNav 组件

- [ ] 创建 `frontend/src/components/TopNav.tsx` + `TopNav.module.css`，实现 role（Role|null）/onLogout 属性；桌面端顶部导航栏，包含品牌标识"校园寻物局"（var(--color_primary) 色、var(--font_size_lg)、加粗）、导航链接（大厅/发布/地图/我的委托/工单，使用 NavLink 实现 active 高亮 var(--color_primary)）、工作人员额外显示认领审核入口（role === 'staff' 条件渲染）、右侧角色信息 + 退出按钮（Button variant="ghost"）；语义化 `<nav>` 标签；focus-visible 样式
  - **依赖**：A1（tokens.css）、A4（Button）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；导航链接 active 状态高亮正确；role === 'staff' 时认领审核入口可见
  - **保留**：无（全新组件）

### 22. 创建 BottomNav 组件

- [ ] 创建 `frontend/src/components/BottomNav.tsx` + `BottomNav.module.css`，实现 currentPath 属性；移动端底部导航栏（≤768px 显示），包含大厅/发布/地图/我的四个入口，每个入口含图标（24×24px）+ 文字（var(--font_size_xs)）；active 项 var(--color_primary) 色，默认 var(--color_text_secondary) 色；最小点击区域 44×44px；语义化 `<nav>` 标签；固定底部定位
  - **依赖**：A1（tokens.css）
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；≤768px 时底部导航可见，>768px 时隐藏；点击导航项跳转正确路由
  - **保留**：无（全新组件）

### 23. 创建 AppShell 组件

- [ ] 创建 `frontend/src/components/AppShell.tsx` + `AppShell.module.css`，实现 children 属性；应用级布局框架，桌面端（>768px）显示 TopNav 隐藏 BottomNav，移动端（≤768px）显示 BottomNav 隐藏 TopNav；内容区域 `<main>` 自适应；移动端 padding-bottom 72px 为 BottomNav 预留空间；使用 useAuth 获取 role 和 logout；使用 useLocation 获取 currentPath；使用 useNavigate 实现 logout 跳转
  - **依赖**：A1（tokens.css）、B1（TopNav）、B2（BottomNav）、auth/AuthContext
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；桌面端显示 TopNav、移动端显示 BottomNav，两种导航不同时出现
  - **保留**：无（全新组件）

### 24. 重构布局组件为 AppShell

- [ ] 重构 `frontend/src/components/Layout.tsx`，将现有 `<nav>` + `<Outlet>` 结构替换为 `<AppShell><Outlet /></AppShell>`；移除 inline style 导航栏代码；保留 useAuth 获取 role/logout（传递给 AppShell 内部的 TopNav）；保留 useNavigate 用于 logout 跳转
  - **依赖**：B3（AppShell）
  - **验证**：`npm run build` 构建通过；`npm run dev` 中所有页面导航功能正常；role === 'staff' 时认领审核入口可见；退出按钮功能正常
  - **保留**：保留 useAuth() 获取 role 和 logout；保留 useNavigate() 用于 logout 跳转；保留 role === 'staff' 条件渲染认领审核链接；保留 `<Outlet />` 渲染子路由

### 25. 重构发布页表单

- [ ] 重构 `frontend/src/pages/ItemForm.tsx`，将表单重构为分区式布局：类型选择区（寻物/拾获切换，使用分段按钮组或 SelectInput，切换时表单主题色跟随变化 Coral/Mint）、基本信息区（类别 TextInput、标题 TextInput、描述 TextArea）、位置信息区（地点 TextInput、精确位置 TextInput）；使用 TextInput/SelectInput/TextArea/Button 替换原生控件；提交按钮使用 `<Button variant="primary" loading={busy}>`；error 使用 ErrorState 或 TextInput error prop；表单主题色通过 CSS Module 动态 class 切换（direction === 'lost' 时 Coral 主题、direction === 'found' 时 Mint 主题）；响应式：移动端 100% 宽度、桌面端 max-width 480px 居中
  - **依赖**：A1（tokens.css）、A4（Button）、A6（TextInput）、A7（SelectInput）、A8（TextArea）、A10（Tag）、A14（ErrorState）
  - **验证**：`npm run build` 构建通过；`npm run dev` 中发布页功能正常：类型切换色调跟随、6个字段完整、提交功能正常、busy 防重复、错误提示展示
  - **保留**：保留 direction/category/title/description/locationArea/preciseLocation 6 个 state；保留 onSubmit 函数中 POST `/items` 的参数结构（direction/category/title/description/location_area/precise_location）；保留 busy 防重复提交逻辑（if(busy) return）；保留 preciseLocation || null 空值处理；保留 navigate('/') 提交成功跳转；保留 errorMessage(error) 错误处理

### 26. 阶段B集成验证

- [ ] 执行阶段B全面验证：`npm run build` 构建通过；`npm run dev` 中导航功能完整测试（桌面端 TopNav 链接跳转、移动端 BottomNav 链接跳转、两种导航不同时出现、退出按钮功能、role 条件渲染）；发布页功能完整测试（类型切换色调跟随、6个字段完整可提交、busy 防重复提交、precise_location 空值传 null、提交成功跳转大厅）；确认 POST /items 请求参数结构与升级前一致
  - **依赖**：B1-B25
  - **验证**：构建通过、导航功能测试通过、发布页功能测试通过、API 参数结构不变
  - **保留**：全部现有业务功能不退化

---

## 阶段C：地图、AI及其他页面

### 27. 创建 CandidateCard 业务组件

- [ ] 创建 `frontend/src/components/CandidateCard.tsx` + `CandidateCard.module.css`，实现 candidate（Candidate）/lostItemId 属性；展示拾获物品标题（Link 跳转到 `/items/${candidate.found_item_id}?lost=${lostItemId}`）、类别、地点（空时"未知地点"）、匹配依据（explanation）、来源标识（source 映射：rule→"规则推荐"、cache→"缓存"、model→"模型"、simulated→"模拟点位"）；使用 Card + Tag 组件
  - **依赖**：A1（tokens.css）、A5（Card）、A10（Tag）、types.ts
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；点击卡片跳转到拾获详情页（带 lost 参数）
  - **保留**：无（全新组件）

### 28. 创建 ClaimForm 业务组件

- [ ] 创建 `frontend/src/components/ClaimForm.tsx` + `ClaimForm.module.css`，实现 evidence/lostItemId/lostItemOptions（Item[]）/busy/submitted/onEvidenceChange/onLostItemIdChange/onSubmit/message 属性；使用 TextArea 实现私密认领证据输入（aria-label="私密认领证据"、maxLength=5000、disabled 当 busy||submitted）；使用 SelectInput 实现关联寻物选择（options 从 lostItemOptions 构建）；使用 Button variant="primary" 实现提交按钮（loading={busy}、disabled={busy||submitted}）；message 展示区域（role="status"）；"私密"标识 Tag
  - **依赖**：A1（tokens.css）、A4（Button）、A6（TextInput）、A7（SelectInput）、A8（TextArea）、A10（Tag）、types.ts
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；提交按钮 busy/submitted 状态正确
  - **保留**：无（全新组件）

### 29. 创建 TicketCard 业务组件

- [ ] 创建 `frontend/src/components/TicketCard.tsx` + `TicketCard.module.css`，实现 ticket/role/userId/busy/editingId/result/onAssign/onStartFeedback/onSubmitFeedback/onCancelFeedback/onResultChange/onAuthorizeRoute 属性；展示工单编号（t.id.slice(0,8)）、状态徽章（使用 Badge 映射 ticketStatusLabels）、结果信息；根据 role 和 status 展示不同操作按钮：staff + pending → 接单按钮（Button variant="primary"）、staff + processing + assignee → 反馈按钮（Button variant="secondary"）、反馈编辑模式 → TextArea + 提交/取消按钮、requester + !authorized + !feedback → 授权路线按钮（Button variant="primary"）、已授权 → "已授权"状态展示
  - **依赖**：A1（tokens.css）、A4（Button）、A5（Card）、A9（Badge）、A8（TextArea）、types.ts
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；不同角色和状态下按钮展示正确
  - **保留**：无（全新组件）

### 30. 创建 ReviewPanel 业务组件

- [ ] 创建 `frontend/src/components/ReviewPanel.tsx` + `ReviewPanel.module.css`，实现 detail（ClaimDetail）/foundItem（Item|null）/busy/onApprove/onReject/onComplete 属性；展示拾获物品信息（标题/类别/地点/描述）、关联寻物链接、私密认领证据区域（"私密"标识 Tag + 证据内容）、状态徽章；审核操作按钮：pending 时通过核验（Button variant="primary"）+ 拒绝申请（Button variant="danger"）、approved 时确认归还（Button variant="primary"）
  - **依赖**：A1（tokens.css）、A4（Button）、A5（Card）、A9（Badge）、A10（Tag）、types.ts
  - **验证**：`npm run build` 构建通过；TypeScript 类型检查无 any；审核按钮视觉层级正确（主操作 Primary、拒绝 Danger）
  - **保留**：无（全新组件）

### 31. 重构地图页面

- [ ] 重构 `frontend/src/pages/MapView.tsx`，将 `<h1>地图</h1>` 替换为设计系统样式的页面标题区域；将 `<select>` 图层选择替换为 `<SelectInput>`；将模式切换 `<button>` 替换为 ButtonGroup 样式（当前选中高亮 var(--color_primary)）；将绘制操作提示 `<div className="card">` 替换为 `<Card>` 组件；将选中物品信息 `<div className="card">` 替换为 `<Card>` + `<StatusBadge>` + `<Tag>` 组件；将标记色彩 `#2563eb` 替换为 `var(--color_primary)`、`#16a34a` 替换为 `var(--color_mint)`、`#7c3aed` 替换为 `var(--color_secondary)`、`#d97706` 替换为 `var(--color_coral)`；将比例尺状态文字提示替换为 `<Tag variant="mint">已标定</Tag>` 或 `<Tag variant="gray">未标定</Tag>`；将 `<p role="alert">{error}</p>` 替换为 `<ErrorState>`；将 `<p>暂无图层...</p>` 替换为 `<EmptyState>`；将地图容器 inline style 替换为 CSS Module 样式（响应式高度：mobile ≥400px、desktop ≥560px）
  - **依赖**：A1（tokens.css）、A5（Card）、A7（SelectInput）、A4（Button）、A10（Tag）、A15（StatusBadge）、A14（ErrorState）、A11（EmptyState）
  - **验证**：`npm run build` 构建通过；`npm run dev` 中地图功能完整测试：图层切换、4种操作模式、标记渲染、绘制交互、保存功能、searchParams 聚焦、比例尺提示
  - **保留**：保留全部 useRef（containerRef/mapRef/itemGroupRef/pointGroupRef/drawGroupRef/routeGroupRef）；保留全部 useState（layers/selected/points/items/routes/calibrated/error/interaction/myItems/selectedItem/busy/msg）；保留 modeRef 和对应 useEffect；保留图层加载 useEffect（/layers API）；保留我的发布 useEffect（/me/items API）；保留我的路线 useEffect（/me/routes API）；保留地图初始化 useEffect（L.map + imageOverlay + bounds + click + searchParams 聚焦）；保留物品标记 useEffect；保留模拟点位 useEffect；保留绘制预览 useEffect；保留路线渲染 useEffect；保留 changeMode/resetDraw/saveDraw 函数；保留 esc 函数

### 32. 重构详情页

- [ ] 重构 `frontend/src/pages/ItemDetail.tsx`，将 `<h1>{item.title}</h1>` 替换为结构化布局（类型色系标识条 Tag + 标题区 + StatusBadge）；将 `<p>{directionLabels}...{statusLabels}</p>` 替换为 `<Tag>` + `<StatusBadge>` 组件；将 `<p>{item.description}</p>` 替换为描述区 Card；将 `<p>地点：...</p>` 替换为位置信息区 Card；将 `<Link>在地图查看位置</Link>` 替换为 `<Button variant="secondary">` 醒目按钮；将 `<p>演示记录 / 模拟位置</p>` 替换为 `<Tag variant="secondary">演示记录</Tag>`；将候选匹配 `<article className="card">` 替换为 `<CandidateCard>` 组件；将认领表单 `<section className="card">` 替换为 `<ClaimForm>` 组件；将 `<p role="alert">{error}</p>` 替换为 `<ErrorState>`；将 `<main className="page">加载中…</main>` 替换为 `<LoadingIndicator>`；响应式：移动端单栏、桌面端双栏（基本信息 + 候选/认领）
  - **依赖**：A1（tokens.css）、A5（Card）、A4（Button）、A10（Tag）、A15（StatusBadge）、A12（LoadingIndicator）、A14（ErrorState）、C1（CandidateCard）、C2（ClaimForm）
  - **验证**：`npm run build` 构建通过；`npm run dev` 中详情页功能完整测试：基本信息展示、候选匹配列表（寻物+物主）、认领表单（拾获+学生）、地图位置链接、模拟标识
  - **保留**：保留 useParams 获取 id；保留 useSearchParams 获取 lost 参数；保留 useAuth 获取 role；保留 useEffect 中 /items/:id API 调用；保留寻物 + is_owner → /items/:id/candidates API 调用；保留拾获 + student → /me/items API 调用筛选 lost 列表；保留 requestedLost 自动选中逻辑；保留 key.current 幂等键逻辑（crypto.randomUUID）；保留 submitClaim 函数中 POST /claims 参数（found_item_id/lost_item_id/evidence/idempotency_key）；保留 submitted 防重复提交；保留 key.current 在 id/evidence/lostItemId 变化时重置；保留提交后本地 status 更新为 reviewing

### 33. 重构登录页

- [ ] 重构 `frontend/src/pages/Login.tsx`，将 `<h1>校园寻物局</h1>` 替换为品牌展示区域（品牌名称 + 标语"让每一件失物都有回家的路" + 品牌氛围视觉元素）；将原生 `<input>` 替换为 `<TextInput>`（label 关联、error 提示）；将原生 `<button>` 替换为 `<Button variant="primary">`；将 `<p style={{color:'#dc2626'}}>` error 替换为 TextInput error prop 或 ErrorState；保留 `<Link to="/register">注册</Link>` 切换链接；响应式：移动端 100% 宽度、桌面端 max-width 360px 居中
  - **依赖**：A1（tokens.css）、A4（Button）、A6（TextInput）、A14（ErrorState）
  - **验证**：`npm run build` 构建通过；`npm run dev` 中登录页功能正常：品牌展示、登录表单提交、错误提示、注册链接跳转
  - **保留**：保留 login() 调用逻辑；保留 errorMessage 错误处理；保留 navigate('/') 跳转；保留 Link to /register

### 34. 重构注册页

- [ ] 重构 `frontend/src/pages/Register.tsx`，与登录页保持一致的视觉风格和组件样式；将原生 `<input>` 替换为 `<TextInput>`（用户名/昵称/密码三个字段）；将原生 `<button>` 替换为 `<Button variant="primary">`；将 `<p style={{color:'#dc2626'}}>` error 替换为 TextInput error prop 或 ErrorState；保留 `<Link to="/login">登录</Link>` 切换链接；品牌标识与登录页一致
  - **依赖**：A1（tokens.css）、A4（Button）、A6（TextInput）、A14（ErrorState）
  - **验证**：`npm run build` 构建通过；`npm run dev` 中注册页功能正常：注册表单提交、错误提示、登录链接跳转；视觉风格与登录页一致
  - **保留**：保留 register() 调用逻辑；保留 errorMessage 错误处理；保留 navigate('/') 跳转；保留 Link to /login

### 35. 重构我的委托页

- [ ] 重构 `frontend/src/pages/MyDelegations.tsx`，将 `<h1>我的委托</h1>` 替换为设计系统样式标题；将徽章 `<p>徽章：{badges.map((b) => b.kind).join('、')}</p>` 替换为 Badge 组件醒目展示（圆形图标 + 文字描述）；将"我的发布" `<ul>/<li>` 替换为 ItemCard 组件列表；将"我的认领" `<ul>/<li>` 替换为卡片化列表（ClaimCard 或结构化列表项 + StatusBadge）；将"我的工单" `<ul>/<li>` 替换为 TicketCard 或结构化列表项 + Badge；将地图定位 `<Link>` 替换为 Button variant="secondary" 醒目按钮；将加载/错误状态替换为 LoadingIndicator/ErrorState；响应式：移动端单列、桌面端可双列
  - **依赖**：A1（tokens.css）、A5（Card）、A9（Badge）、A15（StatusBadge）、A4（Button）、A12（LoadingIndicator）、A14（ErrorState）、A18（ItemCard）、C4（TicketCard）、types.ts
  - **验证**：`npm run build` 构建通过；`npm run dev` 中我的委托页功能正常：四个分区数据展示、徽章展示、地图定位链接
  - **保留**：保留 Promise.all 数据加载逻辑（/me/items、/me/claims、/me/tickets、/me/badges）；保留四个分区数据结构；保留地图定位链接逻辑（layer_id && norm_x != null && norm_y != null）

### 36. 重构工单页面

- [ ] 重构 `frontend/src/pages/Tickets.tsx`，将工单列表 `<article className="card">` 替换为 `<TicketCard>` 组件；将学生申请协助区域 `<select>` + `<button>` 替换为 `<SelectInput>` + `<Button variant="primary">`；将工作人员操作按钮替换为统一 Button 样式（接单 variant="primary"、反馈 variant="secondary"、取消 variant="ghost"）；将反馈编辑 `<textarea>` 替换为 `<TextArea>`；将授权路线按钮替换为 `<Button variant="primary">`；将已授权状态 `<p>` 替换为 Badge variant="mint"；将加载/错误状态替换为 LoadingIndicator/ErrorState；将空状态 `<p>暂无工单</p>` 替换为 EmptyState
  - **依赖**：A1（tokens.css）、A4（Button）、A7（SelectInput）、A8（TextArea）、A9（Badge）、A11（EmptyState）、A12（LoadingIndicator）、A14（ErrorState）、C4（TicketCard）、types.ts
  - **验证**：`npm run build` 构建通过；`npm run dev` 中工单页功能正常：学生申请协助、工作人员接单/反馈、授权路线、状态展示
  - **保留**：保留 action() 函数（busy 防重复 + load 刷新）；保留 feedback() 函数；保留 role 条件渲染（student/staff 不同操作）；保留授权路线逻辑（requester + !authorized + !feedback）；保留全部 API 调用路径和参数结构

### 37. 重构认领审核页面

- [ ] 重构 `frontend/src/pages/StaffClaims.tsx`，将页面重构为两栏布局（左侧列表 + 右侧详情），移动端降级为单栏纵向排列；将状态筛选 `<select>` 替换为 `<SelectInput>`；将列表 `<ul>/<li>` 替换为卡片化列表项 + Badge；将详情 `<section className="card">` 替换为 `<ReviewPanel>` 组件；将审核操作按钮替换为 ReviewPanel 内部的统一 Button（通过核验 variant="primary"、拒绝申请 variant="danger"、确认归还 variant="primary"）；将加载/错误状态替换为 LoadingIndicator/ErrorState；将空状态替换为 EmptyState；关联物品链接使用 Button variant="ghost"
  - **依赖**：A1（tokens.css）、A5（Card）、A7（SelectInput）、A9（Badge）、A4（Button）、A11（EmptyState）、A12（LoadingIndicator）、A14（ErrorState）、C5（ReviewPanel）、types.ts
  - **验证**：`npm run build` 构建通过；`npm run dev` 中认领审核页功能正常：两栏布局、状态筛选、证据查看、审核操作（通过/拒绝/确认归还）、权限守卫
  - **保留**：保留 role !== 'staff' 时 `<Navigate to="/" replace />` 权限守卫；保留 open() 函数（Promise.all 加载 detail + found item）；保留 act() 函数（approve/reject/complete 操作 + 列表刷新）；保留全部 API 调用路径和参数结构

### 38. 阶段C集成验证

- [ ] 执行阶段C全面验证：`npm run build` 构建通过；`npm run dev` 中全部页面功能完整测试：地图页（图层切换、4种操作模式、标记色彩、绘制交互、保存、searchParams 聚焦、比例尺提示）；详情页（基本信息、候选匹配、认领表单、幂等键、地图链接、模拟标识）；登录/注册页（品牌展示、表单提交、错误提示、切换链接）；我的委托页（四分区数据、徽章、地图定位）；工单页（申请协助、接单/反馈、授权路线）；认领审核页（两栏布局、状态筛选、证据查看、审核操作、权限守卫）；确认全部 API 调用路径和参数结构与升级前一致
  - **依赖**：C1-C37
  - **验证**：构建通过、全部页面功能测试通过、API 参数结构不变
  - **保留**：全部现有业务功能不退化

---

## 全局验证与收尾

### 39. 响应式布局验证

- [ ] 在 ≤768px（移动端）、769px-1024px（平板）、≥1025px（桌面端）三种尺寸下验证全部页面布局：导航栏切换（TopNav/BottomNav 不同时出现）、卡片列数（mobile 1列/tablet 2列/desktop 3-4列）、地图容器高度（mobile ≥400px/desktop ≥560px）、表单宽度（mobile 100%/desktop max-width 480px）、底部安全间距（mobile padding-bottom 72px）、最小点击区域（mobile ≥44×44px）
  - **依赖**：A1-C38
  - **验证**：三种尺寸下全部页面布局正确
  - **保留**：无

### 40. 可访问性验证

- [ ] 验证全部页面的可访问性：语义化 HTML（header/nav/main/section/article/footer 替换 div）；ARIA 标签保留（现有 role="alert"/role="status"/aria-label 保留，新增交互元素补充 aria-label）；键盘导航（所有按钮/链接/输入框支持 Tab + Enter/Space）；焦点可见（:focus-visible 样式 Primary 色 outline 2px）；色彩对比度（Text on Surface ≥4.5:1、Text Secondary on Surface ≥4.6:1）；表单标签关联（每个 TextInput/SelectInput/TextArea 有关联 label 或 aria-label）
  - **依赖**：A1-C38
  - **验证**：DOM 结构检查、键盘操作测试、对比度工具检查
  - **保留**：保留现有全部 ARIA 属性

### 41. 代码审查与最终确认

- [ ] 执行最终代码审查：确认所有新增 UI 组件 TypeScript 类型完整（无 any）；确认所有组件样式引用设计令牌（无硬编码色值/间距/圆角/阴影，tokens.css 除外）；确认 package.json 无 CSS-in-JS 相关依赖；确认全部 API 调用路径和参数结构与升级前一致；确认 AuthContext/RequireAuth/client.ts 逻辑未修改；确认 App.tsx 路由配置未修改；确认全部现有业务功能不退化
  - **依赖**：A1-C40
  - **验证**：代码审查通过、功能回归测试通过
  - **保留**：全部现有业务逻辑和 API 调用不变

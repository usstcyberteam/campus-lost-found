# Blob 交互集成说明（借鉴 blobmixer.14islands.com）

> 交接文档 · 适用范围：前端 `frontend/` · 本次改动均为**新增**，未修改任何既有业务逻辑

## 1. 研究结论：目标站点的交互特性

`https://blobmixer.14islands.com/` 是 14islands 的 3D blob 玩具（three.js + WebGL，页面自述「A toy for creating and sharing 3D blobs」）。抓取 `index.html / main.js / main.css` 后归纳出 7 条可借鉴的交互特性：

| # | 目标站点实现 | 证据 |
|---|---|---|
| 1 | 全屏 canvas 铺底 + 浮层 UI，UI 可整体淡出 | `.AppCanvasWrapper{position:fixed;inset:中心定位}`、`.AppUI.hidden{opacity:0}` |
| 2 | 指针直接操纵内容（拖拽旋转/塑形） | `pointerdown / pointermove / touchmove` + `OrbitControls` |
| 3 | 底部固定参数面板，参数化调节形态 | `.GUI{bottom:...}`、`.GUI button:hover{background-color:#434343}`；`Color`/`Size`/`Material` 出现百余次 |
| 4 | 随机化与预设 | `Random`（7 处）、`Preset`（2 处） |
| 5 | 保存/分享（复制到剪贴板） | `clipboard`（15 处）、`Share`（2 处）、`Save` |
| 6 | 克制的缓动与 hover 反馈 | `transition:transform .3s var(--ease-circ-out)`、`transition:opacity .4s ease`、`.RemixCTA_hoverTarget` |
| 7 | 加载态用 blob 形变动画表达进度 | `@keyframes blob` 的 `border-radius: 51% 49%/45% 44%` 多值动画 |

## 2. 适配方案与适用场景

用**零依赖的 SVG 2D 软体 blob**复刻上述交互，落到两个低风险位置：

| 集成位置 | 变体 | 说明 |
|---|---|---|
| 登录页 `/login` | `variant="backdrop"` | 装饰性氛围背景；`pointer-events:none`，不拦截表单 |
| AI 页 `/ai` 欢迎区下方 | `variant="card"` | 「可拖拽的 AI 形态」：拖拽塑形 + 形态/配色预设 + 随机 + 复制配方 |

### 交互映射

| 目标站点 | 本项目实现 |
|---|---|
| 指针拖拽塑形（3D 顶点位移） | 指针方向对 8 个控制点施加径向吸引，弹簧（stiffness 120 / damping 12）缓动收敛 |
| 参数面板 Color / Size / Material | chips 预设：形状（圆润/液态/星形）+ 换色（4 组配色）+ 随机；尺寸由随机与形状决定 |
| Randomize | 「随机」按钮：随机 shape / palette / size / seed |
| Save / Share（clipboard） | 「复制配方」：`blob1|shape|palette|size|seed`，失败时降级为文本提示 |
| 缓动与 hover | chips `hover` 边框加深、`aria-pressed` 选中态（主色 + 浅底），与现有设计系统一致 |
| 加载 blob | 未替换现有 `LoadingState`（避免影响既有页面的加载表现），仅新组件内部使用 |

## 3. 关键代码位置与调用关系

```
frontend/src/components/BlobStudio/
├─ blobMath.ts        纯函数：smoothClosedPath / springStep / computeTargetRadii / makeRandom / encodeRecipe / decodeRecipe
├─ BlobStudio.tsx     组件：RAF 循环 + 指针交互 + 控件
└─ BlobStudio.module.css

frontend/src/pages/Login.tsx        新增 <BlobStudio variant="backdrop" />
frontend/src/pages/Login.module.css .container 增加 position:relative; z-index:1（保证表单在背景之上）
frontend/src/pages/AiPage.tsx       新增 <BlobStudio ariaLabel="可拖拽塑形的 AI 形态" />
```

调用链：

```
Login / AiPage
  └─ BlobStudio
       ├─ stageRef ── ResizeObserver ── 更新 sizeRef（w/h）
       ├─ RAF loop(dt, t) ── draw()
       │     ├─ SHAPE_FACTOR[shape] → computeTargetRadii(base, amplitude, phaseRef, t, freq)
       │     ├─ pointerRef（pointerdown/move 时写入，dragging 时增强 0.4 / 悬停 0.18）
       │     ├─ springStep(...) 逐点收敛 → BlobPoint[]
       │     └─ smoothClosedPath(points) → pathRef.setAttribute('d', ...)   // 不经 React 重渲染
       └─ 控件 onClick → setShape / setSize / setSeed / setPaletteIndex / randomize / copyRecipe
```

要点：
- 路径通过 **DOM 直接 `setAttribute`** 更新，避免 60fps 的 React 重渲染；
- 相位（`phaseRef`）由 `seed` 决定 ⇒ 相同种子 = 相同形态（可复现）；
- 清理完备：卸载时 `cancelAnimationFrame` + 移除 `matchMedia`/`visibilitychange` 监听 + `ResizeObserver.disconnect()`。

## 4. 与既有交互方案的差异、优缺点与兼容性

### 差异
- **维度**：目标站点是 WebGL 3D（噪声顶点位移 + OrbitControls 旋转）；本项目是 SVG 2D 软体，无 3D 旋转。
- **渲染**：WebGL canvas ↔ SVG path + 弹簧物理。
- **参数自由度**：自由滑块 ↔ chips 预设（与项目现有 chips 语言一致）。
- **分享对象**：图片/链接 ↔ 配方字符串（可粘贴复现）。

### 优点
- **零新增依赖**（不引入 three.js，构建体积与 Docker 镜像不受影响）；
- 与浅色设计系统（`--color-*` / `--radius-*`）天然一致，不像 3D 玩具那样需要深色沉浸式界面；
- 无障碍友好：控件为原生 button + `aria-pressed`，装饰层 `aria-hidden`；
- 尊重 `prefers-reduced-motion`：不跑动画循环，改为**静态跟随**（拖动仍即时更新）；
- 对既有功能零侵入：`/login` 背景为 `pointer-events:none`，仅新增节点。

### 缺点 / 取舍
- 视觉冲击力弱于 3D blob（这是有意为之，避免喧宾夺主）；
- 参数只能是预设组合，不能像 GUI 那样连续调参；
- 每个实例独占一个 RAF（当前每页 ≤1 个实例，影响可忽略）。

### 兼容性
- 现代浏览器全支持（SVG path、Pointer Events、`ResizeObserver`）；若 `ResizeObserver` 缺失自动回退 `window resize`；
- 无构建/部署变化（无新依赖、无新增环境变量、无后端改动）；
- 不影响 SSR（纯 CSR）、不影响既有 API 与数据库。

## 5. 自检循环记录（一轮完整回归）

| 检查项 | 方法 | 结果 |
|---|---|---|
| 纯函数单测 | esbuild 打包 `blobMath.ts` + Node 断言 | **10/10 通过**（收敛性、NaN/Infinity 防护、往返编解码、非法配方） |
| 类型/lint/构建 | `tsc -b` / `eslint` / `vite build` | 全绿（0 error / 0 warning） |
| 登录页背景 | CDP 检查 backdrop 渲染、`pointer-events:none`、输入框可聚焦 | 通过；**真实提交表单登录成功 → `/hall`** |
| AI 页交互 | CDP 派发 pointer 事件 + 点击控件 | 拖动塑形生效、星形/换色/随机均生效、配色值变化、键盘可达 |
| 减少动效 | CDP `Emulation.setEmulatedMedia(prefers-reduced-motion: reduce)` | 静态渲染正常；**拖动“静态跟随”精确断言通过** |
| 极小视口 | `setDeviceMetricsOverride 320×480` | 背景与卡片均正常渲染 |
| 卸载/泄漏 | 连续在 `/ai ↔ /hall/map/me` 往返 7 次 | 0 异常（RAF/监听清理有效） |
| 全站回归 | 12 个页面（含 admin/staff 页）遍历 | 0 运行时异常、0 个 4xx/5xx |
| 关键流程回归 | 真实登录 / 地图图层切换（历史白屏点）/ 发布流程 | 全部通过（发布后新帖出现在大厅） |
| 后端回归 | `pytest` | **170 passed, 1 skipped** |

**自检中发现并修复的真实缺陷（1 处）**：
`setPointerCapture` 在指针已被释放或事件为合成事件时抛 `NotFoundError`，会中断拖拽逻辑并在控制台报错。
修复：`frontend/src/components/BlobStudio/BlobStudio.tsx` 对 `setPointerCapture / releasePointerCapture` 加 `try…catch`，失败时以“未捕获模式”继续拖拽。修复后同一用例异常数由 1 → **0**。

## 6. 已知限制与潜在风险

1. **`prefers-reduced-motion` 下无补间动画**：仅静态跟随（设计如此，避免动效）。
2. **剪贴板降级**：无权限/非安全上下文时 `navigator.clipboard` 不可用，会显示可手动复制的配方文本（非静默失败）。
3. **同一页面多实例**：每个实例各自一个 RAF；如未来在同页放多个 card，建议抽出共享调度器。
4. **相位可复现性**：手动「随机」使用时间种子（不可复现）；如需完全复现请使用「复制配方」（`decodeRecipe` 已实现，UI 尚未接入导入）。
5. **SVG `drop-shadow` 滤镜**在极低端设备上可能有额外开销；已在 reduced-motion 分支关闭滤镜。
6. 装饰背景为 `position: fixed`，若后续某个页面在其上叠加组件，需注意 `z-index` 层级（登录页已显式处理）。

## 7. 后续维护与扩展建议

- **接入配方导入**：在卡片增加一个粘贴框，调用已实现的 `decodeRecipe()` 应用他人配方（零新增逻辑风险）。
- **共享动效调度器**：把 RAF 提到一个 `useRaf` hook，多实例共用一次循环。
- **主题联动**：把 `PALETTES` 改为读取 CSS 变量，让 blob 配色随主题/角色（工作人员/管理员）变化。
- **可选的加载态升级**：若希望统一加载动画，可用 blob 形变替换 `Spinner`，但需评估对既有页面的视觉回归（当前未做，避免影响既有表现）。
- **回归测试脚本**：本次使用的 CDP 自检脚本（登录/地图/发布 + Blob 交互 + reduced-motion + 小视口）建议纳入 CI 前的手工回归清单。
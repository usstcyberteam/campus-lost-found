# 留痕清单：06-全局悬浮AI助手

| 文件 | 说明 | 状态 |
|---|---|---|
| 01-会话摘要.md | 三轮开发记录：悬浮窗实现 → 3 项 BUG 修复 → P0-P4（含 P0 根因：effect 双数据源 + StrictMode 双挂载副作用竞态） | ✅ 已更新 |
| 02-git-diff.txt | 全部前后端改动差异（1457 行） | ✅ 已更新 |
| 03-pytest.txt | test_ai_chat + test_ai_draft 输出（20 passed） | ✅ 已更新 |
| 截图-预填成功 | 需手动截图：跳转后发布页字段填入 + 提示 | ⚠️ 需手动截图 |
| 截图-右侧吸附 | 需手动截图：右侧停靠 + 聊天窗朝内弹出 | ⚠️ 需手动截图 |
| 截图-整理草稿 | 需手动截图：按钮 + 确认气泡 | ⚠️ 需手动截图 |
| 截图-地点推荐 | 需手动截图：地点框聚焦 chips | ⚠️ 需手动截图 |
| 截图-规则模式 | 需手动截图：AI 气泡"（规则模式）"角标 | ⚠️ 需手动截图（可选） |

**提醒：截图不得包含 .env 内容。**

## P0 根因（第三轮，最终定论）

ItemForm 预填 effect 解析用 `window.location.search`，同 effect 末尾 `replaceState` 清空地址栏。StrictMode 双挂载：第一挂载解析成功+清 URL（副作用持久），state 随卸载重置；第二挂载读 `window.location.search` 已空 → 解析 null → 表单空白。修复：解析统一用 react-router `location.search`（不受 replaceState 影响，幂等）。

## 组件挂接说明

- 全局挂载：`App.tsx` Routes 平级 `<AiFloatWidget />`；/login、/register、/admin/* 隐藏
- 预填链路：聊天 form_patch → toast 点击 → `navigate('/publish?ai_prefill=<encoded>')` → ItemForm effect（deps `[editing, location.search]`）解析 router search → 只填空字段 → replaceState 清地址栏
- 位置持久化：localStorage `ai-float-pos-side` 存 `{side, y}`（双侧吸附）
- API：`aiChat(message, page?, action?)`、`suggestLocations(keyword?)`（均走后端，JWT 自动附加）

## 本轮（P0-P4）代码改动

- 前端：ItemForm.tsx（P0 修复 + P3 chips）、ItemForm.module.css、AiFloatWidget.tsx（P1/P2/P4）、AiFloatWidget.module.css、api/ai.ts
- 后端：schemas/ai.py、api/v1/ai.py、services/ai_service.py、tests/test_ai_chat.py（+6 用例）

## 验证结论

- 后端全量 184 passed / 1 skipped（零回归）；专项 20 passed；ruff 通过
- npm run build 通过；Node 模拟双挂载验证 P0 修复前后行为
- 实测：action=draft 强制提取、suggest-locations 频次排序均正常
- 浏览器 5 项手动验证待用户执行（见 01-会话摘要.md）
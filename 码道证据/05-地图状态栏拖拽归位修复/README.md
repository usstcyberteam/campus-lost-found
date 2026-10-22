# 留痕清单：05-地图状态栏拖拽归位修复

- 日期：2026-10-22
- 分支：feature/ai-model
- 任务：修复地图页底部状态栏（抽屉）拖拽松手后不能有效归位的 BUG

## 文件清单

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| 01-会话摘要.md | 已生成 | 根因、改动行号、验证结果、截图清单 |
| 02-git-diff.txt | 已生成 | 完整 git diff（含本分支此前 AI chat 会话的未提交改动，本次会话仅涉及其中 frontend/src/pages/MapView.tsx 与 MapView.module.css 两段） |
| 03-pytest.txt | 已生成（内容为"未执行"及原因） | 沙箱拦截 + 本次纯前端改动 |
| README.md | 已生成 | 本清单 |

## 本次代码改动

- frontend/src/pages/MapView.tsx（抽屉三态 + 跟手拖拽 + 吸附归位 + click 抑制）
- frontend/src/pages/MapView.module.css（.drawerHalf / .drawerDragging）

## 截图要求（需手动截图）

1. 终端 npm run lint / npm run build 输出 —— 需手动截图
2. 终端 pytest（用户本地补跑）—— 需手动截图
3. 浏览器：抽屉收起态 —— 需手动截图
4. 浏览器：拖拽跟手过程 —— 需手动截图
5. 浏览器：松手吸附半开/展开/收起 —— 需手动截图

提醒：截图不得包含 .env 内容。

## 手动验证步骤

1. `cd frontend && npm run dev` 打开地图页
2. 拖拽：按住抽屉把手向上/向下拖，确认高度实时跟手且不选中文字
3. 松手：分别停在收起/半开/展开高度附近，确认吸附到最近档位（不自由飞）
4. 再唤起→再拖：点把手或标签页唤起展开，再次拖拽归位，确认无"跳回原处"
5. 快速甩动：确认高度被 clamp 在 [190px, 68vh]（桌面 [220px, 72vh]）内
6. 回归：地图点击、缩放、拖动、建筑标记、绘制工具不受影响
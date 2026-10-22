# 留痕清单：05-AI助手小窗

| 文件 | 说明 | 状态 |
|---|---|---|
| 01-会话摘要.md | 会话目标、修改文件与行号、降级分支位置、验证结果 | ✅ 已生成 |
| 02-git-diff.txt | 本次全部代码差异（含新增测试文件，600 行） | ✅ 已生成 |
| 03-pytest.txt | pytest tests/test_ai_chat.py + test_ai_draft.py 输出（13 passed） | ✅ 已生成 |
| 04-403重试验证.md | 403 排查过程、端到端真实模型验证、conftest 测试隔离修复 | ✅ 已生成 |
| 截图-终端pytest | 需手动截图：pytest 通过画面 | ⚠️ 需手动截图 |
| 截图-AI助手页 | 需手动截图：聊天回复 + "已帮你预填"提示 + 整理结果卡片 | ⚠️ 需手动截图 |
| 截图-实时模型 | 模型已接通：整理结果卡片显示"实时模型"标签（现在可拍） | ⚠️ 需手动截图 |

**提醒：截图不得包含 .env 内容。**

## 代码改动清单（详见 02-git-diff.txt）

- backend/app/schemas/ai.py、backend/app/services/ai_service.py、backend/app/api/v1/ai.py、backend/tests/test_ai_chat.py（新增）
- frontend/src/types.ts、frontend/src/api/ai.ts、frontend/src/components/AiChat/AiChat.tsx、frontend/src/components/AiChat/AiChat.module.css、frontend/src/pages/AiPage.tsx

## 状态

- 后端 177 passed / 1 skipped（全量回归零失败）
- 前端 npm run build 通过
- ✅ 模型 403 已自行恢复（网关临时故障），真实模型调用全链路打通：chat（draft/chat 两种意图）、draft-post 均 source=model / degraded=false
- 顺带修复 tests/conftest.py 测试隔离（autouse disable_model fixture），杜绝测试真实调用外部模型
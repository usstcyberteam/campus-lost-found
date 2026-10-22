# 留痕清单：07-系统提示词优化

| 文件 | 说明 | 状态 |
|---|---|---|
| 01-会话摘要.md | 提示词优化过程、两场景实测结果、幻觉日期修复 | ✅ 已生成 |
| 02-git-diff.txt | ai_service.py + test_ai_chat.py 完整差异（396 行，含上次会话未提交部分） | ✅ 已生成 |
| 03-pytest.txt | test_ai_draft + test_ai_chat 输出（15 passed） | ✅ 已生成 |
| 截图-模糊引导 | 需手动截图："刚才掉了一把伞"的引导回复（无预填） | ⚠️ 需手动截图 |
| 截图-完整预填 | 需手动截图：补全描述后"已帮你预填"提示 + 整理结果卡片 | ⚠️ 需手动截图 |

**提醒：截图不得包含 .env 内容。**

## 本次代码改动

- backend/app/services/ai_service.py：`_CHAT_SYSTEM_PROMPT` 重写、新增 `_chat_form_patch`（仅提取明确信息）、`_chat_messages` 注入当前时间
- backend/tests/test_ai_chat.py：新增 2 用例（模糊引导、未提及字段不填充）

## 验证结论

- 真实模型实测：模糊描述 → 引导不预填；完整描述 → 确认 + 完整 form_patch（floor/时间均正确）
- 单测 15 passed；全量回归 179 passed / 1 skipped 零回归
- 降级机制未动，模型不可用仍走规则路径（接口 200）
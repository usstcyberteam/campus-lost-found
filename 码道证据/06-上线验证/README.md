# 留痕清单：06-上线验证

| 文件 | 说明 | 状态 |
|---|---|---|
| 01-会话摘要.md | 四步验证过程、改动文件、结论 | ✅ 已生成 |
| 02-git-diff.txt | 本次上线适配改动（compose/Dockerfile/nginx.conf/vite.config.ts/部署清单，197 行） | ✅ 已生成 |
| 03-pytest.txt | test_ai_chat + test_ai_draft 输出（13 passed） | ✅ 已生成 |
| 截图-实时模型 | 需手动截图：AI 助手页「实时模型」标签 + 预填提示 | ⚠️ 需手动截图 |
| 截图-pytest | 需手动截图：终端全量 177 passed | ⚠️ 需手动截图 |
| 截图-docker | （部署方）docker compose ps 三容器运行画面 | ⚠️ 需手动截图 |

**提醒：截图不得包含 .env 内容。**

## 本次代码改动

- docker-compose.yml（backend 环境变量透传 + frontend 端口 5173:80）
- frontend/Dockerfile（多阶段构建：node build → nginx serve）
- frontend/nginx.conf（新增：/api 转发 + SPA 回退 + 静态缓存）
- frontend/vite.config.ts（补 preview.proxy）
- docs/部署检查清单.md（新增）

## 验证结论

- 全量回归 177 passed / 1 skipped
- 前端 build 成功；本地模拟生产（uvicorn 0.0.0.0 + preview）全链路实测真实模型 source=model
- 发帖数据流（chat → form_patch → 创建物品）验证通过
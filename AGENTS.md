# 校园寻物局

校园失物协作平台（参赛项目）。角色为学生与工作人员；主流程：发布寻物/拾获 → 候选推荐 → 私密认领证据 → 工作人员核验 → 确认归还；无候选时转协助工单。

## 技术栈

React + TypeScript（Vite + Leaflet 图片地图）· FastAPI · PostgreSQL · Docker Compose。单体架构，不训练模型、不引入独立向量数据库或真实视频。

## 目录

- `backend/`：FastAPI 应用（`app/api/v1/*` 路由、`app/models` 实体、`app/core` 鉴权、`tests/` 验收测试）
- `frontend/`：React 前端（`src/pages` 页面、`src/api` Axios、`src/auth` 鉴权上下文）
- `competition-plan/`：项目说明、需求、架构、验收清单、阶段提示词
- `.codeartsdoer/specs/campus_lost_found/`：`spec.md`（需求）、`design.md`（架构）、`tasks.md`（任务规划）

## 开发命令

- 后端：`cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt`
- 后端启动：`cd backend && .venv/Scripts/uvicorn app.main:app --reload`（先 `python seed.py` 初始化管理员与图层）
- 后端测试：`cd backend && .venv/Scripts/python -m pytest tests/ -q`
- 前端：`cd frontend && npm install && npm run dev`
- 前端构建：`cd frontend && npm run build`
- 整体：`docker compose up --build`

## 业务约束（必须遵守）

1. 学生与工作人员权限必须在后端执行，工作人员不能自行注册获取（仅管理员创建）。
2. 路线默认私密；认领证据和联系信息不进入公共接口。
3. AI 只能提取与推荐，不能批准认领或确认归还。
4. 同一物品只能完成一次归还（事务 + 行锁 + 条件更新）。
5. 模拟点位、规则推荐、缓存和实时模型结果分别标识来源。
6. 未标定比例尺的地图不输出实际米数。
7. 不接入真实监控，不编造需求依据、开发记录、使用记录和测试结果。
8. 模型故障不能阻断手动发布、筛选和归还。
9. 路线只有主动授权且工单分配后，处理人员才能访问。
10. 密钥只存后端，不出现在代码、日志、截图或对话中。

## 状态机

- 寻物：寻找中 → 核验中 → 已找回 / 已撤销
- 拾获：待认领 → 核验中 → 已归还 / 已撤销
- 认领：待审核 → 已通过 → 已完成 / 已拒绝
- 工单：待接单 → 处理中 → 已反馈

## 验收

- 需求规格见 `spec.md`，架构见 `design.md`，任务见 `tasks.md`。
- EARS 验收场景与权限矩阵已在三份文档中定义。
- 测试集中在 `backend/tests/test_acceptance.py`，覆盖权限、私密字段、归还唯一性、工单授权。
## 代码规范

开发必须遵守 docs/代码规范.md。
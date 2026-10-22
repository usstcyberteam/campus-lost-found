# 校园寻物局

<p>
  <img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node 18+">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18">
  <img src="https://img.shields.io/badge/FastAPI-0.142-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/tests-184%20passed%20%2F%201%20skipped-brightgreen" alt="tests">
</p>

校园失物招领协作平台（参赛项目）：学生与工作人员协作完成「发布寻物/拾获 → 候选推荐 → 私密认领证据 → 工作人员核验 → 确认归还」全流程，集成 AI 智能助手，支持自然语言发帖、表单预填与历史地点推荐。

## ✨ 功能特性

- **失物/拾获发布与浏览**：分类筛选、关键词搜索、物品详情、编辑与删除
- **地图可视化**：Leaflet 图片地图展示失物位置，室内外图层切换、坐标查看、工作人员模拟点位
- **认领与核验流程**：私密认领证据提交（不进入公共接口）、工作人员审核、事务 + 行锁保证同一物品仅完成一次归还
- **协助工单**：无候选时转协助工单，接单授权、处理反馈闭环
- **社区互动**：评论（含审核）、点赞、表扬墙、积分体系
- **运营管理**：数据统计、用户管理、公告发布、工作人员账号管理（仅管理员创建）
- **全局 AI 悬浮助手**
  - 自然语言描述自动提取信息（标题、分类、地点、楼层、时间等）
  - 智能跳转 + 表单预填（只填空字段，绝不覆盖用户手写）
  - 一句话整理为发布草稿
  - 历史地点推荐（频次 top5）
  - 模型不可用时自动降级为规则模式，不阻断手动发布
- **用户认证与权限管理**：JWT 鉴权，学生/工作人员/管理员三角色，权限全部在后端执行
- **响应式设计**：适配桌面与移动端

## 🛠 技术栈

### 前端

- React 18 + TypeScript 5.6
- React Router 7
- CSS Modules
- Vite 7
- Leaflet（图片地图）
- Axios

### 后端

- FastAPI 0.142（Python，`app/api/v1` 分层路由）
- SQLAlchemy 2.1 + Alembic（迁移）
- Pydantic 2.13 + pydantic-settings（`.env` 环境变量注入）
- Uvicorn
- PostgreSQL（生产）/ SQLite（本地演示）
- PyJWT + bcrypt

### AI

- OpenAI 兼容 API（通过学校代理接入 DeepSeek-V4-Flash）
- 规则降级引擎（模型不可用时兜底，结果以 `source`/`degraded` 字段标识来源）

## 🚀 快速开始

### 前置要求

- Python 3.11+
- Node.js 18+
- Git

### 配置环境变量

复制 `backend/.env.example` 为 `backend/.env`，填写以下必填项：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DATABASE_URL | 数据库连接 | `sqlite:///./app.db`（本地）/ `postgresql+psycopg://campus:campus@localhost:5432/campus` |
| JWT_SECRET | JWT 签名密钥（至少 32 字符） | 随机字符串 |
| ADMIN_PASSWORD | 管理员初始密码 | 自行设置 |
| MODEL_BASE_URL | 模型 API 地址（OpenAI 兼容，填到 `/v1`） | `https://aiapi.usst.edu.cn/v1` |
| MODEL_NAME | 模型名称 | `deepseek-v4-flash` |
| MODEL_API_KEY | 模型 API 密钥 | 从平台获取 |
| MODEL_DISABLED | 是否禁用模型（禁用则走规则降级） | `false` |
| MODEL_TIMEOUT_SECONDS | 模型超时（秒） | `10` |
| CORS_ORIGINS | 跨域白名单 | `["http://localhost:5173"]` |

> ⚠️ `.env` 已在 `.gitignore` 中排除，**请勿提交到版本控制**；密钥不得进入日志、截图或文档。

也可在根目录运行 `python scripts/configure_local.py` 自动生成根目录 `.env`（Compose）与 `backend/.env`（本地 SQLite），脚本保留已有配置且不打印凭据。

### 后端启动

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/macOS
pip install -r requirements.txt
.venv/Scripts/python -m alembic upgrade head   # 建表
.venv/Scripts/python seed.py                    # 初始化管理员与图层
.venv/Scripts/uvicorn app.main:app --reload --port 8000
```

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。学生可在网页注册；管理员用户名 `admin`（密码为 `ADMIN_PASSWORD` 配置值）；工作人员须由管理员通过 `POST /api/v1/admin/staff` 创建。

### Docker Compose（可选）

```bash
python scripts/configure_local.py
docker compose up --build
```

前端 `5173`、后端 `8000`、PostgreSQL `5432`，数据保存在命名卷。

## 📖 AI 助手使用说明

1. 登录后任意页面左侧（或右侧）可见 AI 助手停靠条，可上下拖动，松手自动吸附到较近一侧边缘，位置刷新保留
2. 点击停靠条展开聊天框，输入物品描述（如「今天在图书馆 3 楼丢了蓝色折叠伞」）
3. AI 自动提取关键信息（标题、分类、地点、楼层、时间），信息不足时引导补充，不强行预填
4. 信息完整时 AI 提示跳转发布页，点击跳转后表单自动预填（只填空字段，不覆盖手写内容），确认即可提交
5. 也可使用「📝 整理为发布草稿」按钮，一句话一键生成结构化草稿
6. 发布页地点输入框聚焦时，展示历史高频地点推荐，点击即可填入
7. 模型不可用时 AI 回复自动附带「规则模式」标识，功能不中断

核心数据流：用户输入 → `POST /api/v1/ai/chat` → `form_patch`（结构化字段）→ URL query 跳转 → `ItemForm` 解析预填 → 读取后自动清除 query。

## 🧪 测试

```bash
cd backend
.venv/Scripts/python -m pytest tests/ -q
.venv/Scripts/python -m ruff check .
```

```bash
cd frontend
npm run lint
npm run build
```

当前验证（2026-10-22）：后端 **184 passed / 1 skipped**（SQLite 默认跳过 PostgreSQL 并发用例）；前端 lint 与生产构建通过。并发用例需创建以 `_test` 结尾的专用 PostgreSQL 数据库并通过 `TEST_DATABASE_URL` 指定。

## 📁 项目结构

```
backend/                  FastAPI 应用
  app/api/v1/             路由层（auth、items、claims、tickets、ai、admin 等 19 个模块）
  app/services/           业务层（认领、匹配、工单、AI、统计、积分等）
  app/models/             SQLAlchemy 实体与枚举
  app/schemas/            Pydantic 请求/响应模型
  app/core/               鉴权、配置、安全
  alembic/                数据库迁移
  tests/                  验收测试（含 AI chat 用例）
frontend/                 React 前端
  src/pages/              页面（大厅、地图、发布、AI、我的、表扬墙、管理等）
  src/components/         组件（AiFloat 全局悬浮助手、AiChat、CampusMap 等）
  src/api/                Axios 接口封装
  src/auth/               鉴权上下文
scripts/                  本地配置生成脚本
docs/                     开发文档与部署检查清单
competition-plan/         参赛规划与需求资料
```

## 📝 开发分支

- 主分支：`main`
- AI 功能分支：`feature/ai-assistant-global-v1`（全局悬浮 AI 助手完整功能，含交接文档）

## 🔒 安全与密钥说明

**密钥与配置**

- 本项目 AI 功能通过后端代理调用模型，**前端不持有任何 API Key**
- 密钥配置在 `backend/.env`（参考 `backend/.env.example` 占位值填写）
- 以下文件禁止提交：`.env`、`*.key`、`secrets/`（均已在 `.gitignore` 排除）
- 模型调用链路：前端 → 后端 `/api/v1/ai/chat` → 学校代理/模型网关
- 如 Key 泄露：去模型平台重置 → 更新 `.env` → 无需改代码

**业务安全设计**

- 权限全部在后端执行；工作人员不能自行注册，仅管理员创建
- 认领证据与联系方式不进入公共接口；路线仅本人授权且工单分配后可访问
- 归还唯一性：事务 + advisory lock + 行锁 + 条件更新
- AI 只做提取与推荐，不批准认领、不确认归还；结果来源明确标识
- 未标定比例尺的地图不输出实际米数；不接入真实监控
- 完整保密规则见 [docs/代码规范.md](docs/代码规范.md)「AI 密钥与敏感配置保密规则」

## 📄 许可证

待定（参赛项目）。

## 👥 贡献者

校园寻物局开发团队（AI 模块 / 地图与 UI / 后端流程）。

## 🔗 相关链接

- [评估与修订记录](docs/基础版评估与修订记录.md)
- [部署检查清单](docs/部署检查清单.md)
- [参赛规划入口](competition-plan/README.md)

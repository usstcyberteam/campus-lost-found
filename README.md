# 校园寻物局

校园失物协作平台基础版：学生发布寻物/拾获、查看规则候选、提交私密证据；工作人员审核申请并确认归还，或通过协助工单记录核查结果。

技术栈：React 18 + TypeScript + Vite + Leaflet、FastAPI、PostgreSQL、Docker Compose。SQLite 仅用于本地基础演示和非并发测试。

## 当前能力与边界

- 已实现：登录注册、发布与筛选、规则候选、认领、私密证据、工作人员审核归还、工单接单授权与反馈、我的委托。
- 地图：一个室外底图与两个室内图层元数据，支持切换、坐标查看和工作人员模拟点位。室内尚未提供底图。
- 尚未实现：图片上传与理解、真实模型调用、特征确认、语义匹配、委托地图标记、范围与路线绘制、完整游戏化视觉。
- 推荐当前明确标为规则；特征提取适配器明确返回手动降级。排序不代表找回概率，AI 不决定所有权。
- 工作人员必须由管理员创建；公开接口不返回认领证据或联系方式。路线须由本人授权且工单分配后才供处理人员访问。

本次修订内容及实际检查见[评估与修订记录](docs/基础版评估与修订记录.md)。完整参赛目标见[规划入口](competition-plan/README.md)；规格和任务文档是设计资料，不代表所有功能均已完成。前端界面已按 Campus Pulse 设计系统重构，范围、设计决策与已知偏差见[UI 交接说明](docs/UI交接说明-CampusPulse.md)；游戏化机制仍未实现。

## 本地运行（Windows PowerShell）

需要 Python 3.13 和 Node.js 22.12+；仓库不包含实际密钥、数据库、用户记录或运行日志。

在项目根目录生成本地配置，保留已有配置且不打印凭据：

```powershell
python scripts/configure_local.py
```

脚本生成根目录 `.env`（Compose）及 `backend/.env`（本地 SQLite）。管理员用户名为 `admin`；对应密码在各环境文件的 `ADMIN_PASSWORD` 中。本地与 Docker 环境各用自己的数据库与配置。

后端：

```powershell
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python seed.py
.venv/Scripts/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

另一终端启动前端：

```powershell
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

打开 `http://127.0.0.1:5173`。首次初始化创建管理员与三个图层；重复初始化不会覆盖已有管理员密码。

创建工作人员：打开 `http://127.0.0.1:8000/docs`，调用 `POST /api/v1/auth/login` 登录管理员，将返回的令牌填入 Swagger 的 Authorize，再调用 `POST /api/v1/admin/staff`，提供用户名、昵称及自行设置的密码。学生可在网页注册。工作人员登录后进入“认领审核”。

JWT 密钥至少 32 字符；用户密码至少 6 字符且 UTF-8 编码最多 72 字节。环境配置不提交，密钥不得进入日志、截图或开发记录。

## Docker Compose

Docker 引擎运行后，在根目录执行：

```powershell
python scripts/configure_local.py
docker compose up --build
```

前端端口 `5173`，后端端口 `8000`，PostgreSQL 端口 `5432`。前端代理使用 `http://backend:8000`；本地默认 `http://localhost:8000`，可用 `API_PROXY_TARGET` 覆盖。

PostgreSQL 数据保存在命名卷。本配置供本地开发与演示使用，尚不是公网部署方案。

## 验证命令

```powershell
cd backend
.venv/Scripts/python -m pytest tests/ -q
```

SQLite 默认跳过 PostgreSQL 并发用例。验证并发时，先创建**以 `_test` 结尾的专用 PostgreSQL 数据库**，然后设置 `TEST_DATABASE_URL` 再运行测试；测试会清空该数据库内本项目的表，不能指向应用数据库。

```powershell
cd frontend
npm run build
npm audit
```

当前验证：18 项后端测试通过，1 项 PostgreSQL 并发测试跳过；前端构建、依赖审计、Compose 配置语法和浏览器归还流程通过。Docker 引擎无法连接，容器运行、PostgreSQL 并发及全新环境安装未验证。

## 工程说明

- 认领写操作在 PostgreSQL 使用事务级 advisory lock 串行化，并锁定关联物品，再条件更新归还状态。此方案优先保证基础版正确性，尚未针对高并发优化。
- 不新增数据库字段；已有示例库中的重复候选历史记录不会自动清理，新的候选查询不再写入重复记录。
- 当前新环境由 `seed.py` 建表；尚无正式 Alembic 版本迁移，不宣称支持生产升级。
- 本轮修复使用 Codex，不能作为华为云码道使用证明。参赛材料中的码道证据必须来自团队真实任务记录。

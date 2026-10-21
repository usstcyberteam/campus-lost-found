# 校园寻物局 · 阶段3 编码任务规划（tasks.md）

| 项 | 内容 |
|---|---|
| 项目 | 校园寻物局（校园失物协作平台） |
| 阶段 | 阶段3：编码任务规划 |
| 特性名 | `campus_lost_found` |
| 写入路径 | `.codeartsdoer/specs/campus_lost_found/tasks.md` |
| 上游输入 | `spec.md` v2.0 + `design.md` v2.0；v1.0 的 T01–T24 与 2.11–2.16 细化仍作为基线保留 |
| 状态 | v2.0（2026-10-18，新增第 13 章 F1–F16 v2.0 功能任务；v1.0 任务保留） |

> **v1.0 → v2.0 任务变更说明**：第 1–12 章的 T01–T24 是 v1.0 已落地或已细化的基线，继续有效，不重做。第 13 章按 `spec.md` v2.0 与 `design.md` 2.17–2.25 增量拆分为 F1–F16，覆盖教职工、导航重构、上传、互动、积分、地图增强、AI、演示数据、我的页面、生产部署与全流程回归。v1.0 中与 v2.0 冲突的字段/页面（如 `route.is_private`、`Home.tsx`、顶部导航）在第 13 章对应任务内改造，既有认领、核验、归还、协助工单行为与测试不得改变。

## 0. 约定与负责人

| 代号 | 负责人 | 职责范围 |
|---|---|---|
| **A** | 前端/地图/交互 | React 工程、Leaflet 图片地图、大厅/发布/认领/委托/工单页 |
| **B** | 后端/权限/数据库/状态/部署 | FastAPI 骨架、认证鉴权、状态机、脱敏、事务、工单、徽章、Docker |
| **C** | AI/评估/证据/演示 | 特征提取、候选匹配、来源标识、评估证据卡、演示脚本、Rules/Skill、验收 |

**后端先行原则**：B 的接口契约是 A/C 的前置。
**目录约定**：`backend/`（FastAPI）、`frontend/`（React+TS）、根目录 `docker-compose*.yml`、`.env`（入 `.gitignore`）。

## 1. 里程碑与交付节奏

| 里程碑 | 时间窗口 | 可运行版本目标 | 主导任务 |
|---|---|---|---|
| **M0 后端可跑** | 第 1–2 天 | `docker compose up` 后后端可 `/health`，12 表迁移成功 | T01–T04 |
| **M1 业务闭环** | 第 3–4 天 | 后端"发布→列表→详情→认领→核验→归还"闭环可 curl | T05–T07 |
| **M2 前端闭环+地图** | 第 5–6 天 | 前端大厅/发布/认领可用，地图标点/圈选/路线渲染 | T08–T10 |
| **M3 AI+工单** | 第 7–8 天 | 候选推荐（含降级）+ 协助工单协作闭环 | T11–T15 |
| **M4 收尾+验收** | 第 9–10 天 | 徽章、评估证据卡、demo 部署、Rules/Skill、EARS 验收 | T16–T19 |

## 2. 任务依赖图

```mermaid
flowchart LR
  subgraph M0
    T01[T01 后端骨架 B] --> T02[T02 数据模型 B]
    T02 --> T03[T03 认证鉴权 B]
    T03 --> T04[T04 前端骨架 A]
  end
  subgraph M1
    T03 --> T05[T05 物品发布 B]
    T05 --> T06[T06 认领归还 B]
    T05 --> T07a[T07 大厅/发布/详情 A]
    T04 --> T07a
  end
  subgraph M2
    T02 --> T08[T08 地图后端 B]
    T08 --> T09[T09 地图前端 A]
    T06 --> T10[T10 认领/委托页 A]
    T07a --> T10
  end
  subgraph M3
    T05 --> T11[T11 特征提取 C]
    T11 --> T12[T12 候选匹配 C]
    T12 --> T13[T13 候选UI A]
    T02 --> T14[T14 工单后端 B]
    T14 --> T15[T15 工单UI A]
    T09 --> T15
  end
  subgraph M4
    T06 --> T16[T16 徽章聚合 B]
    T14 --> T16
    T12 --> T17[T17 评估证据卡 C]
    T02 --> T18[T18 Docker 部署 B]
    T01 --> T19[T19 验收 C]
    T16 --> T19
    T17 --> T19
    T18 --> T19
  end
```

## 3. 任务明细总表

| ID | 标题 | 负责人 | 前置依赖 | 关联接口/实体 | 关联 EARS |
|---|---|---|---|---|---|
| T01 | 后端工程骨架 | B | — | `/health` | — |
| T02 | 12 张实体建模与迁移 | B | T01 | 12 实体 | — |
| T03 | 认证鉴权 + 角色守卫 + 脱敏 | B | T02 | A 组接口；`user` | 6.1 |
| T04 | 前端工程骨架 + 通用组件 | A | T03 | Axios/路由/登录态 | — |
| T05 | 物品发布/列表/详情 + 状态机 | B | T03, T02 | B 组接口 | 6.2 |
| T06 | 认领/核验/归还事务 + 幂等 | B | T05 | E 组接口 | 6.4, 6.5 |
| T07 | 大厅/发布/详情前端页 | A | T04, T05 | B 组接口 | 6.2, 6.8 |
| T08 | 地图后端（图层/标定/点位） | B | T02 | C 组接口 | 6.7 |
| T09 | Leaflet 地图前端交互 | A | T08 | C 组接口 | 6.7 |
| T10 | 认领/我的委托前端页 | A | T06, T07 | E+G 组 | 6.4, 6.8 |
| T11 | 特征提取适配器 + 降级 | C | T05 | D 组 extract | 6.2, 6.3 |
| T12 | 候选匹配 + 来源标识 + 缓存 | C | T11 | D 组 candidates | 6.3 |
| T13 | 候选列表前端 + 来源标识 | A | T12 | D 组 | 6.3 |
| T14 | 工单状态机 + 授权后端 | B | T02 | F 组接口 | 6.6 |
| T15 | 工单协作 UI + 核查清单 | A | T14, T09 | F 组 | 6.6 |
| T16 | 徽章去重 + 我的委托聚合 | B | T06, T14 | G 组接口 | 6.8 |
| T17 | 匹配评估 + 证据卡 + 演示 | C | T12 | `candidate/claim_evidence` | 6.5, 7 |
| T18 | Docker Compose + 密钥后端化 | B | T02 | 3 套 compose | — |
| T19 | Rules/Skill 配置 + 阶段验收 | C | T01–T18 | 全部 | 6.1–6.8 |
| T24 | 地图逻辑抽取为可复用组件 | A | T09, T23 | C 组接口（前端复用） | 6.7 |

## 4. 逐任务详细说明

### T01 后端工程骨架（B）
- **输出**：`backend/` FastAPI 工程，`pyproject.toml`/`requirements.txt`、`app/main.py`、配置加载、`GET /api/v1/health`、CORS、统一错误结构、`.env.example`。
- **验收**：`/api/v1/health` 返回 `{"status":"ok"}`；错误响应 `{code,message,details?}`。

### T02 12 张实体建模与迁移（B）
- **输出**：12 张 SQLAlchemy 模型 + Alembic 首版迁移；枚举严格对齐状态机；`UNIQUE(username)`、`UNIQUE(claim.idempotency_key)`、`UNIQUE(badge.user_id,kind)`。
- **验收**：`alembic upgrade head` 建 12 表；`layer.pixels_per_meter` 为空时不输出米数。

### T03 认证鉴权 + 角色守卫 + 脱敏序列化器（B）
- **输出**：register/login/me/admin/staff 接口；JWT；`RoleGuard(student/staff/admin)`；脱敏序列化器（剥离私密字段）。
- **验收**：见 EARS 6.1；注册禁止 role≠student；公开序列化不含私密字段。

### T04 前端工程骨架 + 通用组件（A）
- **输出**：`frontend/`（Vite+React+TS+Router+Axios interceptor+状态库）、登录/注册页、`<RequireAuth>`、通用组件。
- **验收**：未登录跳登录页；前端不存密钥、不自行判权限。

### T05 物品发布/列表/详情 + 状态机骨架（B）
- **输出**：`POST /items`、`GET /items`（筛选脱敏）、`GET /items/{id}`、`POST /items/{id}/map-anchor`；附件上传。
- **验收**：见 EARS 6.2；列表/详情不含私密字段。

### T06 认领/核验/归还事务 + 幂等（B）
- **输出**：`POST /claims`、`POST /claims/{id}/review`、`POST /claims/{id}/complete`；归还事务（FOR UPDATE+行锁+CAS）；证据私密域。
- **验收**：见 EARS 6.4/6.5；同一物品仅一次归还；学生越权 403。

### T07 大厅/发布/详情前端页（A）
- **输出**：大厅、发布、详情页。
- **验收**：见 EARS 6.2/6.3；模型提取失败可手动继续。

### T08 地图后端（B）
- **输出**：`GET /layers`、`GET /layers/{id}/image`、`GET /layers/{id}/points`、`POST /layers/{id}/calibrate`。
- **验收**：3 图层；未标定不返回米数；模拟点位标记；calibrate 仅 admin。

### T09 Leaflet 地图前端交互（A）
- **输出**：图片图层渲染、缩放/标点/画圈/分层路线、版本缓存失效、米数门控。
- **验收**：见 EARS 6.7；未标定不显示米数；模拟点位标记。

### T10 认领/我的委托前端页（A）
- **输出**：认领提交页；我的委托页。
- **验收**：见 EARS 6.4/6.8。

### T11 特征提取适配器 + 降级兜底（C）
- **输出**：`POST /items/{id}/extract`；模型适配器可选 Key/超时/容错/额度；降级链。
- **验收**：见 EARS 6.2/6.3；模型不可用返回空+503 不阻断。

### T12 候选匹配 + 来源标识 + 缓存（C）
- **输出**：`GET /items/{id}/candidates`（≤3+解释+source四类）；候选缓存；过滤私密。
- **验收**：见 EARS 6.3；来源标识；无候选提示转工单。

### T13 候选列表前端 + 来源标识（A）
- **验收**：见 EARS 6.3；渲染来源标识+解释。

### T14 工单状态机 + 授权后端（B）
- **输出**：tickets 全组接口；authorize-route；route 权限控制。
- **验收**：见 EARS 6.6；未授权/未分配 403。

### T15 工单协作 UI + 核查清单（A）
- **验收**：见 EARS 6.6；模拟点位标记；未授权不渲染路线。

### T16 徽章去重 + 我的委托聚合（B）
- **验收**：见 EARS 6.8；徽章去重。

### T17 匹配评估 + 证据卡 + 演示脚本（C）
- **验收**：仅报告实际结果，来源分别标记。

### T18 Docker Compose + 密钥后端化（B）
- **验收**：`docker compose up` 拉起服务；密钥仅存后端。

### T19 Rules/Skill 配置 + 阶段验收（C）
- **验收**：重点检查矩阵覆盖；不伪造记录。

## 5. 业务约束落地对照表

| # | 硬约束 | 主要落点 | 关键实现 |
|---|---|---|---|
| 1 | 后端强制权限 | T03,T06,T08,T14 | `RoleGuard`；403 |
| 2 | 私密字段不进公共接口 | T03,T05,T06 | 脱敏序列化器 |
| 3 | AI 仅提取与推荐 | T06,T11,T12 | 模型仅读，写路由不暴露 |
| 4 | 同一物品仅一次归还 | T06 | 事务+行锁+CAS |
| 5 | 模型故障降级 | T11,T12,T18 | 降级链+503 |
| 6 | 路线默认私密最小授权 | T08,T14,T15 | `route.is_private` |
| 7 | 四类来源标识 | T12,T13 | `candidate.source` |
| 8 | 无比例尺不显示米数 | T08,T09 | `pixels_per_meter IS NULL` |
| 9 | 模拟点位恒标记 | T04,T08,T09,T15 | `is_simulated` |
| 10 | 密钥仅存后端 | T18 | `.env` 入 `.gitignore` |
| 11 | 真实性声明 | T17,T19 | 分别标记 |

## 6. 验收与测试任务汇总

| 阶段 | 测试任务 | 覆盖 |
|---|---|---|
| M1 | 后端闭环集成测试 | 6.2/6.4/6.5 |
| M2 | 地图保存/楼层/无比例尺 | 6.7 |
| M3 | 模型降级/来源标识/工单授权 | 6.3/6.6 |
| M4 | 权限矩阵全量回归 + EARS 验收 | 6.1–6.8 |

## 7. T02 细化任务：建立 Alembic 迁移基线与索引

> 本清单对应 `design.md` 2.11 节，将 T02 细化为可执行、可勾选的编码任务。硬约束：不改表名/列名/列类型；不改 `backend/tests/conftest.py`（测试继续 `create_all`）；密钥不出现在代码、日志或对话中。

### 7.1 为常用查询列补索引（17 个）
- [ ] 在 `backend/app/models/item.py` 的 `Item` 模型，为 `owner_user_id`、`direction`、`status`、`created_at` 四列追加 `index=True`
- [ ] 在 `backend/app/models/claim.py` 的 `Claim` 模型，为 `found_item_id`、`lost_item_id`、`applicant_user_id`、`status` 四列追加 `index=True`
- [ ] 在 `backend/app/models/claim.py` 的 `ClaimEvidence` 模型，为 `claim_id` 列追加 `index=True`
- [ ] 在 `backend/app/models/ticket.py` 的 `Ticket` 模型，为 `item_id`、`requester_user_id`、`assignee_user_id`、`status` 四列追加 `index=True`
- [ ] 在 `backend/app/models/item.py` 的 `Route` 模型，为 `item_id` 列追加 `index=True`
- [ ] 在 `backend/app/models/layer.py` 的 `SimulatedPoint` 模型，为 `layer_id` 列追加 `index=True`
- [ ] 在 `backend/app/models/item.py` 的 `ItemFeature` 模型，为 `item_id` 列追加 `index=True`
- [ ] 在 `backend/app/models/item.py` 的 `Attachment` 模型，为 `item_id` 列追加 `index=True`
- [ ] 确认未改动任何表名、列名、列类型（仅追加 `index=True`）

### 7.2 生成初始迁移基线
- [ ] 在 `backend/alembic/versions/` 生成初始迁移文件（`down_revision = None`），包含当前全部 12 张表及全部索引
- [ ] 通读迁移文件，确认枚举列以 `sa.Enum(..., native_enum=False, length=N)` 按字符串创建，与模型 `SAEnum` 参数一致
- [ ] 确认主键用 `sa.Uuid()`、时间戳 `server_default=sa.text('(CURRENT_TIMESTAMP)')`，在 SQLite 与 PostgreSQL 下均可执行
- [ ] 确认 `upgrade()` 按依赖顺序建表建索引，`downgrade()` 逆序删除

### 7.3 改造 seed.py
- [ ] 在 `backend/seed.py` 移除 `create_all` 建表调用，仅保留管理员与三个图层的幂等种子写入
- [ ] 确认 `seed.py` 不再负责建表（建表交由 `alembic upgrade head` 完成）

### 7.4 改造 Dockerfile 启动命令
- [ ] 在 `backend/Dockerfile` 将启动命令改为「先 `alembic upgrade head`，再 `python seed.py`，最后启动 uvicorn」
- [ ] 确认命令顺序为 迁移 → 种子 → 启动服务

### 7.5 更新 README 运行步骤
- [ ] 在 `README.md` 的本地运行步骤中，于 `seed.py` 之前插入 `alembic upgrade head`
- [ ] 确认 README 对本地 SQLite 与 Docker PostgreSQL 两种环境的建表方式描述一致

### 7.6 验收与回归测试
- [ ] 删除 `backend/demo.db` 后依次执行 `alembic upgrade head`、`python seed.py`，均成功，并能启动服务访问 `/api/v1/health`
- [ ] 再次执行 `alembic upgrade head`，确认幂等不报错（无待应用迁移）
- [ ] 执行 `alembic check`，确认模型与迁移一致、无差异
- [ ] 执行 `backend` 的 `pytest tests/ -q`，确认后端测试结果不变
## 8. T20 服务层下沉重构（B）

> 对应 `design.md` 2.12 节。纯重构：接口地址、参数、返回内容、状态码、错误信息全部保持不变。

- **目标**：将路由文件中的业务逻辑下沉至 services 层。
- **允许修改**：`backend/app/api/v1/{items,claims,tickets,auth,admin}.py`；新建 `backend/app/services/{item_service,claim_service,ticket_service,matching_service,user_service}.py`。
- **要求**：
  1. 路由函数只保留「取参数、鉴权依赖、调用 service、返回结果」。
  2. `claim_service.py` 原样搬移 `serialize_claim_mutation`、`lock_items`、`replay`、`restore_unclaimed`、`editable_claim` 及创建/审核/完成三段逻辑，加锁顺序、flush/commit 位置、条件更新语句不变。
  3. `matching_service.py` 导出 `find_candidates(db, lost_item)`，返回 ≤3 候选。
  4. `user_service.py` 合并 auth/admin 重复的「检查用户名存在并创建用户」。
  5. 删除 `auth.py` 中未使用的导入。
- **禁止**：不改 `tests/`、`models/`、`schemas/`；不新增依赖；不顺手优化其他问题。
- **验收**：测试 18 通过 1 跳过；`ruff check` 通过；五路由无 `db.query`/`db.add`/`db.commit`。
## 9. T21 接口响应模型、列表分页与大厅搜索（B/A）

> 对应 `design.md` 2.13 节。目标：给所有接口补 `response_model`、6 个列表接口改为分页返回、大厅 `GET /items` 增加关键词搜索。本任务会改变列表接口返回结构，前端调用与测试同步适配。
>
> **允许修改**：`backend/app/schemas/`（可新建 `common.py`）、`backend/app/api/v1/`、`backend/app/services/`、`backend/tests/`、`frontend/src/pages/`（调用列表接口的页面）、`frontend/src/types.ts`。
>
> **硬约束**：`precise_location` 仅对发布者本人返回；分页参数越界返回 400（而非 422）；本任务不做翻页 UI，仅保证现有页面功能不变。

### 9.1 定义泛型分页模型
- [ ] 在 `backend/app/schemas/common.py` 定义泛型模型 `Page[T]`，字段为 `items: list[T]`、`total: int`、`limit: int`、`offset: int`
- [ ] 确认 `Page` 使用 Pydantic v2 泛型语法，`items` 元素类型在声明处由各接口静态确定（不出现 `Any`、不返回手写字典）

### 9.2 六个列表接口改为分页返回
- [ ] 在 `backend/app/api/v1/items.py` 的 `GET /items` 声明 `response_model=Page[ItemPublic]`，新增 `limit: int = Query(20, ge=1, le=100)`、`offset: int = Query(0, ge=0)`，路由层包装 `Page(items=..., total=..., limit=limit, offset=offset)`
- [ ] 在 `backend/app/api/v1/claims.py` 的 `GET /claims` 声明 `response_model=Page[ClaimOut]`，加 `limit/offset`，返回 Page
- [ ] 在 `backend/app/api/v1/tickets.py` 的 `GET /tickets` 声明 `response_model=Page[TicketOut]`，加 `limit/offset`，返回 Page
- [ ] 在 `backend/app/api/v1/me.py` 的 `GET /me/items` 声明 `response_model=Page[ItemPublic]`，加 `limit/offset`，返回 Page
- [ ] 在 `backend/app/api/v1/me.py` 的 `GET /me/claims` 声明 `response_model=Page[ClaimOut]`，加 `limit/offset`，返回 Page
- [ ] 在 `backend/app/api/v1/me.py` 的 `GET /me/tickets` 声明 `response_model=Page[TicketOut]`，加 `limit/offset`，返回 Page
- [ ] 在 `backend/app/services/item_service.py` 将 `list_items` 返回改为 `tuple[list[Item], int]`，`total` 在应用 `offset/limit` 前用 `query.count()` 计算，排序 `created_at` 倒序
- [ ] 在 `backend/app/services/claim_service.py` 将 `list_claims`、`list_my_claims` 返回 `tuple[list[Claim], int]`，排序 `created_at` 倒序（列表追加 `id` 作稳定二级排序）
- [ ] 在 `backend/app/services/ticket_service.py` 将 `list_tickets`、`list_my_tickets` 返回 `tuple[list[Ticket], int]`，排序 `created_at` 倒序
- [ ] 确认 `limit` 越界（>100 或 <1）、`offset<0` 由 `Query(ge=..., le=...)` 触发 `RequestValidationError`，并经 `app/errors.py` 统一转为 400/VALIDATION

### 9.3 大厅关键词搜索
- [ ] 在 `backend/app/api/v1/items.py` 的 `GET /items` 新增可选参数 `q: str | None = None`
- [ ] 在 `backend/app/services/item_service.py` 的 `list_items` 中，`q` 命中时用 `ilike` 对 `title`、`description`、`category` 做不区分大小写模糊匹配（`or_` 组合），空串跳过
- [ ] 将 `category` 筛选由精确匹配改为 `Item.category.ilike(f"%{category}%")` 模糊匹配
- [ ] 确认 `q`/`category`/`location_area` 仅作用于公开概览字段，不触及 `precise_location` 等私密字段

### 9.4 补齐八个接口的响应模型
- [ ] 物品详情 `GET /items/{id}`：声明 `response_model=ItemDetail`，字段与现有返回一致（公开字段 + `is_owner` + `norm_x/norm_y/layer_id` + `precise_location`）
- [ ] 设置地图标点 `POST /items/{id}/map-anchor`：声明 `response_model=MapAnchorOut`（`ok`）
- [ ] 创建路线 `POST /items/{id}/route`：声明 `response_model=RouteOut`（`id/kind/is_private`）
- [ ] 查询路线 `GET /items/{id}/route`：声明 `response_model=list[RouteDetail]`（`id/kind/geometry/floor_segments/is_private/authorized`）
- [ ] 特征提取 `POST /items/{id}/extract`：声明 `response_model=FeatureExtractionOut`（`labels/extracted_text/confidence/source/degraded`）
- [ ] 候选列表 `GET /items/{id}/candidates`：声明 `response_model=list[CandidateOut]`（`found_item_id/score/explanation/source/title/category/location_area`）
- [ ] 我的徽章 `GET /me/badges`：声明 `response_model=list[BadgeOut]`（`id/kind/awarded_at`）
- [ ] 工单路线 `GET /tickets/{id}/route`：声明 `response_model=list[TicketRouteOut]`（`id/kind/geometry/floor_segments`）

### 9.5 precise_location 发布者权限
- [ ] 在 `backend/app/services/item_service.py` 的 `get_item_detail` 中，`precise_location` 仅当 `item.owner_user_id == user.id` 时返回原文，否则恒为 `null`
- [ ] 确认 `ItemPublic`（列表模型）不含 `precise_location` 字段，公开列表永不泄露精确位置
- [ ] 确认 `is_owner` 字段独立表达归属，与 `precise_location` 解耦

### 9.6 前端适配
- [ ] 在 `frontend/src/types.ts` 新增泛型 `Page<T>` 类型（`items/total/limit/offset`），并确认 `Item` 已含可选 `precise_location`、`is_owner`
- [ ] 在 `frontend/src/pages/Home.tsx` 将列表读取改为 `res.data.items`，并保留/接入 `q` 搜索输入（标题/描述/类别）
- [ ] 在 `frontend/src/pages/MyDelegations.tsx` 将 `/me/items`、`/me/claims`、`/me/tickets` 三处读取改为 `.data.items`
- [ ] 在 `frontend/src/pages/StaffClaims.tsx` 将 `/claims` 读取改为 `.data.items`
- [ ] 在 `frontend/src/pages/Tickets.tsx` 将 `/tickets`、`/me/items` 读取改为 `.data.items`（`/me/items` 用 `Page<Item>` 断言）
- [ ] 确认本任务不新增翻页 UI，仅保证现有页面功能不变

### 9.7 测试适配与新增
- [ ] 适配 `backend/tests/test_acceptance.py` 中读取列表的断言：由 `r.json()[0]` 改为 `r.json()["items"][0]`（如 `test_private_fields_not_in_public_list`），断言内容不变
- [ ] 新增 `backend/tests/test_pagination.py` 用例 `test_list_items_pagination_applies_limit_and_offset`（limit/offset 生效、total 正确、越界页返回空 items）
- [ ] 新增用例 `test_list_items_limit_over_100_returns_400`（`limit=101` 返回 400）
- [ ] 新增用例 `test_list_items_keyword_search_matches_title_description_category`（`q` 命中标题/描述/类别，且不区分大小写）
- [ ] 新增用例 `test_item_detail_precise_location_hidden_from_non_owner`（发布者可见、他人为 null）

### 9.8 验收
- [ ] 执行 `cd backend && .venv/Scripts/python -m pytest tests/ -q`，全部通过（PostgreSQL 并发用例按环境跳过），并列出新增用例名
- [ ] 执行 `cd backend && .venv/Scripts/python -m ruff check .`，无报错
- [ ] 执行 `cd frontend && npm run lint` 与 `npm run build`，均通过
- [ ] 打开 `/docs`，确认上述列表接口展示 Page 响应结构、八个补齐接口展示响应模型## 10. T22 输入校验与一致性修复（B/A）

> 对应 `design.md` 2.14 节。目标：修复 8 条已确认的输入校验与一致性问题，不改动第 1~8 条之外的行为，不改变认领流程的加锁与事务顺序。
>
> **允许修改**：`backend/app/schemas/`、`backend/app/services/`、`backend/app/api/v1/`、`backend/app/models/claim.py`、新建一个 Alembic 迁移、`backend/tests/test_validation.py`、`frontend/src/pages/StaffClaims.tsx`、`frontend/src/components/Layout.tsx`。
>
> **分层约定**：所有参数范围/长度校验下沉到 `schemas` 层（Pydantic），路由与服务层不做手写范围判断；引用存在性与去重更新属业务规则，落在 `services` 层；路由仅取参、鉴权、调用、返回。

### 10.1 归一化坐标范围（第 1 条）
- [ ] 在 `backend/app/schemas/layer.py` 的 `MapAnchorRequest.norm_x/norm_y` 用 `Field(ge=0, le=1)` 限制 0~1，越界由 `RequestValidationError` 处理器统一转 400/VALIDATION
- [ ] 在 `backend/app/schemas/layer.py` 的 `SimulatedPointCreate.norm_x/norm_y` 用 `Field(ge=0, le=1)` 限制 0~1
- [ ] 确认 `items` 路由或服务里无对应的手写范围判断（校验已下沉到 schema 层）
- **验收**：越界坐标（如 1.5 / -0.1）请求返回 400；对应测试 `test_map_anchor_coordinate_out_of_range_returns_400`、`test_simulated_point_coordinate_out_of_range_returns_400`

### 10.2 字符串长度上限（第 2 条）
- [ ] 在 `backend/app/schemas/item.py` 的 `ItemCreate.description` 设 `StringConstraints(max_length=2000)`、`precise_location` 设 `max_length=200`
- [ ] 在 `backend/app/schemas/auth.py` 的 `RegisterRequest.contact` 设 `max_length=100`
- [ ] 在 `backend/app/schemas/staff.py` 的 `StaffCreateRequest.contact` 设 `max_length=100`
- [ ] 在 `backend/app/schemas/layer.py` 的 `SimulatedPointCreate.label` 设 `min_length=1, max_length=64`、`description` 设 `max_length=500`
- [ ] 在 `backend/app/schemas/claim.py` 的 `ReviewRequest.reason` 设 `max_length=500`
- **验收**：超出上限返回 400，临界值（如 2000/200）正常；对应测试 `test_item_description_and_precise_location_length_limits`、`test_contact_length_limit_on_register_and_staff`、`test_simulated_point_label_and_description_length_limits`、`test_review_reason_length_limit`

### 10.3 pixels_per_meter 校验（第 3 条）
- [ ] 在 `backend/app/schemas/layer.py` 的 `CalibrateRequest.pixels_per_meter` 用 `Field(gt=0)` 约束必须大于 0
- **验收**：0 或负数返回 400；对应测试 `test_calibrate_non_positive_pixels_per_meter_returns_400`

### 10.4 路线几何结构（第 4 条）
- [ ] 在 `backend/app/schemas/layer.py` 新增 `RoutePoint`（`x/y` 均 `Field(ge=0, le=1)`）
- [ ] 新增 `PolylineGeometry`（`points: list[RoutePoint] = Field(min_length=2, max_length=200)`）
- [ ] 新增 `CircleGeometry`（`center: RoutePoint`、`radius: float = Field(gt=0, le=1)`）
- [ ] 将 `RouteCreate.geometry` 由任意字典改为 `PolylineGeometry | CircleGeometry | None`，并加 `@model_validator(mode="after")` 校验 `kind` 与 `geometry` 结构匹配（polyline→PolylineGeometry、circle→CircleGeometry），不匹配抛 `ValueError` 转 400
- **验收**：折线少于 2 点 / 坐标越界 / 结构错配返回 400，circle 半径 0 或 >1 返回 400，合法结构返回 200；对应测试 `test_route_polyline_geometry_validation`、`test_route_circle_geometry_validation`

### 10.5 引用存在性校验（第 5 条）
- [ ] 在 `backend/app/services/item_service.py` 的 `set_map_anchor` 中，`_get_owned_item` 后、写入前 `db.get(Layer, body.layer_id)` 为空则 `raise ApiError(404, "NOT_FOUND", "图层不存在")`
- [ ] 在 `backend/app/services/item_service.py` 的 `create_route` 中，`body.layer_id is not None` 且 `db.get(Layer, ...)` 为空则 404
- [ ] 在 `backend/app/api/v1/layers.py` 的 `create_simulated_point` 中，`require_role` 后 `db.get(Layer, layer_id)` 为空则 404
- **验收**：`layer_id` 不存在返回 404（不依赖数据库外键报错）；对应测试 `test_simulated_point_missing_layer_returns_404`、`test_map_anchor_missing_layer_returns_404`、`test_route_missing_layer_returns_404`

### 10.6 特征提取接口（第 6 条）
- [ ] 在 `backend/app/schemas/item.py` 新增 `FeatureExtractRequest`（`text: str | None`，`StringConstraints(strip_whitespace=True, max_length=2000)`）
- [ ] 在 `backend/app/api/v1/items.py` 的 `extract` 改为从 `body: FeatureExtractRequest` 取 `text`（不再从地址栏参数取）
- [ ] 在 `backend/app/services/item_service.py` 的 `extract_item_features` 改为「查找 `confirmed=False` 的 `ItemFeature` → 有则更新、无则新建」，同一物品重复调用仅更新已有未确认记录，不再新增重复记录
- **验收**：请求体 `text` 生效、超 2000 返回 400、重复调用仅一条 `ItemFeature` 且内容为最新；对应测试 `test_extract_uses_request_body_and_length_limit`、`test_extract_repeat_updates_existing_unconfirmed_feature`

### 10.7 角色一致性（第 7 条）
- [ ] 确认 `backend/app/api/v1/claims.py` 的 `GET /claims`、`POST /claims/{id}/review`、`POST /claims/{id}/complete` 均为 `require_role(Role.staff, Role.admin)`
- [ ] 确认 `backend/app/api/v1/tickets.py` 的 `POST /tickets/{id}/assign`、`POST /tickets/{id}/feedback` 均为 `require_role(Role.staff, Role.admin)`
- [ ] 确认 `backend/app/api/v1/layers.py` 的 `GET/POST /layers/{id}/simulated-points` 均为 `require_role(Role.staff, Role.admin)`
- [ ] 在 `frontend/src/components/Layout.tsx` 将「认领审核」导航入口条件改为 `role === 'staff' || role === 'admin'`
- [ ] 在 `frontend/src/pages/StaffClaims.tsx` 以 `role !== 'staff' && role !== 'admin'` 守卫
- **验收**：管理员可查看/审核/完成认领、接单/反馈工单、查看模拟点位；对应测试 `test_admin_can_review_and_complete_claim`、`test_admin_can_assign_and_feedback_ticket`、`test_admin_can_list_simulated_points`（前端隐藏按钮仅作展示，权限仍由后端 `require_role` 强制）

### 10.8 认领拒绝理由（第 8 条）
- [ ] 在 `backend/app/models/claim.py` 的 `Claim` 新增 `review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)`
- [ ] 新建 Alembic 迁移 `backend/alembic/versions/7b8c9d0e1f2a_add_claim_review_reason.py`（`down_revision='5a312e915b0f'`，`upgrade` 用 `op.add_column('claim', sa.Column('review_reason', sa.Text(), nullable=True))`，`downgrade` 用 `op.drop_column`）
- [ ] 在 `backend/app/schemas/claim.py` 的 `ClaimDetail` 新增 `review_reason: str | None = None`
- [ ] 在 `backend/app/services/claim_service.py` 的 `review_claim` 保存 `claim.review_reason = body.reason`，`get_claim` 构造 `ClaimDetail` 时透传 `review_reason`
- [ ] 在 `frontend/src/pages/StaffClaims.tsx` 拒绝时展示「拒绝理由（可选）」`textarea`，`act('reject')` 提交 `{ approve: false, reason: reason.trim() || undefined }`
- **验收**：拒绝理由保存且认领详情返回；对应测试 `test_review_reason_saved_and_returned`
- **约束**：不改变 `editable_claim`/`lock_items` 的加锁顺序、`flush`/`commit` 位置与条件更新语句

### 10.9 测试与验收
- [ ] 在 `backend/tests/test_validation.py` 实现上述 8 类校验与一致性用例，复用 `test_acceptance.py` 的 `create_user/login/register/auth` 并自建 `create_layer/item/staff_token/admin_token` 辅助函数，每类含正常 + 非法输入/权限
- [ ] 执行 `cd backend && .venv/Scripts/python -m pytest tests/ -q`，全部通过（PostgreSQL 并发用例按环境跳过），并列出新增用例名
- [ ] 执行 `cd backend && .venv/Scripts/python -m ruff check .`，无报错
- [ ] 执行 `cd backend && .venv/Scripts/alembic upgrade head` 与 `alembic check`，迁移应用成功、模型与迁移一致无差异
- [ ] 执行 `cd frontend && npm run lint` 与 `npm run build`，均通过
## 11. T23 前端接口层、请求 Hook 与基础组件重构（A）

> 对应 `design.md` 2.15 节。目标：为前端搭建接口层、请求 Hook、设计变量和基础组件，把现有 9 个页面与 `Layout`/`AuthContext` 迁移过去；页面功能与文案不变，视觉只做统一，不做重新设计。
>
> **允许修改**：`frontend/src/` 下所有文件。
> **硬约束**：不新增任何第三方依赖；不改路由结构、页面数量、业务流程；不引入 UI 组件库与 CSS 框架；全程不使用 `any`。
>
> **用户已确认的三个关键点（必须纳入）**：
> 1. 颜色取值：主色 `#2563eb`、成功 `#16a34a`、警告 `#d97706`、危险 `#dc2626`；所有颜色只定义在 `tokens.css`，组件与页面不得出现任何颜色数值。
> 2. 搜索框 `q` 与类别输入框一样，均做 300 毫秒防抖。
> 3. `AuthContext` 的 `login`、`register`、`me` 改用 `api/auth.ts`、`api/me.ts`；最终整个 `frontend/src` 只有 `src/api/` 目录下文件可导入并使用 `client`。

### 11.1 类型补全（`src/types.ts`）
- [ ] 在 `frontend/src/types.ts` 新增 `Role` 类型（`'student' | 'staff' | 'admin'`），`AuthContext.tsx` 的本地 `Role` 定义改为从 `types.ts` 导入
- [ ] 新增 `roleLabels: Record<Role, string>`（学生 / 工作人员 / 管理员）
- [ ] 新增 `User` 接口（`id/username/display_name/role: Role`）
- [ ] 新增 `Layer` 接口（`id/name/version/width/height/scale_calibrated/image_path: string | null`）
- [ ] 新增 `SimulatedPoint` 接口（`id/label/norm_x/norm_y/is_simulated/description: string | null`）
- [ ] 新增 `Badge` 接口（`id/kind/awarded_at`）
- [ ] 新增 `EvidenceKind` 类型（`'text' | 'image'`）
- [ ] 在 `Item` 接口增补 `norm_x: number | null`、`norm_y: number | null`、`layer_id: string | null`
- [ ] 在 `ClaimDetail` 接口增补 `review_reason: string | null`

### 11.2 接口层（`src/api/`）
- [ ] 确认 `frontend/src/api/client.ts` 保留为唯一 axios 入口，`setToken/getToken/errorMessage` 继续供接口层与 `AuthContext` 使用，页面不再导入 `client`
- [ ] 新建 `frontend/src/api/auth.ts`，导出 `LoginRequest`、`RegisterRequest`、`TokenResponse` 类型及 `login(body): Promise<TokenResponse>`、`register(body): Promise<TokenResponse>`、`me(): Promise<User>`
- [ ] 新建 `frontend/src/api/items.ts`，导出 `ListItemsParams`、`ItemCreateInput`、`MapAnchorInput`、`RouteCreateInput`、`RouteDetail`、`FeatureExtractionOut` 等类型及 `listItems/getItem/createItem/setMapAnchor/createRoute/getRoutes/extractFeatures/getCandidates`
- [ ] 新建 `frontend/src/api/claims.ts`，导出 `EvidenceInput`、`ClaimCreateInput`、`ReviewInput`、`ListClaimsParams` 类型及 `listClaims/getClaim/createClaim/reviewClaim/completeClaim`
- [ ] 新建 `frontend/src/api/tickets.ts`，导出 `TicketCreateInput`、`FeedbackInput`、`TicketRoute`、`ListTicketsParams` 类型及 `listTickets/createTicket/assignTicket/authorizeRoute/getTicketRoute/feedbackTicket`
- [ ] 新建 `frontend/src/api/layers.ts`，导出 `CalibrateInput`、`SimulatedPointInput` 类型及 `listLayers/getLayerImage/calibrateLayer/listSimulatedPoints/createSimulatedPoint`
- [ ] 新建 `frontend/src/api/me.ts`，导出 `listMyItems/listMyClaims/listMyTickets/listMyBadges`
- [ ] 确认所有接口函数入参与返回值类型精确（可选参数显式 `| null`，列表返回 `Page<T>`，`getLayerImage` 返回 `Blob`），不出现 `any`

### 11.3 请求 Hook（`src/hooks/`）
- [ ] 新建 `frontend/src/hooks/useAsync.ts`，导出 `AsyncState<T>`（`data/error/loading/reload`）与 `useAsync<T>(fn, deps)`
- [ ] `useAsync` 挂载及 `deps` 变化时执行 `fn`，成功写 `data`、失败把 `errorMessage(e)` 写入 `error`，`reload` 手动重触发（不改变依赖数组）
- [ ] 用「请求序号 + active 标志」实现旧结果丢弃：每次执行/卸载递增序号，回调前校验序号未变且未卸载，避免竞态与卸载后 setState 告警
- [ ] 新建 `frontend/src/hooks/useDebounce.ts`，导出 `useDebounce<T>(value, delayMs = 300): T`，用 `useEffect` + `setTimeout` 实现、清理时 `clearTimeout`

### 11.4 设计变量（`src/styles/tokens.css`）
- [ ] 新建 `frontend/src/styles/tokens.css`，定义 CSS 变量：主色 `#2563eb`、成功 `#16a34a`、警告 `#d97706`、危险 `#dc2626`、文字三级、背景两级、边框色、间距 6 级（4/8/12/16/24/32）、圆角 3 级、字号 5 级、阴影 2 级
- [ ] 确认所有颜色十六进制数值只出现在本文件，组件与页面不得出现任何颜色数值
- [ ] 精简 `frontend/src/index.css`：改为 `@import './styles/tokens.css'` + reset（`*{box-sizing}`、`body{margin:0}`、`font-family`、控件 `font: inherit`），移除其中的具体颜色值

### 11.5 基础组件（`src/components/`）
- [ ] 新建 `Button.tsx` + `Button.module.css`：`variant: primary/secondary/danger`（默认 primary）、`loading`、`disabled`、`type`、`onClick`，loading/disabled 时禁用并显示 `Spinner`，loading 时加 `aria-busy`
- [ ] 新建 `Card.tsx` + `Card.module.css`：背景 bg-2、圆角 radius-md、内边距 space-4、阴影 shadow-sm
- [ ] 新建 `Tag.tsx` + `Tag.module.css`：`tone: neutral/primary/success/warning/danger` 小型标签，用于状态/来源标识
- [ ] 新建 `Field.tsx` + `Field.module.css`：`label`、`error`、`required`、`htmlFor`、`children`，label + 控件插槽 + 错误提示（danger 色，`role="alert"`）
- [ ] 新建 `Empty.tsx` + `Empty.module.css`：`text`（默认「暂无数据」）空态占位，`role="status"`
- [ ] 新建 `ErrorNotice.tsx` + `ErrorNotice.module.css`：`message` 错误提示（`role="alert"`，danger 色）
- [ ] 新建 `Spinner.tsx` + `Spinner.module.css`：`size: sm/md` CSS 动画加载指示，不引第三方图标
- [ ] 新建 `PageContainer.tsx` + `PageContainer.module.css`：max-width、margin auto、内边距 space-5（替代原 `.page`）
- [ ] 确认全部组件样式只引用 tokens 变量，不写具体颜色/间距/圆角/字号数值

### 11.6 AuthContext 改造（`src/auth/AuthContext.tsx`）
- [ ] 将 `login`/`register`/`me` 三处 `client.get/post` 改为调用 `api/auth.ts` 的 `login`/`register`/`me` 函数
- [ ] 移除 `import client`，保留 `setToken/getToken`（来自 `client.ts`）用于 token 持久化
- [ ] 保持 token 持久化（sessionStorage）与 `auth-expired` 监听逻辑不变
- [ ] 确认 `frontend/src` 中只有 `src/api/` 目录下文件导入并使用 `client`（`AuthContext` 不再 import client）

### 11.7 Layout 改造（`src/components/Layout.tsx` + `Layout.module.css`）
- [ ] 将导航栏内联 `style` 移入新建 `Layout.module.css`（背景 bg-2、边框 `1px solid var(--color-border)`、间距用 tokens 变量）
- [ ] 角色显示改用 `roleLabels[role]`（学生/工作人员/管理员），`role` 为 null 时不渲染角色
- [ ] 导航「认领审核」入口条件保持 `role === 'staff' || role === 'admin'`
- [ ] 「退出」改用 `Button variant="secondary"`

### 11.8 页面迁移（`src/pages/`）
- [ ] 在 `Home.tsx`：改用 `listItems(params)` + `useAsync`；`q`、`category` 分别经 `useDebounce` 得到 `debouncedQ/debouncedCategory`，与 `direction/status` 作为 `useAsync` 依赖（q 与 category 均 300ms 防抖）；删除全部内联 `style`，列表项/加载/空态/错误分别用 `Card`/`Spinner`/`Empty`/`ErrorNotice`/`PageContainer`
- [ ] 在 `ItemDetail.tsx`：改用 `getItem`/`getCandidates`/`listMyItems`/`createClaim`；删除内联 `style`；表单用 `Field`/`Button`，提交用 `Button loading` 防重复；`crypto.randomUUID()` 改用 `createIdempotencyKey()`（见 11.9）
- [ ] 在 `ItemForm.tsx`：改用 `createItem`，删除内联 `style`，表单控件用 `Field` + `Button` + `ErrorNotice` + `PageContainer`
- [ ] 在 `Login.tsx`：继续走 `useAuth().login`（内部已改走接口层），删除内联 `style`，用 `Field`/`Button`/`ErrorNotice`/`PageContainer`
- [ ] 在 `Register.tsx`：继续走 `useAuth().register`，删除内联 `style`，用 `Field`/`Button`/`ErrorNotice`/`PageContainer`
- [ ] 在 `MapView.tsx`：改用 `listLayers`/`getLayerImage`/`listSimulatedPoints`，局部 `LayerInfo`/`Point` 类型改用 `types.ts` 的 `Layer`/`SimulatedPoint`；图层请求用 `useAsync`，Leaflet 副作用保留；删除内联 `style`（容器样式移入 `MapView.module.css`）；Leaflet 渲染用到的颜色（`#cbd5e1`、`#d97706`、`#f8fafc`）不得硬编码，改由读取 CSS 变量取得
- [ ] 在 `MyDelegations.tsx`：改用 `listMyItems`/`listMyClaims`/`listMyTickets`/`listMyBadges`（`Promise.all`）+ `useAsync`；删除内联 `style`；空态/加载/错误分别用 `Empty`/`Spinner`/`ErrorNotice`
- [ ] 在 `StaffClaims.tsx`：改用 `listClaims`/`getClaim`/`getItem`/`reviewClaim`/`completeClaim` + `useAsync`；提交动作保留 `busy` 防重复并用 `Button loading`；删除 `client.`；保持 `role !== 'staff' && role !== 'admin'` 守卫与「拒绝理由」`textarea`（提交 `reason: reason.trim() || undefined`）不变
- [ ] 在 `Tickets.tsx`：改用 `listTickets`/`listMyItems`/`createTicket`/`assignTicket`/`authorizeRoute`/`feedbackTicket` + `useAsync`；提交动作用 `Button loading` 防重复；删除 `client.`；空态用 `Empty`
- [ ] 确认 9 个页面均不再出现接口地址字符串与 `client.get`/`client.post`，不再出现内联 `style={{`

### 11.9 兼容性修复（`src/utils/id.ts`）
- [ ] 新建 `frontend/src/utils/id.ts`，导出 `createIdempotencyKey(): string`：优先 `crypto.randomUUID()`（判 `typeof crypto !== 'undefined' && 'randomUUID' in crypto`），不可用时回退 `crypto.getRandomValues(new Uint8Array(16))` 生成 32 位十六进制串
- [ ] 在 `ItemDetail.tsx` 将 `key.current = crypto.randomUUID()` 改为 `key.current = createIdempotencyKey()`，其余逻辑不变
- [ ] 确认返回值为等长随机十六进制串，满足后端 `idempotency_key` 长度 ≤64 约束

### 11.10 验收
- [ ] 在 `frontend/src` 搜索 `style={{`，结果为 0
- [ ] 在 `frontend/src/pages` 搜索 `client.`，结果为 0（`client` 仅 `src/api/` 内引用）
- [ ] 在 `frontend/src` 搜索颜色十六进制数值，仅出现在 `styles/tokens.css`，组件与页面零颜色数值
- [ ] 执行 `cd frontend && npm run lint`，通过（无 `any`、无未用导入）
- [ ] 执行 `cd frontend && npm run build`，通过（`tsc -b` 类型检查 + vite 构建）
- [ ] 启动前后端后手工走查：注册→发布寻物→发布拾获→查看候选→提交认领→查看我的委托→打开地图 全流程正常，文案与功能不变
## 12. T24 地图逻辑抽取为可复用组件（A）

> 对应 `design.md` 2.16 节。目标：把地图页 `MapView.tsx` 里的地图逻辑抽成可复用组件 `CampusMap`，为后续「发帖标点、圈范围、画路径」做准备。本任务**不新增任何地图功能**、不新增依赖、不改后端，现有地图行为（选图层、显示底图/占位矩形、模拟点位、点击弹归一化坐标）保持不变。
>
> **允许修改**：`frontend/src/pages/MapView.tsx`；新建 `frontend/src/components/CampusMap/`（`coords.ts`、`MapContext.tsx`、`CampusMap.tsx`、`CampusMap.module.css`）；新建 `frontend/src/hooks/useLayers.ts`；新建 `frontend/src/pages/ClickCoordsPopup.tsx`。
>
> **硬约束**：不新增绘制/编辑/聚合等任何新地图功能；不新增依赖；不使用 `any`；不写内联 `style`；颜色/间距/圆角/字号只引用 `tokens.css` 变量。`MapView.module.css` 不在允许修改清单内，保持不动（容器迁走后其 `.map` 类不再被引用，残留不影响 lint/build，勿顺手删除）。

### 12.1 坐标换算纯函数（`components/CampusMap/coords.ts`）
- [ ] 在 `frontend/src/components/CampusMap/coords.ts` 定义并导出 `LayerDims` 接口（`width: number`、`height: number`）
- [ ] 导出纯函数 `normToLatLng(nx: number, ny: number, dims: LayerDims): LatLng`，换算 `L.latLng(ny * dims.height, nx * dims.width)`（原点为图片左上角，lat=y、lng=x）
- [ ] 导出纯函数 `latLngToNorm(latlng: LatLng, dims: LayerDims): { x: number; y: number }`，换算 `x = latlng.lng / width`、`y = latlng.lat / height`
- [ ] 确认两个函数只依赖 `LayerDims`（不依赖 React、不依赖 Leaflet 实例、不依赖完整 `Layer` 类型），归一化坐标统一用 `{ x, y }` 表达

### 12.2 MapContext 与 useCampusMap（`components/CampusMap/MapContext.tsx`）
- [ ] 在 `frontend/src/components/CampusMap/MapContext.tsx` 定义并导出 `CampusMapContextValue` 接口：`map: LeafletMap | null`、`layer: Layer`、`toMap: (nx, ny) => LatLng`、`toNorm: (latlng) => { x, y }`
- [ ] 用 `createContext<CampusMapContextValue | null>(null)` 创建 `CampusMapContext`
- [ ] 导出 `useCampusMap(): CampusMapContextValue`，`context === null` 时 `throw new Error('useCampusMap 必须在 CampusMap 组件内使用')`（参照 `AuthContext.useAuth` 的抛错约定）
- [ ] 确认 `MapContext.tsx` 只提供 Context 与 Hook，不创建/销毁 Leaflet 实例

### 12.3 useLayers Hook（`hooks/useLayers.ts`）
- [ ] 新建 `frontend/src/hooks/useLayers.ts`，导出 `useLayers(): AsyncState<Layer>`，内部复用 `useAsync(() => listLayers(), [])`
- [ ] 确认不额外封装业务逻辑，仅把 `listLayers()` 调用从页面抽离，供 `MapView` 及后续页面复用

### 12.4 CampusMap 主组件（`components/CampusMap/CampusMap.tsx` + `CampusMap.module.css`）
- [ ] 在 `frontend/src/components/CampusMap/CampusMap.tsx` 定义并导出 `MapMarker` 接口（`x/y/label/color`）与 `CampusMapProps` 接口（`layer: Layer`、`markers: MapMarker[]`、`onMapClick?`、`onImageError?`、`children?`）
- [ ] 用 `useState<LeafletMap | null>` 管理 `map`（替代原 `useRef`），保证 Context 值随实例重建同步更新；用 `containerRef`、`markerGroupRef`、`onClickRef`、`onErrorRef` 保存挂载 DOM 与最新回调
- [ ] 在依赖 `[layer]` 的 `useEffect` 中完整保留原 `MapView.tsx:39-94` 的 Leaflet 生命周期：`L.map(container, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 3 })` → `bounds = L.latLngBounds([0,0],[layer.height, layer.width])` → `fitBounds` + `setMaxBounds(bounds.pad(0.2))`
- [ ] cleanup 顺序完整保留：`active=false` → `controller.abort()` → `revokeObjectURL(objectUrl)` → `map.remove()` → `setMap(null)` → `markerGroupRef.current = null`（先 `setMap(null)` 再建新实例，保证子组件不拿到已销毁实例）
- [ ] 无底图（`layer.image_path` 为空）时 `L.rectangle(bounds, { color: cssVar('--color-border-strong'), weight: 1, fillOpacity: 0.03 })` 显示占位矩形；有底图时 `getLayerImage(layer.id, controller.signal)` → `URL.createObjectURL(blob)` → `L.imageOverlay(url, bounds)`，失败时 `onErrorRef.current?.(errorMessage(e, '底图加载失败'))`
- [ ] 点击分发：`map.on('click', (e) => onClickRef.current?.(latLngToNorm(e.latlng, layer)))`，组件只分发 `onMapClick`，不弹任何 popup
- [ ] 在独立依赖 `[markers, map, layer]` 的 `useEffect` 中渲染 markers：`map` 为 null 时返回；`markerGroupRef` 为 null 时 `L.layerGroup().addTo(map)`；`clearLayers()` 后逐点 `L.circleMarker(normToLatLng(m.x, m.y, layer), { color: m.color }).bindTooltip(m.label)`
- [ ] 用 `useMemo`（依赖 `[map, layer]`）生成 Context value：`toMap`/`toNorm` 为 `normToLatLng`/`latLngToNorm` 绑定当前 `layer` 的闭包；渲染 `<CampusMapContext.Provider value={value}><div ref={containerRef} className={styles.map} />{children}</CampusMapContext.Provider>`（`children` 在 Provider 范围内）
- [ ] 新建 `frontend/src/components/CampusMap/CampusMap.module.css`，`.map` 迁移自 `MapView.module.css` 的 `.map`（`height: 560px`、`margin-top: var(--space-3)`、`border: 1px solid var(--color-border-strong)`、`background: var(--color-map-bg)`）
- [ ] 将 `import 'leaflet/dist/leaflet.css'` 从 `MapView.tsx` 迁至本组件

### 12.5 ClickCoordsPopup 图层组件（`pages/ClickCoordsPopup.tsx`）
- [ ] 新建 `frontend/src/pages/ClickCoordsPopup.tsx`，作为 `<CampusMap>` 子组件，`const { map, toNorm } = useCampusMap()`，返回 `null`（不渲染任何 DOM）
- [ ] 在依赖 `[map, toNorm]` 的 `useEffect` 中：`map` 为 null 时直接返回；注册 `click` 处理器，`const { x, y } = toNorm(e.latlng)`，`L.popup().setLatLng(e.latlng).setContent(\`归一化坐标 (${x.toFixed(3)}, ${y.toFixed(3)})\`).openOn(map)`；cleanup 中 `map.off('click', handler)`
- [ ] 确认 popup 内容与现状完全一致（`归一化坐标 (x, y)`，保留三位小数）；切换图层时旧实例监听先移除、新实例就绪后重绑，切换 5 次后点击只弹出一个 popup

### 12.6 MapView 改造（`pages/MapView.tsx`）
- [ ] 在 `frontend/src/pages/MapView.tsx` 移除 Leaflet 相关 import（`L`、`leaflet/dist/leaflet.css`、`getLayerImage`）与全部实例生命周期/点击/markers 逻辑（`containerRef`、`mapRef`、`markerGroupRef`、两个地图相关 `useEffect`）
- [ ] 图层获取改为 `const { data: layers, error: layersError } = useLayers()`，`selected`/`calibrated`/`imageError` 状态保留
- [ ] 组装 markers：staff/admin 时 `listSimulatedPoints(selected)` 映射为 `MapMarker`（`x = p.norm_x`、`y = p.norm_y`、`label = \`${p.label}（模拟点位）\``、`color = cssVar('--color-warning')`）
- [ ] 渲染：`{layer && <CampusMap layer={layer} markers={markers} onImageError={setImageError}><ClickCoordsPopup /></CampusMap>}`；`onMapClick` 当前不传（为后续标点/圈范围/画路径预留）
- [ ] 保留图层选择 `<select>`、`hint` 文案、`ErrorNotice`、空态提示与 `calibrated` 展示不变；`MapView.module.css` 的 `.hint` 继续使用

### 12.7 验收
- [ ] 执行 `cd frontend && npm run lint`，通过（无 `any`、无未用导入、无内联 `style`）
- [ ] 执行 `cd frontend && npm run build`，通过（`tsc -b` 类型检查 + vite 构建）
- [ ] 手工检查（需在可访问前后端的终端执行）：室外图正常显示底图
- [ ] 切换到无底图楼层显示占位矩形
- [ ] 来回切换图层 5 次，页面始终只有一个地图实例（无残留 DOM 节点）
- [ ] 点击地图弹出 `归一化坐标 (x, y)`，内容与改造前一致
- [ ] 切换图层 5 次后点击地图，坐标 popup 正常弹出且只弹出一个
- [ ] 离开地图页再返回无报错（实例与事件监听正确销毁）
- [ ] `ClickCoordsPopup` 作为 `useCampusMap` 验证用例：组件内成功获取 `map` 与换算函数，切换图层后拿到新实例
---

## 13. v2.0 功能任务（F1–F16）

> 对应 `spec.md` v2.0 与 `design.md` 2.17–2.25。第 1–12 章的 T01–T24 为 v1.0 基线，继续有效；本章任务在其上叠加，**不得删除或改变认领、核验、归还、协助工单的既有行为**，既有测试必须继续通过。
>
> 通用约束：后端只新增 `httpx`、`Pillow`；前端不新增依赖；所有新接口声明 `response_model`、支持 `limit/offset`（默认 20，最大 100）；出错统一抛 `ApiError`；新增/修改表结构必须提供 Alembic 迁移；每个新接口至少三类测试（正常、无权限、非法输入或状态冲突）；前端 375px 宽度下完整可用、可点击区域不小于 44px。

### 13.0 任务依赖图

```mermaid
graph TD
    F1[F1 教职工注册与审核] --> F4
    F2[F2 应用框架与底部导航] --> F3
    F2 --> F4
    F3 --> F4
    F4[F4 照片上传与存储抽象] --> F5
    F5[F5 卡片/详情/撤销/找回] --> F6
    F6[F6 评论/点赞/收藏] --> F7
    F7[F7 接取委托/致谢/积分称号] --> F14
    F2 --> F8
    F8[F8 2.5D 底图与建筑] --> F9
    F9[F9 建筑层与点位层] --> F10
    F10[F10 绘制工具与地图发帖] --> F11
    F11[F11 求助/监控/楼层图] --> F14
    F2 --> F12
    F12[F12 模型客户端与智能发帖] --> F13
    F13[F13 演示数据与地点推荐] --> F14
    F14[F14 我的页面整合] --> F15
    F15[F15 生产部署] --> F16[F16 全流程回归]
```

| ID | 标题 | 前置依赖 | 主要交付 |
|---|---|---|---|
| F1 | 教职工注册与审核 | — | `staff_application_service`、4 个接口、迁移 |
| F2 | 应用框架与底部导航 | — | 路由重构、AppShell、底部/侧边导航 |
| F3 | 视觉风格落地 | F2 | tokens、基础组件、模块样式 |
| F4 | 照片上传与存储抽象 | F1、F2、F3 | `upload_service`、`StorageBackend`、`/uploads` |
| F5 | 卡片/详情/撤销/找回 | F4 | `withdraw`、`mark-found`、Hall/Detail 改版 |
| F6 | 评论/点赞/收藏 | F5 | `comment_service`、`reaction_service` |
| F7 | 接取委托/致谢/积分称号 | F6 | `helper_service`、`points_service` |
| F8 | 2.5D 底图与建筑数据 | F2 | `building` 表、`building_service`、配置导入 |
| F9 | 建筑层与帖子点位层 | F8 | `BuildingLayer`、`ItemPointsLayer`、聚合 |
| F10 | 绘制工具与从地图发帖 | F9 | `DrawToolLayer`、`useDrawTool` |
| F11 | 求助/监控/楼层图 | F10 | 点位过滤接口、`FloorSwitcher` |
| F12 | 模型客户端与智能发帖 | F2 | `ai_service`、`/ai/draft-post` |
| F13 | 演示数据与地点推荐 | F12 | `seed_demo.py`、`/ai/search-advice`、热力层 |
| F14 | 我的页面整合 | F7、F11、F13 | `/me`、`/me/*`、工作人员入口 |
| F15 | 生产部署 | F14 | Nginx、生产镜像、ECS 部署说明 |
| F16 | 全流程回归测试 | F15 | 回归用例与手工验收清单 |

---

### 13.1 F1 教职工注册与审核

**目标**：学生可自助注册；注册时可选「教职工」身份并提交工号与部门，申请进入「待审核」；审核通过前 `role` 保持 `student`（按学生权限），管理员通过后 `role` 改为 `staff`，拒绝须填理由且申请人可见。

**涉及文件**
- 后端：`backend/app/models/enums.py`（新增 `StaffStatus`）、`backend/app/models/user.py`（新增 `staff_status`/`staff_no`/`department`/`staff_reject_reason`）、`backend/app/schemas/staff_application.py`（新建）、`backend/app/schemas/auth.py`、`backend/app/services/staff_application_service.py`（新建）、`backend/app/services/auth_service.py`、`backend/app/api/v1/staff_applications.py`（新建，或在 `admin.py` 内挂载）、`backend/app/api/v1/router.py`
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（与 F4–F13 共用同一 v2 增量迁移，首个建表任务负责创建，后续任务追加内容）
- 测试：`backend/tests/test_staff_application.py`（新建）
- 前端：`frontend/src/pages/Register.tsx`、`frontend/src/pages/StaffApplications.tsx`（新建，管理员审核）、`frontend/src/api/staffApplications.ts`（新建）、`frontend/src/api/auth.ts`、`frontend/src/types.ts`

**依赖任务**：无（后端可立即开始）；前端页面依赖 F2 的路由与页面骨架。

**接口**（详见 `design.md` 2.21.1）
- `POST /me/staff-application`：登录且 `role=student` 且无 pending/approved 记录；`staff_no` 4~20 位字母或数字；`department` ≤64 选填。
- `GET /admin/staff-applications`：仅 `admin`，`status` 默认 `pending`。
- `POST /admin/staff-applications/{user_id}/approve`：仅 `admin`，`pending → approved`，`role` 改为 `staff`。
- `POST /admin/staff-applications/{user_id}/reject`：仅 `admin`，`reason` 必填 ≤500。

**验收标准**
- [ ] 迁移生成成功，`user` 表含 4 个新列，`alembic check` 无差异
- [ ] 正常：学生提交合法工号后 `staff_status=pending`、`role=student`；管理员通过后 `role=staff`
- [ ] 无权限：学生调用 `GET /admin/staff-applications` 或 approve/reject 返回 403
- [ ] 非法输入：工号少于 4 位、含非字母数字、拒绝理由为空分别返回 400；重复申请返回 409
- [ ] 审核通过前调用 staff 专属接口（如核验认领）返回 403（验证「审核前按学生权限」）
- [ ] 拒绝后申请人可查询到 `staff_status=rejected` 与 `staff_reject_reason`
- [ ] 注册页可选「学生 / 教职工」，选教职工时工号必填、部门选填；375px 下表单无横向滚动、控件高度 ≥44px
- [ ] 管理员审核页可看申请列表并通过/拒绝（拒绝弹窗含理由输入）
- [ ] `cd backend && .venv/Scripts/python -m pytest tests/ -q` 通过；`ruff check .`、`ruff format --check .` 通过
- [ ] `cd frontend && npm run lint && npm run build` 通过

---

### 13.2 F2 应用框架与底部导航

**目标**：重构应用外壳与路由。移动端底部固定四标签（大厅/地图/AI/我的），≥768px 改为左侧导航；统一页面头部；旧路径重定向到新路径；工作人员与管理员专属入口从「我的」页进入。

**涉及文件**
- 前端：`frontend/src/App.tsx`、`frontend/src/components/AppShell/AppShell.tsx` + `AppShell.module.css`（新建）、`BottomNav.tsx`、`SideNav.tsx`、`PageHeader.tsx`（均新建）、`frontend/src/pages/Hall.tsx`（由 `Home.tsx` 改名）、`frontend/src/pages/ItemDetail.tsx`（由 `ItemDetail` 旧路由迁移）、`frontend/src/pages/AiPage.tsx`（新建占位）、`frontend/src/pages/Me.tsx`（新建占位）、`frontend/src/auth/AuthContext.tsx`
- 后端：无（仅前端路由）

**依赖任务**：无。

**路由**（详见 `design.md` 2.22.1）
- 新路由：`/hall`、`/hall/:id`、`/publish`、`/map`、`/ai`、`/me`、`/me/*`、`/staff/claims`、`/staff/tickets`、`/admin/staff-applications`
- 重定向：`/` → `/hall`；`/items/:id` → `/hall/:id`；`/tickets` → `/staff/tickets`

**验收标准**
- [ ] 375px 下底部四标签固定可见，四页均可到达；单标签点击区域 ≥44×44px，无横向滚动
- [ ] ≥768px 时底部导航切换为左侧导航，内容区无遮挡
- [ ] 页面头部在四个主页面一致（标题、返回、右侧操作区）
- [ ] 旧路径 `/`、`/items/:id`、`/tickets` 均重定向到新路径，浏览器历史无死循环
- [ ] 未登录访问受保护路由跳转登录；学生访问 staff/admin 路由不渲染专属入口（权限仍以后端为准）
- [ ] 「我的」页包含工作人员/管理员专属入口占位（F14 完成内容）
- [ ] `npm run lint`、`npm run build` 通过；375px 手工检查无横向滚动

---

### 13.3 F3 视觉风格落地

**目标**：建立 v2.0 设计变量与基础组件，供后续所有页面复用。风格另定，但必须满足移动端优先与 token 约束。

**涉及文件**
- 前端：`frontend/src/styles/tokens.css`（扩展颜色、间距、圆角、字号、阴影、层级）、`frontend/src/styles/global.css`、`frontend/src/components/ui/Button.tsx` + `.module.css`、`Card.tsx` + `.module.css`、`Input.tsx` + `.module.css`、`Textarea.tsx` + `.module.css`、`Select.tsx` + `.module.css`、`Tag.tsx` + `.module.css`、`Avatar.tsx` + `.module.css`、`EmptyState.tsx`、`LoadingState.tsx`、`ErrorState.tsx`（均新建）

**依赖任务**：F2。

**验收标准**
- [ ] 所有基础组件只引用 `tokens.css` 变量，无硬编码颜色/间距/字号；无内联 `style`
- [ ] `Button` 支持 `primary/secondary/ghost/danger` 与 `disabled` 状态，最小高度 44px
- [ ] `Input`/`Textarea`/`Select` 必须接受 `label` 或 `aria-label`，聚焦态可见
- [ ] 加载中/出错/空数据三态组件可复用，文案为中文
- [ ] 375px 下组件不溢出；≥768px 下不拉伸变形
- [ ] `npm run lint`、`npm run build` 通过

---

### 13.4 F4 照片上传与存储抽象

**目标**：实现照片上传、Pillow 去 EXIF、存储抽象（本地 `storage/`，预留 OBS）、受控下载与拾获帖照片可见性控制；发布表单支持最多 6 张照片。

**涉及文件**
- 后端：`backend/app/models/enums.py`（`AttachmentPurpose`）、`backend/app/models/attachment.py`（新增 5 列）、`backend/app/services/upload_service.py`（新建）、`backend/app/services/storage/base.py`、`local.py`、`factory.py`（新建）、`backend/app/api/v1/uploads.py`（新建）、`backend/app/schemas/upload.py`（新建）、`backend/app/config.py`（`STORAGE_DIR`、`STORAGE_BACKEND`）、`backend/app/api/v1/items.py`（`POST /items/{id}/photos`、发布时 `photo_ids`）、`backend/requirements.txt`（新增 `Pillow`）
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（`attachment` 加列）
- 测试：`backend/tests/test_upload.py`（新建）、`backend/tests/test_item_photos.py`（新建）
- 前端：`frontend/src/api/uploads.ts`（新建）、`frontend/src/components/PhotoUploader/PhotoUploader.tsx` + `.module.css`（新建）、`frontend/src/pages/ItemForm.tsx`、`frontend/src/pages/ItemDetail.tsx`

**依赖任务**：F1（迁移基线）、F2、F3。

**接口**（详见 `design.md` 2.21.2）
- `POST /uploads`：multipart，jpg/png/webp，单张 ≤5MB。
- `GET /uploads/{id}`：按可见性鉴权（寻物帖公开；拾获帖仅发布者与 staff/admin；评论图按评论可见性）。
- `POST /items/{id}/photos`：发布者本人，最多 6 张。

**验收标准**
- [ ] 迁移成功，`attachment` 含 `owner_user_id`/`comment_id`/`purpose`/`mime`/`size`
- [ ] 正常：上传 jpg/png/webp 成功，返回 `{id,url,mime,size}`；下载可获取图片
- [ ] 异常：非 jpg/png/webp 或 >5MB 返回 400；上传后图片 EXIF 中位置信息已移除
- [ ] 无权限：他人访问拾获帖照片 `GET /uploads/{id}` 返回 403；其他用户删除/替换照片返回 403
- [ ] 状态冲突：一次绑定超过 6 张返回 400；引用不存在或非本人上传的 `photo_ids` 返回 400
- [ ] 前端选择照片后展示缩略图、可删除；提交期间按钮禁用；单张超 5MB 或超过 6 张时前端提示
- [ ] 前端压缩长边不超过 1600px 后再上传（不新增依赖）
- [ ] 拾获帖详情对非发布者/非工作人员显示「为防冒领，照片已隐藏」
- [ ] `pytest tests/ -q`、`ruff check .`、`ruff format --check .` 通过；`npm run lint && npm run build` 通过
- [ ] 375px 下照片网格不溢出，删除按钮 ≥44px

---

### 13.5 F5 帖子卡片与详情改版、撤销与「我已找回」

**目标**：大厅卡片与详情展示首图、类型标签、标题、状态、建筑+楼层、发布时间、点赞/评论/接取人数；支持发布者撤销帖子与自行标记「我已找回」。

**涉及文件**
- 后端：`backend/app/models/item.py`（`building_id`/`floor`）、`backend/app/services/item_service.py`（`withdraw_item`、`mark_found`）、`backend/app/api/v1/items.py`、`backend/app/schemas/item.py`（`ItemPublic` 扩展计数字段与 `building_name`/`floor`）
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（`item` 加列）
- 测试：`backend/tests/test_item_lifecycle.py`（新建或扩展）
- 前端：`frontend/src/pages/Hall.tsx`、`frontend/src/components/ItemCard/ItemCard.tsx` + `.module.css`（新建）、`frontend/src/pages/ItemDetail.tsx`、`frontend/src/api/items.ts`、`frontend/src/types.ts`

**依赖任务**：F4。

**接口**（详见 `design.md` 2.21.3）
- `POST /items/{id}/withdraw`：发布者本人；`lost/searching`、`found/pending`、`reviewing` 且无已通过认领可撤销。
- `POST /items/{id}/mark-found`：发布者本人；仅 `lost/searching` 且无 `approved` 认领。

**验收标准**
- [ ] 正常：发布者撤销后状态为 `withdrawn`；发布者标记后状态为 `found`
- [ ] 无权限：非发布者调用两个接口返回 403；未登录 401
- [ ] 状态冲突：已找回/已归还/已撤销再次撤销返回 409；存在已通过认领时 `mark-found` 返回 409
- [ ] 卡片展示首图缩略图、寻物/拾获标签、标题、状态、建筑名与楼层、发布时间、点赞数、评论数、接取人数
- [ ] 筛选支持关键词、类型、类别、状态、建筑；分页为「加载更多」，追加不重复
- [ ] 详情页按身份显示「撤销」「我已找回」按钮，提交期间禁用；成功后状态即时更新
- [ ] 建筑+楼层为空时显示「未指定地点」，不报错
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过
- [ ] 375px 下卡片单列展示、按钮 ≥44px、无横向滚动

---

### 13.6 F6 评论、点赞、收藏

**目标**：实现评论（1~500 字、最多 3 图、仅一层回复、软删除）与点赞/收藏（一人一次、可取消、计数子查询）。

**涉及文件**
- 后端：`backend/app/models/comment.py`、`item_like.py`、`item_favorite.py`（新建）、`backend/app/services/comment_service.py`、`reaction_service.py`（新建）、`backend/app/api/v1/comments.py`、`reactions.py`（新建）、`backend/app/schemas/comment.py`、`reaction.py`（新建）、`backend/app/api/v1/items.py`、`backend/app/api/v1/me.py`
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（建 3 表 + `attachment.comment_id`）
- 测试：`backend/tests/test_comments.py`、`backend/tests/test_reactions.py`（新建）
- 前端：`frontend/src/components/CommentList/CommentList.tsx` + `.module.css`、`CommentItem.tsx`、`CommentComposer.tsx`、`LikeButton.tsx`、`FavoriteButton.tsx`（新建）、`frontend/src/api/comments.ts`、`reactions.ts`（新建）、`frontend/src/pages/ItemDetail.tsx`

**依赖任务**：F5。

**接口**（详见 `design.md` 2.21.4、2.21.5）
- `GET/POST /items/{id}/comments`；`DELETE /comments/{id}`
- `POST/DELETE /items/{id}/like`；`POST/DELETE /items/{id}/favorite`

**验收标准**
- [ ] 正常：登录用户发表评论成功；回复仅一层；本人/工作人员/管理员删除后显示「该评论已删除」
- [ ] 异常：内容为空或 >500 字返回 400；评论图 >3 张返回 400；父评论已删除或层级非法返回 409
- [ ] 无权限：未登录评论/点赞/收藏返回 401；非本人且非 staff/admin 删除评论返回 403
- [ ] 点赞/收藏一人一次，重复 POST 幂等、取消后计数回落；`UNIQUE(item_id,user_id)` 生效
- [ ] 列表/详情返回计数与 `is_liked`/`is_favorited`；计数用子查询，无冗余计数字段
- [ ] 评论数为未软删除评论数
- [ ] 前端评论输入有 `label`/`aria-label`，提交期间禁用；点赞/收藏按钮状态即时切换
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过
- [ ] 375px 下评论区可完整操作、按钮 ≥44px

---

### 13.7 F7 接取委托、致谢、积分与称号

**目标**：登录用户可对「寻找中/核验中」寻物帖接取委托并随时放弃；发布者找回后可从协助者中选最多 3 人致谢；积分仅经 `points_service` 写入，同一事件对同一人只计一次；称号按累计积分计算。

**涉及文件**
- 后端：`backend/app/models/item_helper.py`、`point_record.py`（新建）、`backend/app/models/enums.py`（`HelperStatus`、`PointReason`）、`backend/app/services/helper_service.py`、`points_service.py`（新建）、`backend/app/services/claim_service.py`（归还完成后 +15）、`backend/app/services/ticket_service.py`（反馈后 +10）、`backend/app/api/v1/helpers.py`、`backend/app/api/v1/me.py`、`backend/app/schemas/helper.py`、`points.py`（新建）
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（建 2 表 + 唯一约束 `uq_point_record_user_reason_ref`）
- 测试：`backend/tests/test_helpers.py`、`backend/tests/test_points.py`（新建）
- 前端：`frontend/src/components/HelperList/HelperList.tsx` + `.module.css`、`ThankDialog.tsx`（新建）、`frontend/src/api/helpers.ts`、`points.ts`（新建）、`frontend/src/pages/ItemDetail.tsx`

**依赖任务**：F6。

**接口**（详见 `design.md` 2.21.6、2.21.7）
- `POST/DELETE /items/{id}/helpers`；`POST /items/{id}/thank`；`GET /me/points`

**验收标准**
- [ ] 正常：非发布者接取成功，`helper_count` +1；放弃后回落；致谢 1~3 人成功并各自 +20
- [ ] 无权限：发布者接取自己的帖子返回 403；非发布者致谢返回 403；未登录 401
- [ ] 状态冲突：非「寻找中/核验中」接取返回 409；重复接取返回 409；未接取放弃返回 409；帖子非「已找回」致谢返回 409；致谢 >3 人返回 400
- [ ] 积分唯一：同一 `(user_id, reason, ref_id)` 重复触发只计一次；重复致谢不重复加分
- [ ] 拾获帖完成归还后拾获者 +15；工作人员工单反馈 +10；发帖/评论/点赞不产生积分
- [ ] `GET /me/points` 返回 `total/title/next_title/next_threshold` 与分页明细
- [ ] 称号阈值命中：0/20/60/150/300 分别对应见习寻物人/热心同学/寻物能手/校园守护者/寻物传说
- [ ] 既有「协助徽章」逻辑保留，与积分称号并存
- [ ] 前端详情页显示协助者人数与名单（昵称+称号）；致谢弹窗最多选 3 人
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过；375px 下按钮 ≥44px

---

### 13.8 F8 2.5D 底图与建筑数据接入

**目标**：室外底图更换为 2.5D 立体校园示意图；建筑数据（编号、名称、类别、层数、点击区域、标签位置）通过配置文件导入数据库；坐标统一为左下角原点。

**涉及文件**
- 后端：`backend/app/models/building.py`（新建）、`backend/app/services/building_service.py`（新建）、`backend/app/api/v1/buildings.py`（新建）、`backend/app/schemas/building.py`（新建）、`backend/app/data/buildings.json`（新建配置）、`backend/seed.py` 或 `backend/scripts/import_buildings.py`（新建）、`backend/app/models/layer.py`（`building_id`/`floor`）、`backend/app/models/item.py`（已在 F5）、`backend/app/api/v1/router.py`
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（建 `building`、`layer` 加列、`item` 加列）
- 测试：`backend/tests/test_buildings.py`（新建）
- 前端：`frontend/public/map/campus-2.5d.png`（自备静态底图，[假设]）、`frontend/src/api/buildings.ts`（新建）、`frontend/src/types.ts`

**依赖任务**：F2。

**接口**（详见 `design.md` 2.21.9）
- `GET /buildings`（`category?`、分页）；`GET /buildings/{id}`

**验收标准**
- [ ] 迁移成功，`building` 表字段与 `design.md` 2.18.2 一致，`code` 唯一、`category` 有索引
- [ ] 配置导入幂等：重复执行不产生重复建筑；`click_region`/`label_position` 为归一化坐标（左下角原点）
- [ ] 正常：`GET /buildings` 返回分页列表；`GET /buildings/{id}` 返回详情与 `active_item_count`、`has_floor_map`
- [ ] 无权限：未登录访问返回 401
- [ ] 异常：不存在的建筑 id 返回 404
- [ ] 前端地图加载 2.5D 底图；底图路径不存在时显示占位矩形且不崩溃
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过

---

### 13.9 F9 建筑层与帖子点位层（含聚合）

**目标**：以 `CampusMap` 子组件实现可独立开关的建筑层与帖子点位层；点击建筑弹出建筑卡片；寻物/拾获使用不同图标；点位密集时聚合为数字气泡。

**涉及文件**
- 前端：`frontend/src/components/CampusMap/BuildingLayer.tsx`、`ItemPointsLayer.tsx`、`BuildingCard.tsx` + `.module.css`（新建）、`frontend/src/utils/cluster.ts`（新建，自行实现聚合）、`frontend/src/hooks/useCampusMapLayers.ts`（新建或扩展 `useLayers`）、`frontend/src/pages/MapView.tsx`、`frontend/src/api/buildings.ts`、`frontend/src/api/items.ts`
- 后端：`backend/app/api/v1/items.py`（列表支持 `building_id` 筛选，若 F5 未覆盖）

**依赖任务**：F8。

**验收标准**
- [ ] 建筑层与帖子点位层可分别开关，互不影响；切换后无残留图层
- [ ] 点击建筑弹出卡片：名称、类别、进行中帖子数、「查看相关帖子」、「进入楼层」（有平面图时可用）
- [ ] 寻物与拾获点位图标可区分；点位密集时聚合为数字气泡，点击展开列表
- [ ] 聚合算法自行实现，不新增第三方依赖；缩放到不同级别时聚合结果正确重算
- [ ] 图层组件为 `null` 渲染，通过 `useCampusMap()` 获取实例；`map` 为 `null` 时跳过注册
- [ ] `npm run lint`、`npm run build` 通过；375px 下地图可操作、卡片按钮 ≥44px
- [ ] 手工回归：切换图层 5 次后仅一个地图实例

---

### 13.10 F10 绘制工具与从地图发帖

**目标**：实现手指可用的标点、圈范围、画路径工具（完成、撤销上一步、清空）；绘制完成后可「发布到大厅」，带入位置与建筑到发布表单。

**涉及文件**
- 前端：`frontend/src/components/CampusMap/DrawToolLayer.tsx` + `.module.css`、`frontend/src/hooks/useDrawTool.ts`（新建）、`frontend/src/pages/MapView.tsx`、`frontend/src/pages/ItemForm.tsx`、`frontend/src/api/items.ts`
- 后端：`backend/app/models/route.py`（`visibility` 替换 `is_private`）、`backend/app/services/item_service.py`（发布时接收 `geometry`/`building_id`/`floor`）、`backend/app/schemas/item.py`
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（`route.visibility` + 数据回填 + 删 `is_private`）
- 测试：`backend/tests/test_route_visibility.py`（新建）

**依赖任务**：F9。

**验收标准**
- [ ] 标点：点一下生成点位；圈范围：点圆心后拖拽调整半径；路径：依次点击、支持完成/撤销上一步/清空
- [ ] 触摸与鼠标均可操作；375px 下工具按钮 ≥44px 且不遮挡地图关键区域
- [ ] 圈选默认 `public`、路径默认 `private`，均可在发布表单切换
- [ ] 「发布到大厅」跳转 `/publish` 并带入位置、建筑与楼层；返回地图不丢失其他状态
- [ ] 私有路线仅本人与「已授权且工单分配」的处理人员可见；他人访问返回 403
- [ ] 迁移完成 `is_private → visibility` 数据转换，旧字段删除后相关接口改为返回 `visibility`
- [ ] 未标定比例尺时不显示实际米数
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过

---

### 13.11 F11 求助点位层、监控点位层与楼层图

**目标**：新增求助点位（保卫处/服务台/失物招领处，所有人可见）与监控点位（仅模拟数据、仅工作人员可见、标注「模拟」）；有平面图的建筑可进入楼层图并切换楼层（首批 1~2 栋）。

**涉及文件**
- 后端：`backend/app/models/simulated_point.py`（`kind`/`is_public`）、`backend/app/api/v1/layers.py`（`GET /layers/{id}/points`）、`backend/app/schemas/layer.py`、`backend/seed.py`（求助点与模拟监控点）
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（`simulated_point` 加列）
- 测试：`backend/tests/test_layer_points.py`（新建）
- 前端：`frontend/src/components/CampusMap/HelpPointsLayer.tsx`、`MonitorPointsLayer.tsx`、`FloorSwitcher.tsx` + `.module.css`（新建）、`frontend/src/api/layers.ts`、`frontend/src/pages/MapView.tsx`

**依赖任务**：F10。

**接口**（详见 `design.md` 2.21.10）
- `GET /layers/{id}/points`：按身份过滤；监控点仅 staff/admin。

**验收标准**
- [ ] 正常：所有登录用户可见求助点位；staff/admin 额外可见监控点位且界面标注「模拟」
- [ ] 无权限：学生请求不返回 `monitor_point`，`has_monitor=false`
- [ ] 异常：不存在的 layer 返回 404；未登录 401
- [ ] 求助点位层/监控点位层可独立开关；监控层仅工作人员可开启
- [ ] 楼层图：首批 1~2 栋可进入并切换楼层，返回室外不迷路；无平面图的建筑不显示「进入楼层」
- [ ] 375px 下楼层切换控件可点击（≥44px）
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过

---

### 13.12 F12 模型客户端与智能整理发帖

**目标**：实现 OpenAI 兼容模型客户端（可配置 ModelArts Studio 等），超时 10 秒、未配置或失败时降级；AI 页对话式界面支持自然语言生成发帖草稿，草稿经用户确认后才发布。

**涉及文件**
- 后端：`backend/app/config.py`（`MODEL_BASE_URL`、`MODEL_NAME`、`MODEL_API_KEY`、`MODEL_TIMEOUT_SECONDS=10`）、`backend/app/services/model_client.py`（新建，httpx）、`backend/app/services/ai_service.py`（新建）、`backend/app/api/v1/ai.py`（新建）、`backend/app/schemas/ai.py`（新建）、`backend/app/api/v1/router.py`、`backend/requirements.txt`（新增 `httpx`）、`.env.example`
- 测试：`backend/tests/test_ai_draft.py`（新建，模型调用用 mock，不访问外网）
- 前端：`frontend/src/pages/AiPage.tsx`、`frontend/src/components/AiChat/AiChat.tsx` + `.module.css`（新建）、`frontend/src/api/ai.ts`（新建）、`frontend/src/pages/ItemForm.tsx`、`frontend/src/types.ts`

**依赖任务**：F2（前端壳）；后端可先于 F8–F11 启动。

**接口**（详见 `design.md` 2.21.11）
- `POST /ai/draft-post`：登录；`text` 1~2000；返回草稿，不落库。

**验收标准**
- [ ] 正常：输入自然语言返回 `category/title/description/location_area/building_code/floor/time_occurred`，`source=model`
- [ ] 异常：`text` 为空返回 400；模型超时/不可用返回降级结果与 `degraded=true`，不返回 500、不阻断
- [ ] 无权限：未登录 401
- [ ] 未配置模型（缺 base_url/name/key 任一）时视为不可用，走降级
- [ ] 发送给模型的内容不含精确位置、联系方式、认领证据、他人私密路径（用测试断言请求体）
- [ ] 草稿不落库；前端展示「AI 生成，仅供参考」及来源（实时模型/规则）
- [ ] 用户确认/修改后跳转发布表单带入字段，提交期间按钮禁用
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过；375px 下对话界面可用

---

### 13.13 F13 演示数据与寻物地点推荐（含 AI 推荐层、热力层）

**目标**：提供一键生成约 60 条演示数据的脚本（标记「演示」）；实现寻物地点推荐（规则打分 + 模型解释，最多 5 个地点与顺序），结果在 AI 推荐层高亮，并提供热力层。

**涉及文件**
- 后端：`backend/scripts/seed_demo.py`（新建）、`backend/app/services/ai_service.py`（`search_advice`）、`backend/app/api/v1/ai.py`、`backend/app/schemas/ai.py`、`backend/app/models/item.py`（`is_demo` 标记，若未包含则加入迁移）、`backend/app/models/building.py`
- 迁移：`backend/alembic/versions/20261018_v2_incremental.py`（如需 `item.is_demo`）
- 测试：`backend/tests/test_search_advice.py`、`backend/tests/test_demo_seed.py`（新建）
- 前端：`frontend/src/components/CampusMap/AIRecommendLayer.tsx`、`HeatmapLayer.tsx` + `.module.css`（新建）、`frontend/src/pages/AiPage.tsx`、`frontend/src/pages/MapView.tsx`、`frontend/src/api/ai.ts`、`frontend/src/components/ItemCard/ItemCard.tsx`（「演示」标签）

**依赖任务**：F12。

**接口**（详见 `design.md` 2.21.11）
- `POST /ai/search-advice`：`item_id` 或 `geometry`，可选 `category`；返回最多 5 个地点、理由与顺序。

**验收标准**
- [ ] 演示脚本可一键生成约 60 条记录，分布在各建筑，标记为演示数据；重复执行不产生重复（幂等）
- [ ] 界面对演示数据展示「演示」标签
- [ ] 正常：规则打分返回 ≤5 个地点，含 `reason` 与 `order`；`source=model` 或 `rule` 正确标注
- [ ] 异常：`item_id` 与 `geometry` 均缺失返回 400；模型不可用时返回规则结果 + 模板解释，`degraded=true`
- [ ] 无权限：使用他人寻物帖的私密路径返回 403；未登录 401
- [ ] 规则打分依据覆盖：与范围/路径距离、建筑历史寻物与拾获数、同类别历史数、建筑类型与类别对应
- [ ] AI 推荐层高亮推荐地点并标注「AI 生成，仅供参考」与来源；热力层可独立开关
- [ ] 推荐结果不包含他人私密数据
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过

---

### 13.14 F14 我的页面整合

**目标**：整合「我的」页面：个人信息（昵称、身份、称号、积分进度）与 8 类列表；工作人员/管理员专属入口从「我的」进入。

**涉及文件**
- 前端：`frontend/src/pages/Me.tsx`、`frontend/src/pages/me/MeFavorites.tsx`、`MeLikes.tsx`、`MeComments.tsx`、`MeHelping.tsx`、`MePoints.tsx`、`MeItems.tsx`、`MeClaims.tsx`、`MeTickets.tsx`（新建）、`frontend/src/components/AppShell/MeMenu.tsx`（新建）、`frontend/src/api/me.ts`（新建）、`frontend/src/pages/StaffApplications.tsx`（F1 已建）
- 后端：`backend/app/api/v1/me.py`（`GET /me/favorites`、`/me/likes`、`/me/comments`、`/me/helping`、`/me/points`）、`backend/app/services/reaction_service.py`、`comment_service.py`、`helper_service.py`、`points_service.py`
- 测试：`backend/tests/test_me_lists.py`（新建）

**依赖任务**：F7、F11、F13。

**验收标准**
- [ ] 正常：四个「我的」列表接口返回分页数据且仅含本人记录
- [ ] 无权限：未登录 401；不能通过参数读取他人收藏/点赞/评论/接取记录（越权返回 403 或空结果，不得泄露）
- [ ] 异常：非法 `limit`（>100 或 <1）返回 400
- [ ] 页面展示昵称、身份（学生/教职工/教职工审核中）、称号、积分与距下一称号进度
- [ ] 列表入口完整：我的发布、我的收藏、我点赞的、我的评论、我的认领、我接取的委托、我的工单、积分明细
- [ ] 工作人员入口：认领审核、协助工单处理；管理员入口：教职工审核；学生不显示（后端仍强制鉴权）
- [ ] 375px 下菜单与列表无横向滚动，可点击项 ≥44px
- [ ] `pytest`、`ruff check/format --check`、`npm run lint/build` 通过

---

### 13.15 F15 生产部署（Nginx、生产镜像、华为云 ECS）

**目标**：提供生产部署方案：前端构建后由 Nginx 提供，后端生产镜像，Docker Compose 编排，可在华为云 ECS 部署。

**涉及文件**
- 部署：`deploy/nginx.conf`（新建，SPA 路由回退 + `/api` 反代）、`frontend/Dockerfile.prod`（新建，多阶段构建）、`backend/Dockerfile.prod`（新建）、`docker-compose.prod.yml`（新建）、`.env.example`（补充 `STORAGE_BACKEND`、模型配置、`STORAGE_DIR`）、`README.md`（部署步骤）、`docs/`（如需部署说明，限本任务范围）
- 配置：`backend/app/config.py`（生产环境变量读取）

**依赖任务**：F14。

**验收标准**
- [ ] `docker compose -f docker-compose.prod.yml up --build` 可启动（用户本地执行）
- [ ] Nginx 托管前端静态文件，`/hall` 等前端路由刷新返回 200（SPA fallback）
- [ ] `/api` 反向代理到后端，鉴权头透传
- [ ] 生产镜像不含 `.env`、密钥、`node_modules`、`.venv`；密钥仅经环境变量注入
- [ ] `storage/` 目录以卷挂载持久化（预留 OBS 切换说明）
- [ ] README 含华为云 ECS 部署步骤与所需安全组端口
- [ ] 前端 `npm run build` 产物可被 Nginx 直接托管

---

### 13.16 F16 全流程回归测试

**目标**：覆盖 v2.0 全流程回归，确认 v1.0 认领、核验、归还、协助工单行为未改变，新增功能按验收标准工作。

**涉及文件**
- 后端：`backend/tests/test_acceptance.py`（扩展 v2.0 场景）、`backend/tests/test_regression_v2.py`（新建）
- 前端：手工验收清单（写入 `docs/` 或任务总结，不新增依赖）

**依赖任务**：F15。

**验收标准**
- [ ] v1.0 既有验收用例全部通过（权限、私密字段、归还唯一性、工单授权）
- [ ] 新建接口三类用例齐全：正常、无权限、非法输入或状态冲突
- [ ] 端到端手工流程通过：注册（学生/教职工）→ 教职工审核 → 发布（含照片/地图位置）→ 大厅筛选 → 评论/点赞/收藏 → 接取委托 → 认领 → 核验 → 归还 → 致谢与积分 → 我的列表
- [ ] 教职工审核前无法执行 staff 操作；审核通过后可核验；拾获帖照片对他人隐藏
- [ ] AI 草稿与推荐均标注「AI 生成，仅供参考」，模型不可用时手动流程不受阻
- [ ] 375px 下逐页检查：无横向滚动、可点击区域 ≥44px
- [ ] 后端 `pytest tests/ -q`、`ruff check .`、`ruff format --check .` 通过
- [ ] 前端 `npm run lint`、`npm run build` 通过
- [ ] 汇总未解决问题与已知限制（不编造测试结果）
---

## 14. F14 我的页面整合（增量实现，2026-10-20）

**依据**：`spec.md` 6.18（我的页面）、`design.md` 2.26（F14 增量实现方案，2026-10-20 修订）。

**与 13.14 的关系**：13.14 保留为任务级总览，不重写、不删除；本章是 13.14 的可执行分解。13.14 中提到的 `pages/me/MeFavorites.tsx` 等 8 个页面文件与 `components/AppShell/MeMenu.tsx` 方案已被 `design.md` 2.26 取代，**不创建这些文件**，实际文件清单以本章为准。

**允许修改的文件（清单外不改）**
- 后端：`backend/app/api/v1/me.py`、`backend/app/schemas/comment.py`、`backend/app/schemas/item.py`、`backend/app/schemas/claim.py`、`backend/app/services/comment_service.py`（仅新增函数）、`backend/app/services/helper_service.py`（仅新增函数）、`backend/app/services/claim_service.py`（仅新增查询函数）、`backend/app/services/staff_application_service.py`（已批准修复）
- 测试：`backend/tests/test_me_lists.py`（新建）、`backend/tests/test_staff_application.py`（仅新增 1 条）
- 前端：`frontend/src/api/me.ts`、`frontend/src/types.ts`、`frontend/src/components/ItemCard/ItemCard.tsx`、`ItemCard.module.css`、`frontend/src/pages/Me.tsx`、`Me.module.css`、`frontend/src/pages/MeList.tsx`/`MeList.module.css`（新建）、`frontend/src/pages/MePoints.tsx`/`MePoints.module.css`（新建）、`frontend/src/App.tsx`（仅加路由）；删除 `frontend/src/pages/MyDelegations.tsx`（经全仓检索，无外部引用，当前无同名 `.module.css`，若存在一并删除）

**约束**
- 数据库迁移：**无**。不新增表、列、索引；不改模型。
- 不改既有认领、核验、归还、协助工单的行为与测试；不改 `points_service`、`item_service`、`reaction_service`、`ticket_service`、`AuthContext`、`PageHeader`、`AppShell`。
- 后端接口只读：不 `commit`、不加锁、不写积分；身份只取 `get_current_user`，不接受 `user_id` 参数。
- 前端：375px 优先、可点击元素 ≥44px、无内联 `style`、样式变量只取 `tokens.css`、不新增依赖。
- 沙箱约束：不执行 `pytest`、不启动服务、不安装依赖；验证命令见 14.27，由用户本地执行。

### 14.0 任务依赖图

```mermaid
flowchart TD
  B1[14.1 MyCommentOut] --> B8[14.8 GET /me/comments]
  B4[14.4 list_my_comments] --> B8
  B2[14.2 MyHelpingOut] --> B9[14.9 GET /me/helping]
  B5[14.5 list_my_helping] --> B9
  B3[14.3 MyClaimOut] --> B10[14.10 GET /me/claims 扩展]
  B6[14.6 list_my_claims 改造] --> B10
  B7[14.7 重新申请修复] --> T4[14.14 教职工测试]
  B8 --> T1[14.11 评论测试]
  B9 --> T2[14.12 委托测试]
  B8 --> T3[14.13 认领与横切测试]
  B9 --> T3
  B10 --> T3
  T3 --> F1[14.15 前端类型]
  F1 --> F2[14.16 api/me.ts]
  F3[14.17 ItemCard extra] --> F4[14.19 MeList]
  F1 --> F4
  F2 --> F4
  F1 --> F5[14.21 MePoints]
  F1 --> F6[14.23 Me.tsx]
  F2 --> F6
  F4 --> D1[14.25 删除 MyDelegations]
  F4 --> R[14.26 App.tsx 路由]
  F5 --> R
  F6 --> R
  R --> V1[14.27 本地验证]
  V1 --> V2[14.28 手工检查]
```

**顺序说明**：14.1–14.10 后端（schema → service → 路由）；14.11–14.14 测试；14.15–14.18 前端类型、接口层与卡片插槽；14.19–14.24 页面与样式；14.25–14.26 删除旧页与路由；14.27–14.28 验证。后端 14.1/14.2/14.3、14.4/14.5/14.6、14.7 之间互不依赖，可并行；前端 14.17/14.18 可与后端测试并行。

---

### 14.1 新增我的评论响应模型

**目标**：定义 `MyCommentOut`，作为 `/me/comments` 的唯一响应模型，字段与 `design.md` 2.26.2.2 完全一致。

**涉及文件**：`backend/app/schemas/comment.py`（仅追加类）

**依赖任务**：无（可与 14.2、14.3 并行）

**完成标准**
- [ ] 追加 `MyCommentOut`，字段为 `id: UUID`、`item_id: UUID`、`item_title: str`、`content: str`、`created_at: datetime`
- [ ] 不设置 `model_config = ConfigDict(from_attributes=True)`（service 返回 dict）
- [ ] 不包含 `is_deleted`、`parent_id`、`images`、`author`、`replies`
- [ ] `CommentCreate`、`CommentOut`、`CommentDeletedOut` 未改动

---

### 14.2 新增我的委托响应模型

**目标**：定义 `MyHelpingOut(ItemPublic)`，复用大厅帖子字段契约并追加委托字段。

**涉及文件**：`backend/app/schemas/item.py`（仅追加类与 `HelperStatus` 导入）

**依赖任务**：无（可与 14.1、14.3 并行）

**完成标准**
- [ ] 从 `app.models.enums` 追加导入 `HelperStatus`
- [ ] 追加 `MyHelpingOut(ItemPublic)`，字段为 `helper_id: UUID`、`helper_status: HelperStatus`、`thanked: bool`、`taken_at: datetime`
- [ ] 不重新声明大厅字段，不修改 `ItemPublic` 既有字段
- [ ] `backend/app/schemas/helper.py` 未改动（避免循环导入）

---

### 14.3 新增我的认领响应模型

**目标**：定义 `MyClaimOut(ClaimOut)`，仅供 `/me/claims` 使用，追加物品标题。

**涉及文件**：`backend/app/schemas/claim.py`（仅追加类）

**依赖任务**：无（可与 14.1、14.2 并行）

**完成标准**
- [ ] 追加 `MyClaimOut(ClaimOut)`，字段 `item_title: str`
- [ ] `ClaimOut`、`ClaimDetail`、`ClaimCreate`、`ReviewRequest` 未改动
- [ ] `GET /claims`、创建/审核/完成接口的响应模型仍为 `ClaimOut`/`ClaimDetail`

---

### 14.4 实现我的评论查询服务

**目标**：在 `comment_service` 新增 `list_my_comments`，按作者反查未删除评论并联表取帖子标题。

**涉及文件**：`backend/app/services/comment_service.py`（仅新增函数）

**依赖任务**：无（可与 14.5、14.6、14.7 并行）

**完成标准**
- [ ] 函数签名 `list_my_comments(db: Session, user: User, limit: int, offset: int) -> tuple[list[dict], int]`
- [ ] 计数与列表使用完全相同的条件：`comment.author_user_id == user.id` 且 `comment.is_deleted.is_(False)`
- [ ] 列表 `JOIN item ON item.id == comment.item_id`，只取 `item.title`；不过滤 `item.status`（撤销帖照常返回）
- [ ] 排序 `comment.created_at DESC, comment.id DESC`，分页使用 `offset/limit`
- [ ] 每个 item 组装为 `{"id", "item_id", "item_title", "content", "created_at"}`，与 `MyCommentOut` 键一一对应
- [ ] 函数只读：不 `flush`、不 `commit`、不加锁；不读附件表、不算点赞/回复数
- [ ] `_serialize`、`list_comments`、`create_comment`、`delete_comment` 未改动

---

### 14.5 实现我接取的委托查询服务

**目标**：在 `helper_service` 新增 `list_my_helping`，按协助者反查委托记录（含已放弃），返回帖子与委托的成对结果。

**涉及文件**：`backend/app/services/helper_service.py`（仅新增函数）

**依赖任务**：无（可与 14.4、14.6、14.7 并行）

**完成标准**
- [ ] 函数签名 `list_my_helping(db: Session, user: User, limit: int, offset: int) -> tuple[list[tuple[ItemHelper, Item]], int]`
- [ ] 过滤条件仅为 `item_helper.user_id == user.id`，不过滤 `status`（`active` 与 `abandoned` 都返回）
- [ ] 列表 `JOIN item ON item.id == item_helper.item_id`，返回 `(ItemHelper, Item)` 元组
- [ ] 排序 `item_helper.created_at DESC, item_helper.id DESC`，分页使用 `offset/limit`
- [ ] `total` 与列表同条件计数；按每帖一条设计，`total` 即去重帖子数
- [ ] 不在函数内序列化帖子、不调用 `item_service`（避免循环导入）
- [ ] `_active_helper`、`take_helper`、`abandon_helper`、`thank_helpers` 未改动

---

### 14.6 改造我的认领查询为联表取标题

**目标**：改造 `claim_service.list_my_claims`，一次 `JOIN item` 返回 `(Claim, item_title)`，消除前端逐条补查。

**涉及文件**：`backend/app/services/claim_service.py`（仅改造该查询函数）

**依赖任务**：无（可与 14.4、14.5、14.7 并行）

**完成标准**
- [ ] 签名改为 `list_my_claims(db: Session, user: User, limit: int, offset: int) -> tuple[list[tuple[Claim, str]], int]`
- [ ] 过滤 `claim.applicant_user_id == user.id`，计数与列表条件一致
- [ ] 列表 `JOIN item ON item.id == claim.found_item_id`，只取 `item.title`；不过滤 `item.status`
- [ ] 排序 `claim.created_at DESC, claim.id DESC`
- [ ] `list_claims`、`get_claim`、`create_claim`、`review_claim`、`complete_claim` 未改动
- [ ] 全仓检索确认 `list_my_claims` 的调用方仅 `backend/app/api/v1/me.py`，无其他调用点被遗漏

---

### 14.7 修复教职工被拒后重新提交

**目标**：按已批准方案修改 `submit_application`，允许 `rejected` 重新提交并回到待审核。

**涉及文件**：`backend/app/services/staff_application_service.py`

**依赖任务**：无（可与 14.4–14.6 并行）

**完成标准**
- [ ] 保留角色校验：`user.role != Role.student` 返回 403 `FORBIDDEN`「仅学生可提交教职工申请」
- [ ] `StaffStatus.pending` 仍返回 409 `STATE_CONFLICT`「申请正在审核中」
- [ ] `StaffStatus.rejected` 允许提交：写入新 `staff_no`/`department`、`staff_status = pending`、`staff_reject_reason = None`
- [ ] `StaffStatus.approved` 仍返回 409「申请已结束，不能重复提交」（防御性分支）
- [ ] 一次提交只 `commit` 一次，提交后 `refresh` 并返回 `User`
- [ ] `approve`、`reject`、`list_applications` 未改动；不新增接口、不改 `UserOut`

---

### 14.8 新增 GET /me/comments 路由

**目标**：暴露我的评论列表接口，薄封装 14.4 的查询服务。

**涉及文件**：`backend/app/api/v1/me.py`（新增路由与 imports）

**依赖任务**：14.1、14.4

**完成标准**
- [ ] 路由 `GET /me/comments`，`response_model=Page[MyCommentOut]`
- [ ] `limit: int = Query(20, ge=1, le=100)`、`offset: int = Query(0, ge=0)`，无 `user_id` 参数
- [ ] 依赖 `get_current_user` 鉴权；调用 `comment_service.list_my_comments` 后返回 `Page(items=..., total=..., limit=limit, offset=offset)`
- [ ] handler 不写业务判断、不拼接 SQL、不 `commit`
- [ ] `GET /me/items`、`/me/claims`、`/me/tickets`、`/me/badges`、`/me/likes`、`/me/favorites`、`/me/points` 行为不变

---

### 14.9 新增 GET /me/helping 路由

**目标**：暴露我接取的委托列表，复用大厅序列化保证字段一致。

**涉及文件**：`backend/app/api/v1/me.py`（新增路由、`_merge_helping` 私有辅助与 imports）

**依赖任务**：14.2、14.5

**完成标准**
- [ ] 路由 `GET /me/helping`，`response_model=Page[MyHelpingOut]`
- [ ] `limit`/`offset` 约束与 `/me/comments` 一致，无 `user_id` 参数
- [ ] 调用 `helper_service.list_my_helping` 后，用 `item_service.serialize_items(db, [item for _, item in rows], user)` **一次**批量序列化
- [ ] `_merge_helping` 以帖子 `id` 建索引，按 `rows` 顺序输出 `{**payload[item.id], "helper_id": helper.id, "helper_status": helper.status, "thanked": helper.thanked, "taken_at": helper.created_at}`
- [ ] 每帖最多一条记录；不因按 `item.id` 索引而丢行或改变顺序
- [ ] 响应不含 `precise_location`、`norm_x`、`norm_y`、`layer_id`、`routes`、联系方式、认领证据

---

### 14.10 扩展 GET /me/claims 响应

**目标**：将 `/me/claims` 的响应模型切换为 `Page[MyClaimOut]`，由 14.6 的结果直接带出 `item_title`。

**涉及文件**：`backend/app/api/v1/me.py`（改造既有 `my_claims` 与 imports）

**依赖任务**：14.3、14.6

**完成标准**
- [ ] `my_claims` 的 `response_model` 改为 `Page[MyClaimOut]`
- [ ] 逐条组装 `MyClaimOut(**ClaimOut.model_validate(claim).model_dump(), item_title=title)`，保留 `ClaimOut` 全部字段
- [ ] 返回 `Page(items=..., total=total, limit=limit, offset=offset)`，排序沿用 service
- [ ] 其他认领接口（`/claims`、创建、审核、完成）未改动
- [ ] 前端所需 `item_title` 由本接口一次返回，无逐条补查

---

### 14.11 新建 test_me_lists.py 与评论用例（5 条）

**目标**：新建我的列表接口测试文件，先覆盖评论接口的正常、越权、分页、未登录与非法参数。

**涉及文件**：`backend/tests/test_me_lists.py`（新建）

**依赖任务**：14.8

**完成标准**
- [ ] 文件内定义辅助 `auth(token)`、`register(client, username) -> (token, user_id)`、`create_item(...)`、`comment(client, token, item_id, content)`、`take(...)`、`abandon(...)`、`thank(...)`，写法参照 `test_reactions.py`/`test_helpers.py`
- [ ] `test_me_comments_returns_only_own_and_undeleted`：A/B 各评论同一帖，A 再发一条并删除；只返回 A 的未删除评论，`total` 正确，字段仅含 `id/item_id/item_title/content/created_at`
- [ ] `test_me_comments_includes_withdrawn_item`：发布者撤销帖子后，评论仍返回，`item_title` 为原标题，`item_id` 正确
- [ ] `test_me_comments_order_and_pagination`：3 条评论，`limit=2&offset=0` 与 `limit=2&offset=2` 两页无重复且并为全集，`created_at` 非递增，`limit/offset` 回显
- [ ] `test_me_comments_requires_login`：不带 Authorization，401 且 `code=UNAUTH`
- [ ] `test_me_comments_rejects_invalid_pagination`：`limit=0`、`limit=101`、`offset=-1` 均 400 且 `code=VALIDATION`
- [ ] 请求路径统一带 `/api/v1` 前缀；不修改 `conftest.py`、不新增 fixture；用例不依赖同秒内严格顺序

---

### 14.12 补齐委托列表用例（5 条）

**目标**：在 `test_me_lists.py` 覆盖 `/me/helping` 的字段、状态分支、分页、未登录与非法参数。

**涉及文件**：`backend/tests/test_me_lists.py`（追加用例）

**依赖任务**：14.9、14.11（复用辅助函数）

**完成标准**
- [ ] `test_me_helping_returns_item_summary_and_helper_state`：A 发 lost，B 接取，C 接取另一帖；B 只看到自己的记录，含大厅字段（`title/status/building_name/first_photo/...`）与 `helper_id/helper_status/thanked/taken_at`
- [ ] `test_me_helping_reports_abandoned_and_thanked`：B 接取两个不同帖子，一帖放弃，另一帖由 A 标记找回并致谢 B；返回 2 条且 `item.id` 不同，放弃记录 `helper_status=abandoned`，被致谢记录 `thanked=true` 且 `helper_status=active`
- [ ] `test_me_helping_order_and_pagination`：3 条不同帖子的接取记录，`limit=2` 分两页，无重复并集完整，按 `taken_at` 非递增，`total=3`
- [ ] `test_me_helping_requires_login`：不带 Authorization，401 且 `code=UNAUTH`
- [ ] `test_me_helping_rejects_invalid_pagination`：`limit=0`、`limit=101`、`offset=-1` 均 400 且 `code=VALIDATION`
- [ ] 不构造“同一帖子多次接取”的数据；状态分支用不同帖子构造

---

### 14.13 补齐认领与横切用例（3 条）

**目标**：覆盖 `/me/claims` 的标题与仅本人语义，以及“忽略他人 user_id”和“私密字段不外泄”两条横切约束。

**涉及文件**：`backend/tests/test_me_lists.py`（追加用例）

**依赖任务**：14.8、14.9、14.10、14.11

**完成标准**
- [ ] `test_me_claims_returns_item_title`：B 认领 A 的拾获帖，C 也提交一条认领；B 的结果只含自己的认领，`item_title` 等于拾获帖标题，`found_item_id/status/created_at` 正确，`total=1`
- [ ] `test_me_lists_ignore_foreign_user_id`：请求 `/me/comments`、`/me/helping`、`/me/claims` 时附带 `?user_id=<他人 id>`；参数被忽略，仍只返回本人数据，不出现他人记录
- [ ] `test_me_lists_hide_private_fields`：helping 返回一条他人发布的 found 帖，claims 返回一条本人认领；两个响应均不含 `precise_location`、`norm_x`、`norm_y`、`layer_id`、`routes`、`contact`、`evidence`，`first_photo` 按大厅规则隐藏
- [ ] 本文件最终恰好包含 2.26.7 列出的 13 条用例，用例名与设计一致

---

### 14.14 补教职工重新申请用例（1 条）

**目标**：验证被拒绝用户可以重新提交申请并回到待审核。

**涉及文件**：`backend/tests/test_staff_application.py`（仅追加 1 条用例）

**依赖任务**：14.7

**完成标准**
- [ ] 新增 `test_rejected_application_can_be_resubmitted`：管理员拒绝申请后，学生用新的 `staff_no/department` 再次 `POST /api/v1/me/staff-application`
- [ ] 断言 200；`staff_status=pending`；`staff_reject_reason is None`；`staff_no/department` 为新值
- [ ] 断言 `GET /auth/me` 同步新状态；管理员待审核列表能再次看到该用户
- [ ] `test_duplicate_application_conflicts` 等 11 条既有用例未修改、未删除、未放宽

---

### 14.15 追加前端类型与积分进度函数

**目标**：补齐 F14 所需前端类型，并提供唯一的进度派生函数，避免前端保存称号阈值。

**涉及文件**：`frontend/src/types.ts`（仅追加）

**依赖任务**：14.3、14.8、14.9、14.10（接口契约确定）

**完成标准**
- [ ] 追加 `HelperStatus = 'active' | 'abandoned'`
- [ ] 追加 `HelpingItem = Item & { helper_id: string; helper_status: HelperStatus; thanked: boolean; taken_at: string }`
- [ ] 追加 `MyComment = { id: string; item_id: string; item_title: string; content: string; created_at: string }`
- [ ] 追加 `MyClaim = Claim & { item_title: string }`
- [ ] 追加 `helperStatusLabels: Record<HelperStatus, string>`：`active → 进行中`、`abandoned → 已放弃`
- [ ] 追加 `pointProgress(total: number, nextThreshold: number | null): number`：`nextThreshold == null` 返回 1，否则返回 `clamp(total / nextThreshold, 0, 1)`
- [ ] **不新增** `pointTitles` 或任何称号阈值常量；不使用 `any`；既有类型未改动

---

### 14.16 扩展前端“我的”接口层

**目标**：在 `api/me.ts` 补齐收藏、点赞、评论、委托四个请求函数，并切换认领返回类型。

**涉及文件**：`frontend/src/api/me.ts`

**依赖任务**：14.15

**完成标准**
- [ ] 新增 `listMyFavorites(params)` → `GET /me/favorites`，返回 `Page<Item>`
- [ ] 新增 `listMyLikes(params)` → `GET /me/likes`，返回 `Page<Item>`
- [ ] 新增 `listMyComments(params)` → `GET /me/comments`，返回 `Page<MyComment>`
- [ ] 新增 `listMyHelping(params)` → `GET /me/helping`，返回 `Page<HelpingItem>`
- [ ] `listMyClaims` 返回类型改为 `Page<MyClaim>`，请求路径不变
- [ ] 全部复用现有 `client` 与 `ListParams`；不新增依赖；页面中不出现接口地址

---

### 14.17 ItemCard 新增 extra 插槽

**目标**：为帖子卡片提供可选的展示型底部插槽，供 helping 列表插入委托状态，且大厅外观不变。

**涉及文件**：`frontend/src/components/ItemCard/ItemCard.tsx`

**依赖任务**：无（可与后端任务并行）

**完成标准**
- [ ] Props 由 `{ item: Item }` 扩展为 `{ item: Item; extra?: ReactNode }`，追加 `ReactNode` 类型导入
- [ ] 在 `Card` 的 body 内、`footer` 之后条件渲染 `<div className={styles.extra}>{extra}</div>`
- [ ] 不传 `extra` 时不渲染该节点，DOM 与当前完全一致
- [ ] 既有首图加载、状态标签、跳转 `/hall/{id}`、计数展示逻辑未改动

---

### 14.18 ItemCard 新增底部插槽样式

**目标**：为 14.17 的插槽提供 375px 友好的换行样式。

**涉及文件**：`frontend/src/components/ItemCard/ItemCard.module.css`（仅追加 `.extra`）

**依赖任务**：14.17

**完成标准**
- [ ] `.extra` 使用 `display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-top: var(--space-2)`
- [ ] 颜色、字号只引用 `tokens.css` 变量，无具体数值颜色
- [ ] 标签内容不超出卡片宽度，不产生横向滚动
- [ ] 既有类名与样式未改动

---

### 14.19 新建通用列表页 MeList

**目标**：实现 `/me/:kind` 通用列表页，覆盖 7 种 kind，统一分页、三态与去重。

**涉及文件**：`frontend/src/pages/MeList.tsx`（新建）

**依赖任务**：14.15、14.16、14.17、14.18

**完成标准**
- [ ] `useParams()` 取 `kind`；不在 `KIND_CONFIG`（`posts/helping/favorites/likes/claims/comments/tickets`）中时返回 `<Navigate to="/me" replace />`
- [ ] `KIND_CONFIG` 为每种 kind 提供页面标题、数据函数与空态文案：`posts → listMyItems`、`helping → listMyHelping`、`favorites → listMyFavorites`、`likes → listMyLikes`、`claims → listMyClaims`、`comments → listMyComments`、`tickets → listMyTickets`
- [ ] 7 种空态文案依次为「还没有发布过寻物或拾获」「还没有接取过委托」「还没有收藏任何记录」「还没有点赞任何记录」「还没有提交过认领申请」「还没有发表过评论」「还没有提交过协助工单」
- [ ] `PageHeader` 传入对应标题与 `backTo="/me"`
- [ ] 首屏 `useAsync(() => fetchPage(kind, 0), [kind])`；`PAGE_SIZE = 20`
- [ ] 追加页存本地 `extra`，`useEffect([kind])` 清空；`loadMore` 以 `offset = data.items.length + extra.length` 请求，`busy` 防重复
- [ ] 追加前按主键去重：帖子类与 helping 用 `item.id`，claims 用 `claim.id`，comments 用评论 `id`，tickets 用 `ticket.id`
- [ ] 帖子类用 `<ul><li key={item.id}><ItemCard item={item} /></li></ul>`；helping 通过 `extra` 传入 `Tag`（进行中/已放弃）、`已被致谢`（`thanked`）与「接取于 YYYY/M/D」`span`，`extra` 内不含按钮或链接
- [ ] claims 行显示 `item_title`、`claimStatusLabels[status]`、申请时间，整行 `<Link to={/hall/${found_item_id}}>`，不调用 `getItem`、不做逐条补查
- [ ] comments 行显示 `content` 60 字摘要（超出加 `…`）、`item_title`、时间，整行链接 `/hall/{item_id}`
- [ ] tickets 行显示 `ticketStatusLabels[status]` 与 `result || '等待处理结果'`，不提供跳转、不展示接单人
- [ ] 首屏三态：`LoadingState` / `ErrorState(onRetry=reload)` / 对应 `EmptyState`；追加失败在底部显示 `ErrorState` 且保留已加载数据
- [ ] `items.length < total` 时才显示「加载更多」；文件 ≤300 行；无内联 `style`

---

### 14.20 新建列表页样式 MeList.module.css

**目标**：为 MeList 的行卡片、标签行、加载更多与 375px 布局提供样式。

**涉及文件**：`frontend/src/pages/MeList.module.css`（新建）

**依赖任务**：14.19

**完成标准**
- [ ] 行卡片使用 `--space-3` 内边距、`--color-border` 边框、`--radius-md` 圆角
- [ ] 长文本 `overflow-wrap: anywhere`；claims 标题使用省略号单行截断
- [ ] 可点击行与「加载更多」高度 ≥44px；列表无横向滚动
- [ ] 颜色、间距、字号、圆角只引用 `tokens.css` 变量；无内联样式

---

### 14.21 新建积分明细页 MePoints

**目标**：实现 `/me/points`，顶部摘要与个人卡片同源同算法，下方为可追加的积分记录。

**涉及文件**：`frontend/src/pages/MePoints.tsx`（新建）

**依赖任务**：14.15；复用既有 `frontend/src/api/points.ts` 的 `getMyPoints`（不修改该文件）

**完成标准**
- [ ] `PageHeader title="积分明细" backTo="/me"`
- [ ] 顶部摘要显示 `title`、`total` 与进度；进度用 `pointProgress(total, next_threshold)`，`next_threshold === null` 显示「已达最高称号」且不渲染进度条
- [ ] 进度条用 `role="progressbar"` 与 `aria-valuenow/aria-valuemin/aria-valuemax`，宽度通过 `Math.round(progress * 10)` 选择 `.p0`…`.p10` 类名，不写内联 `style`
- [ ] 明细每条显示事件说明、`+{amount} 分`、时间；`reason` 映射：`thank → 协助寻物获致谢`、`return → 拾获物品完成归还`、`ticket_feedback → 工单处理反馈`，未知 reason 显示「积分变动」
- [ ] 分页 `PAGE_SIZE = 20`；`loadMore` 用 `records.offset + records.items.length` 追加，`records.total` 判断是否还有更多，`busy` 防重复
- [ ] 首屏三态：`LoadingState` / 整页 `ErrorState(onRetry)` / 「还没有积分记录」；追加失败在底部显示可重试错误且保留已加载记录
- [ ] 文件 ≤300 行；不读取任何前端阈值表；不使用 `any`；无内联 `style`

---

### 14.22 新建积分页样式 MePoints.module.css

**目标**：提供积分摘要、进度条与明细列表样式。

**涉及文件**：`frontend/src/pages/MePoints.module.css`（新建）

**依赖任务**：14.21

**完成标准**
- [ ] 摘要区使用 `--space-4` 内边距与 `display: grid; gap: var(--space-3)`
- [ ] 进度条高度用 `--space-2`、底色 `--color-border`、填充 `--color-primary`、圆角 `--radius-full`；定义 `.p0`…`.p10` 共 11 档宽度（0%~100%，步长 10%）
- [ ] 明细行内边距 `--space-3`、边框 `--color-border`、圆角 `--radius-md`；分值使用主色
- [ ] 375px 下无横向滚动，「加载更多」≥44px；只引用 `tokens.css` 变量

---

### 14.23 重写 Me 页面

**目标**：把个人卡片、拒绝卡与重新申请、数字入口、列表入口、徽章面板、工作人员分组与退出登录整合到 `/me`。

**涉及文件**：`frontend/src/pages/Me.tsx`（重写）

**依赖任务**：14.15、14.16

**完成标准**
- [ ] 个人卡片显示 `displayName || '未设置昵称'`、身份 `Tag`、称号、当前积分与进度；积分来自 `getMyPoints({ limit: 1 })`，失败时卡片底部显示可重试错误，**不显示 0 分或默认称号**
- [ ] 身份标签按优先级：`admin → 管理员`（primary）、`staff → 工作人员`（primary）、`student && staffStatus === 'pending' → 教职工审核中`（warning）、其余 → `学生`（neutral）
- [ ] 进度文案 `再得 ${next_threshold - total} 分成为 ${next_title}`；差值 ≤0 时按已达到处理，不显示负数；`next_threshold === null` 显示「已达最高称号」
- [ ] 进度条宽度通过 `Math.round(pointProgress(total, next_threshold) * 10)` 选择 `.p0`…`.p10` 类名（11 档），不写内联 `style`；进度条带 `role="progressbar"` 与 `aria-valuenow/valuemin/valuemax`
- [ ] 个人卡片点击进入 `/me/points`，卡片内无嵌套按钮/链接
- [ ] `staffStatus === 'rejected'` 时显示拒绝理由（空值显示「未填写拒绝理由」）与「重新申请」；展开表单含 `staff_no`（4~20 位字母或数字）与 `department`（≤64），使用 `Field` 与 `aria-label`
- [ ] 重新申请调用 `api/staffApplications.ts` 的 `applyStaffApplication`；请求期间 `Button loading` 且输入禁用；成功后 `await refresh()` 并显示「申请已提交，等待审核」；失败保留表单并展示后端中文错误
- [ ] 4 个数字入口（发布/接取/收藏/认领）用同一 `useAsync` 包 `Promise.allSettled`，各自以 `limit=1` 取 `total`；失败项显示 `—`，加载中显示 `…`，不显示错误的 0
- [ ] 每个数字入口是 `<Link>`，`aria-label` 形如「我的发布，3 条」，高度 ≥44px
- [ ] 列表入口：我点赞的 `/me/likes`、我的评论 `/me/comments`、我的工单 `/me/tickets`、我的徽章（`<button type="button">` 打开面板）
- [ ] 徽章面板在打开时才请求 `listMyBadges()`；`role="dialog" aria-modal="true"`；点击遮罩或按 `Esc` 关闭；打开时聚焦关闭按钮；`LoadingState`/`ErrorState`/「还没有获得徽章」三态齐全；`kind` 映射 `assist → 协助徽章`，未知 kind 原样显示
- [ ] `role === 'staff' || role === 'admin'` 显示「认领审核」「工单处理」，`admin` 额外显示「教职工审核」；学生不显示（仅前端展示，后端仍鉴权）
- [ ] 页面底部退出登录：`logout()` 后 `navigate('/login')`
- [ ] 文件 ≤300 行（超出时停下说明并申请新增组件文件）；无内联 `style`；不新增依赖；不改 `AuthContext`

---

### 14.24 重写 Me 页面样式

**目标**：为新版 `/me` 提供 375px 布局、进度条档位、数字入口与弹层样式。

**涉及文件**：`frontend/src/pages/Me.module.css`（重写）

**依赖任务**：14.23

**完成标准**
- [ ] 个人卡片 `display: grid; gap: var(--space-3)`，内边距 `--space-4`，整卡可点击区域 ≥44px
- [ ] 进度条高度 `--space-2`、底色 `--color-border`、填充 `--color-primary`、圆角 `--radius-full`，定义 `.p0`…`.p10` 共 11 档宽度（0%~100%，步长 10%）
- [ ] 数字入口 `grid-template-columns: repeat(4, 1fr)`，每格 `min-height: 44px`，数字 `--font-lg`、标签 `--font-sm`，允许换行
- [ ] 列表入口单列、行高 ≥44px、两端对齐；工作人员分组与列表入口有明确间距
- [ ] 徽章面板固定定位，宽度 `calc(100% - var(--space-4) * 2)`、最大 420px，层级用 `--z-overlay`
- [ ] 退出登录按钮 `margin-top: var(--space-6)`、宽度 100%
- [ ] 375px 下无横向滚动；只引用 `tokens.css` 变量；无内联样式、无具体颜色数值

---

### 14.25 删除旧版 MyDelegations 页面

**目标**：移除已被 `/me/helping` 取代的旧页面，避免出现第二套委托入口。

**涉及文件**：删除 `frontend/src/pages/MyDelegations.tsx`（若存在同名样式文件一并删除）

**依赖任务**：14.19

**完成标准**
- [ ] 删除前再次全仓检索 `MyDelegations`，确认除自身外无 import、无路由、无样式引用
- [ ] 删除 `frontend/src/pages/MyDelegations.tsx`；当前无 `MyDelegations.module.css`，如有则一并删除
- [ ] 删除后 `npm run build` 无未解析引用
- [ ] 不修改其他页面与路由的既有行为

---

### 14.26 追加前端路由

**目标**：注册 `/me/points` 与 `/me/:kind`，不改变既有路由与重定向。

**涉及文件**：`frontend/src/App.tsx`（仅新增 import 与两条 Route）

**依赖任务**：14.19、14.21、14.25

**完成标准**
- [ ] 引入 `MeList`、`MePoints`
- [ ] 在 `/me` 之后追加 `<Route path="/me/points" element={<MePoints />} />`，再追加 `<Route path="/me/:kind" element={<MeList />} />`（静态路径在前）
- [ ] 既有 `/hall`、`/hall/:id`、`/publish`、`/map`、`/ai`、`/me`、`/staff/*`、`/admin/*` 与兜底重定向均未改动
- [ ] 两条新路由位于 `RequireAuth` 包裹的布局路由内，未登录仍被拦截

---

### 14.27 执行本地验证命令

**目标**：按固定顺序执行后端与前端验证，记录真实输出，不编造结果。

**涉及文件**：无代码改动（仅执行验证）

**依赖任务**：14.1–14.26

**完成标准**
- [ ] 按以下顺序由用户在本地执行，逐条记录真实输出：
  1. `cd backend && .venv/Scripts/python -m pytest tests/ -q`
  2. `cd backend && .venv/Scripts/python -m ruff check .`
  3. `cd backend && .venv/Scripts/python -m ruff format --check .`
  4. `cd frontend && npm run lint`
  5. `cd frontend && npm run build`
- [ ] **沙箱不执行 `pytest`、不启动服务、不安装依赖**；`npm run lint`/`npm run build` 可在沙箱执行，`pytest` 与依赖安装由用户本地完成
- [ ] 预期后端全部通过，含新增 `tests/test_me_lists.py` 13 条与 `test_staff_application.py::test_rejected_application_can_be_resubmitted`，且既有测试无回归
- [ ] 任一命令失败时修代码而非改测试/放宽断言，修复后重跑同一条命令
- [ ] 总结中区分「已执行」与「未执行（原因）」；确认无数据库迁移（本次不产生 Alembic 文件）

---

### 14.28 浏览器手工检查与交付确认

**目标**：按 `design.md` 2.26.11 核对 F14 的用户可见行为，尤其是角色差异、计数一致性、委托状态与 375px。

**涉及文件**：无代码改动（仅验收）

**依赖任务**：14.27

**完成标准**
- [ ] 角色差异：学生只见个人卡片、4 个数字入口、列表入口与退出登录；工作人员多「认领审核」「工单处理」；管理员再显示「教职工审核」
- [ ] 计数一致性：4 个数字入口的 `total` 与进入对应列表后的总条数一致（造 3 条以上数据确认分页生效）；单项失败显示 `—`
- [ ] 积分进度：0 分、中间档、最高档三种数据下，进度条与「再得 N 分」/「已达最高称号」显示正确；积分失败时不显示 0 分
- [ ] 评论与认领：`/me/comments` 可跳转 `/hall/{item_id}`（含已撤销帖子）；`/me/claims` 直接显示标题且网络面板只有一次 `/me/claims` 请求
- [ ] 教职工重新申请：被拒账号看到拒绝理由与按钮，提交后标签变「教职工审核中」、拒绝卡消失；失败时按钮恢复并显示中文错误
- [ ] 委托状态：`/me/helping` 显示「进行中/已放弃」「已被致谢」「接取于 …」；同一帖子放弃后重新接取仍是同一条记录
- [ ] 卡片插槽：委托标签位于卡片内部底部；大厅 `/hall` 同一卡片不传 `extra` 时外观无变化、无空白区域
- [ ] 徽章面板：打开才请求，空态正常，`Esc` 与点击遮罩可关闭
- [ ] 375px：`/me`、`/me/points`、7 种 `/me/:kind` 均无横向滚动，入口与按钮 ≥44px
- [ ] 分页与失败：加载更多可追加且不重复；断网追加出现可重试错误且已加载内容不消失

---


## 15. F14 验收修复（增量实现，2026-10-20）

**依据**：`spec.md` 6.19（6.19.1 地点文案回退、6.19.2 委托状态展示、6.19.3 唯一约束与数据迁移、6.19.4 改动边界、6.19.5 验收场景、6.19.6 验证命令）；`design.md` 2.27（2.27.0–2.27.9），并沿用 2.26.8、2.26.9 R9、2.26.10、2.26.11 对既有约定的修正。

**与第 14 章的关系**：第 14 章已交付内容不重写、不删除。本章只补三处验收修复。14.27 的「确认无数据库迁移」结论已被 6.19.3 取代，验证以 15.6 为准；14.28 的委托状态手工检查项以 15.6 的真值表为准。

**允许修改的文件（清单外不改，共 6 个）**
- 前端：`frontend/src/types.ts`（`placeLabel` 入参）、`frontend/src/pages/MeList.tsx`（helping 状态标签）
- 后端：`backend/app/models/item_helper.py`（唯一约束）、`backend/app/services/helper_service.py`（`take_helper` 判定顺序、恢复分支、冲突捕获）
- 迁移：`backend/alembic/versions/20261020_f14_helper_unique.py`（**已存在，只修改去重排序与 docstring，不得新建第二个迁移**）
- 测试：`backend/tests/test_helpers.py`（用例二改写、新增用例三/四与辅助）

**约束**
- 不改 `ItemDetail.tsx` 的地点分支、`ItemCard.tsx`/`.module.css`、`AiPage.tsx`、`api/me.ts`、`schemas/*`、`api/v1/me.py`、`points_service.py`、`reaction_service.py`、`conftest.py`。
- 不改既有测试断言，不新增前后端依赖，不改积分规则、称号阈值与权限矩阵，不改 `/me/helping`、`/me/claims`、`/me/comments` 的字段与分页契约。
- 改动涉及的 Python 文件保存为 LF；一次提交只包含一个任务的改动。15.3 的模型与迁移必须同一提交，避免模型与迁移链分叉。
- 沙箱约束：不跑 `pytest`、不执行 `alembic upgrade/downgrade`、不安装依赖；`ruff`、逐文件 `eslint`、`npm run build` 可执行。需用户本地执行的命令见 15.6。

### 15.0 前置裁决与依赖顺序

**裁决 D1（已确认：口径 B，已采纳）**：唯一约束 `uq_item_helper_item_user` 覆盖 `abandoned` 记录，使「放弃后新建第二条」在数据库层不可能；`spec.md` 4.5 与 6.19.3 已按口径 B 修订（「已放弃 → 进行中」原地恢复原记录、刷新接取时间、`thanked` 置 `false`、不新增记录），`design.md` 2.27.3.3 给出最终实现形态、2.27.3.4 记录已采纳结论。下表仅作决策留档：

| 口径 | 放弃后再次接取 | 需改动 | 状态 |
|---|---|---|---|
| A：返回 409 | `INSERT` 命中唯一约束 → 409「已接取该委托」；`/me/helping` 仍显示「已放弃」；库中恒 1 行 | 不改 `take_helper` 写路径 | **不采纳**：使 4.5「已放弃 → 进行中」不可达，功能缺失 |
| B：原地恢复原记录 | 查到 `abandoned` → UPDATE 为 `active`、刷新 `created_at`、`thanked=False` → 200（响应与新建一致） | `take_helper` 增恢复分支与全状态查询（见 15.4、15.7） | **已采纳**：状态机闭环，仍只 1 行 |

- [x] D1 裁决为口径 B，并已记录在本章（`spec.md` 4.5、6.19.3 由需求方修订，`design.md` 2.27.3.4 已采纳）
- [x] 已确认恢复副作用可接受：历史 `thanked=True` 被清除，已发放的致谢积分不回收、用户积分总额不变（spec 6.19.3「已知影响」）
- [x] 15.4、15.5、15.7 一律按口径 B 的完成标准执行；15.5 的第 2 条用例按 B 改写，第 3 条为放弃后重接恢复
- [ ] 15.1–15.7 全部完成后再进入 15.6 全量验证

**依赖顺序**

```mermaid
flowchart LR
  A1[15.1 地点文案] --> V[15.6 验证与回归]
  A2[15.2 委托标签] --> V
  A3[15.3 模型与迁移] --> A4[15.4 判定顺序与冲突返回 409]
  A4 --> A7[15.7 放弃后重接原地恢复]
  A7 --> A5[15.5 唯一约束、恢复、关闭后拒绝用例]
  A5 --> V
```

**顺序说明**：15.1 与 15.2 互不依赖，可与 15.3 并行；15.4 必须在 15.3 之后（否则测试库无唯一约束，冲突路径不可达）；15.7 在 15.4 之后（恢复分支复用同一份 `take_helper` 改造与分支顺序）；15.5 在 15.4、15.7 之后（用例三、四锁定 B 的行为）；15.6 最后执行。15.7 为必做任务，不存在「按 A 实现」的替代路径。

---

### 15.1 地点文案回退到 location_area

**目标**：扩展 `placeLabel` 入参并新增 `location_area` 回退分支，使只有地点区域的记录在列表与卡片中显示原文，而不是「未指定地点」。

**涉及文件**：`frontend/src/types.ts`（仅改 `placeLabel` 及其私有辅助）

**依据**：`spec.md` 6.19.1；`design.md` 2.27.2.1

**依赖任务**：无（可与 15.2、15.3 并行）

**实现要点**
- 入参新增 `location_area: string | null`，可用 `PlaceFields` 表示三字段；三字段均**必填**、可为 `null`，不给默认值、不设为可选，让缺字段的调用点在 `tsc -b` 阶段报错（design 2.27.2.1「类型门禁」）。
- 新增模块内私有 `trimmed(value: string | null): string`，`null`/`""`/纯空白统一视为空。
- 分支顺序：建筑名非空 → `floor == null` 时只输出建筑名，否则 `{建筑名} {floor}F`；建筑名为空 → `trimmed(location_area) || '未指定地点'`。
- 建筑名为空时即使 `floor` 有值也不输出楼层；`floor` 用 `== null` 判断，`0` 不视为缺失；不用 `location_area` 拼接楼层。
- 纯函数：不读 `precise_location`、`norm_x`、`norm_y`、`layer_id`、路线字段，无副作用。
- 调用点核对（均不改）：`frontend/src/components/ItemCard/ItemCard.tsx:57`、`frontend/src/pages/AiPage.tsx:128`、`frontend/src/pages/ItemDetail.tsx:233` 传入的都是完整 `Item`；`ItemDetail` 的建筑名三元分支与「未知」文案保持原样（6.19.1 展示范围约束）。全仓检索 `placeLabel`，确认无第四处调用。

**完成标准**
- [ ] `placeLabel(item: PlaceFields): string`，`PlaceFields` 含 `building_name: string | null`、`location_area: string | null`、`floor: number | null`
- [ ] `图书馆` + `3` → `图书馆 3F`，建筑名首尾空白被去除
- [ ] `图书馆` + `null` → `图书馆`（不追加楼层）
- [ ] 建筑名为 `null`/`""`/纯空白、`location_area` 为 `图书馆三楼` → `图书馆三楼`（去首尾空白）
- [ ] 建筑名为空、`floor=3`、`location_area=图书馆三楼` → `图书馆三楼`，输出不含 `3F`
- [ ] 两者均空（含 `null`/`""`/纯空白）→ `未指定地点`
- [ ] `ItemDetail.tsx`、`ItemCard.tsx`、`AiPage.tsx` 未被修改；`Item`、`DraftPost` 字段未改动
- [ ] 无 `any`、无新增依赖

**验证命令**
- 沙箱可执行：`cd frontend && npx eslint src/types.ts`；`cd frontend && npm run build`（`tsc -b` 验证新签名）
- 需用户本地：无（边界文案的浏览器核对见 15.6）

---

### 15.2 重做「我接取的」状态标签

**目标**：让 helping 行的状态标签由 `helper_status`、帖子 `status`、`thanked` 三字段派生为四档，并保证「已被致谢」只出现一次。

**涉及文件**：`frontend/src/pages/MeList.tsx`

**依据**：`spec.md` 6.19.2；`design.md` 2.27.2.2

**依赖任务**：无（复用 14.15 已追加的 `HelpingItem`/`helperStatusLabels`；可与 15.1、15.3 并行）

**实现要点**
- 模块级新增 `ONGOING_STATUS: ReadonlySet<ItemStatus>`（`searching`、`reviewing`）、常量 `THANKED_LABEL = '已被致谢'`、`HelperBadge` 接口与纯函数 `helperBadge(item: HelpingItem): HelperBadge`（`label`/`tone`/`showThankedTag`）。
- 判定顺序：`abandoned` → 「已放弃」`neutral`，`showThankedTag = thanked`；`active` 且帖子在 `searching/reviewing` → 「进行中」`primary`，`showThankedTag = thanked`；`active` 且帖子不在进行中 → `thanked` 为真时「已被致谢」`success`（`showThankedTag = false`），否则「已结束」`neutral`（`false`）。
- `renderRow` 的 `kind === 'helping'` 分支只调用一次 `helperBadge(item)`，用返回值渲染状态 `Tag`、可选的独立致谢 `Tag` 与「接取于 YYYY/M/D」，不写嵌套三元。
- 「已被致谢」文案只保留 `THANKED_LABEL` 一个来源，状态标签与独立标签共用，从结构上杜绝重复渲染，不依赖渲染顺序或字符串比较。
- `from '../types'` 追加 `type ItemStatus`；`TagTone`、`helperStatusLabels` 已在导入中。不改 `helperStatusLabels`、不改 `ItemCard`/样式/`api/me.ts`、不新增前端状态或缓存。
- 防御性：`status` 为 `pending`/`returned` 时走 `thanked` 分支，不抛错、不丢行；排序、分页、`extra` 位置与 `taken_at` 格式不变。

**完成标准**
- [ ] `active` + `searching`/`reviewing` → 「进行中」`primary`；`thanked=true` 时额外显示独立「已被致谢」
- [ ] `active` + `found`/`withdrawn` + `thanked=true` → 「已被致谢」`success`，且**不**再渲染独立标签
- [ ] `active` + `found`/`withdrawn` + `thanked=false` → 「已结束」`neutral`，无独立标签
- [ ] `pending`/`returned`（不可达）按同一规则处理，不报错、不丢行
- [ ] `abandoned` + 任意帖子状态 → 「已放弃」`neutral`；`thanked=true` 时额外显示独立「已被致谢」
- [ ] `helperBadge` 在 `renderRow` 中只调用一次；「已被致谢」全文件仅一个中文常量来源
- [ ] 未新增依赖、无内联样式、未改 `ItemCard`、`MeList.module.css`、`api/me.ts`、`helperStatusLabels`
- [ ] 文件 ≤300 行（当前 227 行，预计 ≤260）

**验证命令**
- 沙箱可执行：`cd frontend && npx eslint src/pages/MeList.tsx`；`cd frontend && npm run build`
- 需用户本地：按 15.6 手工清单核对四种数据的标签

---

### 15.3 声明委托唯一约束并修改既有迁移

**目标**：在模型与数据库中同时保证同一用户对同一帖子最多一条 `item_helper` 记录，迁移中先清理历史重复再建约束。

**涉及文件**：`backend/app/models/item_helper.py`；`backend/alembic/versions/20261020_f14_helper_unique.py`（已存在，仅修改去重排序与 docstring，**不得新建第二个迁移**）

**依据**：`spec.md` 6.19.3；`design.md` 2.27.3.1、2.27.3.2、2.27.4

**依赖任务**：无（可与 15.1、15.2 并行）；15.4 依赖本任务

**实现要点**
- 模型：追加 `__table_args__ = (UniqueConstraint("item_id", "user_id", name="uq_item_helper_item_user"),)` 与 `UniqueConstraint` 导入；约束名与迁移逐字一致，沿用 `uq_item_like_item_user` 的命名风格。列类型、可空性、默认值与 `item_id`/`user_id` 索引不动。
- 迁移：只改既有文件，`revision = "20261020_f14_uniq"`、`down_revision = "20261018_v2_inc"`（当前唯一 head，见 `backend/alembic/versions/20261018_v2_incremental.py:14`）保持不变；不新增 revision、不改 `down_revision`。
- 升级顺序（同一事务）：先用窗口函数按 `(item_id, user_id)` 分组删除重复，排序键为 `CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at ASC, id ASC`——**同组优先保留 `active`（进行中）行**；同组无 `active` 时保留 `created_at` 最早的一条；`created_at` 并列时保留 `id` 字典序最小的一条；删除 `rn > 1` 的行。不能直接写 `ORDER BY status`（字符串序 `abandoned < active` 与「active 优先」相反）。
- 再用 `with op.batch_alter_table("item_helper") as batch_op: batch_op.create_unique_constraint("uq_item_helper_item_user", ["item_id", "user_id"])` 建约束。
- 降级只用 `batch_alter_table` + `drop_constraint("uq_item_helper_item_user", type_="unique")`，不恢复已删数据。
- docstring 必须写明三个不可逆点：升级会删除同组多余记录且不可恢复；保留优先级为「active 优先 → `created_at` 最早 → `id` 最小」；**同组同时存在 `active` 与 `abandoned` 时删除的是 `abandoned` 行**，该「已放弃」历史不可通过降级找回；降级只删约束、不恢复数据，降级后库中可再次出现同组多行。
- 不触碰 `point_record`（不新增积分、不改总额）；不显式增删索引；表为空或无重复时两步均为 no-op；任一步失败由迁移事务整体回滚，不留「已清理未加约束」的中间态。
- 模型与迁移放同一提交；不修改 `abandon_helper`、`thank_helpers`、`list_helpers`、`stats_for_items`、`list_my_helping` 的查询逻辑（去重由数据与约束保证）。

**完成标准**
- [ ] 模型仅新增 `__table_args__` 与 `UniqueConstraint` 导入，约束名 `uq_item_helper_item_user` 与迁移一致
- [ ] 迁移 `revision` 仍为 `20261020_f14_uniq`、`down_revision` 仍指向 `20261018_v2_inc`，全仓单 head、未新建第二个迁移
- [ ] 升级语句顺序为「先 DELETE 去重，后 create_unique_constraint」，位于同一迁移事务
- [ ] 去重保留规则为「`status='active'` 优先，其次 `created_at` 最早，并列取 `id` 最小」，`ORDER BY` 含 `CASE WHEN status = 'active' THEN 0 ELSE 1 END`
- [ ] 表结构变更使用 `batch_alter_table`，SQLite（重建表）与 PostgreSQL（原生 `ALTER TABLE`）均可执行
- [ ] 降级只删 `uq_item_helper_item_user`；`item_id`/`user_id` 索引与其余列保持不变
- [ ] 迁移 docstring 写明「删除重复不可逆」「同组 active+abandoned 时删 abandoned、不可恢复」「降级不恢复数据」
- [ ] 未改动积分数据与积分函数；未新增/删除索引；空表或无重复时迁移不报错
- [ ] 改动文件为 LF 换行

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 需用户本地（需可连接的 `DATABASE_URL`）：`cd backend && .venv/Scripts/python -m alembic check`；`cd backend && .venv/Scripts/python -m alembic upgrade head`；可选往返 `alembic downgrade -1` 后 `alembic upgrade head`
- 执行前只读排查（design 2.27.4，可选留档）：`HAVING COUNT(*) > 1` 分组查询与 `rn > 1` 预览查询

---

### 15.4 接取判定顺序改造与冲突返回 409

**目标**：改造 `take_helper` 的判定顺序，引入全状态查询 `_any_helper`，新增 `abandoned → 原地恢复` 分支，并在无记录的新建路径捕获唯一约束冲突，返回与串行检查完全一致的 409。

**涉及文件**：`backend/app/services/helper_service.py`

**依据**：`spec.md` 4.5、6.19.3；`design.md` 2.27.3.3（写法参照 `backend/app/services/reaction_service.py` 的 `set_like`）

**依赖任务**：15.3；15.7 依赖本任务

**实现要点**
- 追加 `from datetime import UTC, datetime`；`IntegrityError` 若已导入则保留，不重复导入。
- 新增 `_any_helper(db: Session, item_id: uuid.UUID, user_id: uuid.UUID) -> ItemHelper | None`：按 `(item_id, user_id)` 查**全状态**单条记录，用 `first()` 而非 `one_or_none()`（未迁移的旧库出现重复时不抛 500）。`_active_helper` 的查询条件与语义**保持不变**，仍供 `abandon_helper` 使用，不改名、不合并。
- 分支顺序固定为：`_ensure_item` 记录不存在 → 404；本人发布 → 403；`direction != lost` 或 `status ∉ {searching, reviewing}` → 409「该记录当前不可接取」；`_any_helper` 命中 `active` → 409「已接取该委托」；命中 `abandoned` → **原地恢复**；无记录 → **INSERT**。**「不可接取」前置校验必须早于恢复**，否则帖子已离开寻找中/核验中时会被错误恢复。
- 恢复分支：`helper.status = HelperStatus.active`、`helper.thanked = False`、`helper.created_at = datetime.now(UTC)`，随后 `db.commit()`；不 INSERT、不删除原行，`id` 不变。禁止 `datetime.now()`（无时区，会与既有 UTC 数据差 8 小时）与 `func.now()`（需额外 refresh 才能断言），理由见 design 2.27.3.3 时间取值表。
- INSERT 分支保留 `IntegrityError` 捕获：`try` **只包** `db.add` 后的 `db.commit()`；`except IntegrityError: db.rollback(); raise ApiError(409, "STATE_CONFLICT", _TAKEN_MESSAGE) from None`。恢复分支的 `commit` 不放进 `try`（UPDATE 不触发唯一约束，误捕获会把连接异常报成 409）。
- 「已接取该委托」提为模块级常量 `_TAKEN_MESSAGE`，串行 active 分支与 INSERT 冲突分支共用；两条成功路径都落到最后的 active 计数查询，返回 `{"helper_count": n, "is_helper": True}`。
- 不动 `abandon_helper`、`thank_helpers`、`list_my_helping`、`stats_for_items`、`list_helpers`；函数签名保持 `db: Session` 第一参、`user: User` 显式传入、`-> dict`；行宽 ≤120。

**完成标准**
- [ ] 新增 `_any_helper`（全状态查询）；`_active_helper` 的语义、查询条件与调用点不变
- [ ] 分支顺序为 404 → 403 → 409 不可接取 → active 409 → abandoned 恢复 → 无记录 INSERT，且「不可接取」校验早于恢复
- [ ] `abandoned` 分支走 UPDATE：库中该组合仍 1 行、`id` 不变、`status=active`、`thanked=False`、`created_at` 刷新为本次接取时间
- [ ] 恢复使用 `datetime.now(UTC)`，未出现无时区 `datetime.now()`
- [ ] `IntegrityError` 仅在 INSERT 的 `commit` 处捕获，`rollback` 后 session 可继续使用，返回 409「已接取该委托」而非 500
- [ ] 恢复与新建返回体一致：`helper_count` 为当前 active 行数、`is_helper=True`
- [ ] 一次业务只 `commit` 一次；其他委托函数与 `points_service` 未改动

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 需用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_helpers.py -q`（用例由 15.5 提供）

---

### 15.5 新增唯一约束、恢复与关闭后拒绝用例

**目标**：在 `test_helpers.py` 落定 3 条必做用例（另 1 条可选），锁定「接取两次只有一条记录」「唯一约束拒绝直连重复插入」「放弃后重接原地恢复」「帖子关闭后重接仍 409」。

**涉及文件**：`backend/tests/test_helpers.py`（用例一与既有 4 条断言不动；用例二改写；新增用例三、四与辅助）

**依据**：`spec.md` 6.19.3、6.19.5；`design.md` 2.27.5

**依赖任务**：15.3、15.4、15.7

**实现要点**
- 复用模块级辅助 `helper_rows(item_id: str, user_id: str) -> list[ItemHelper]`（用 `SessionLocal` 直连同一测试库，过滤条件传 `uuid.UUID(...)`，只读不提交；已存在则不重复定义）。既有 `test_thank_awards_points_once` 内的同名局部变量不改，新用例内不与它混用。
- **用例一（必做，保持原样）** `test_take_helper_twice_keeps_single_record`：注册 owner/helper → owner 发 lost 帖 → 第一次接取 200 且 `{"helper_count": 1, "is_helper": True}` → 第二次 409（`STATE_CONFLICT`/「已接取该委托」）→ 直连查询恰好 1 条、`status=active`、`thanked=False` → `/me/helping` 得 `total=1`、`items[0]["helper_count"]=1`、`is_helper=True` → owner 详情 `helper_count=1`、`helpers` 长度 1。
- **用例二（必做，改写）** `test_item_helper_unique_constraint_rejects_duplicate_row`：原用例「预置 `abandoned` 后再次接取断言 409」在口径 B 下已失效（重接走 UPDATE，不再触发唯一约束），改为直接验证约束本身：接取一次 200 → 用 `SessionLocal` 直接 `add(ItemHelper(同 item_id + user_id, status=HelperStatus.abandoned))`，`commit()` 抛 `IntegrityError` → `db.rollback()` 后会话可继续使用（不抛 `PendingRollbackError`）→ `helper_rows` 仍 1 行且 `status=active`（未被第二条覆盖）→ 同一 client `GET /me/helping` 200、`total=1`。需新增导入 `pytest`、`from sqlalchemy.exc import IntegrityError`（既有依赖，不新增第三方包）。改写理由写入交付说明：需求口径 A→B 导致断言前提失效，不是删除或放宽测试。
- **用例三（必做，新增）** `test_take_helper_after_abandon_restores_record`：
  1. 注册 owner/helper，owner 发布 lost 帖；
  2. helper `POST /items/{id}/helpers` → 200，响应 `{"helper_count": 1, "is_helper": True}`；
  3. 记录 `before = helper_rows(...)[0]`：恰好 1 行、`status=active`，保存 `before.id` 与 `before.created_at`；
  4. helper `DELETE /items/{id}/helpers` → 200、`{"helper_count": 0, "is_helper": False}`，库中该行 `status=abandoned`；
  5. helper 再次 `POST /items/{id}/helpers` → **200（不是 409）**，响应体与新建逐字一致 `{"helper_count": 1, "is_helper": True}`；
  6. `after = helper_rows(...)`：**恰好 1 条**；`after[0].id == before.id`（原记录被复用，未删旧建新）；`status == HelperStatus.active`；`thanked is False`；`after[0].created_at > before.created_at`；
  7. owner `GET /items/{id}`：`helper_count == 1`、`helpers` 长度 1、`display_name` 为 helper；
  8. helper `GET /me/helping`：`total == 1`、`items[0]["helper_status"] == "active"`、`helper_count == 1`、`is_helper is True`；
  9. helper 再次 `DELETE` → 200，证明恢复后的行可继续走放弃流程。
  - `created_at` 断言只用两次读取值比较大小，**不要**与 `datetime.now(UTC)`（aware）直接比较（SQLite 读回是 naive，会抛 `TypeError`）；`id` 不变是「原地恢复」的直接证据。
- **用例四（可选，建议做，新增边界）** `test_take_helper_after_abandon_rejects_closed_item`：接取 → `DELETE` 放弃（库中 1 行 `abandoned`）→ owner `POST /items/{id}/mark-found` 200 → helper 再次 `POST /items/{id}/helpers` → 409「该记录当前不可接取」（**不是**「已接取该委托」）→ 直连查询仍 1 行、`status` 仍为 `abandoned`（未被恢复）。
- 不写 `ThreadPoolExecutor` 真并发（SQLite 锁竞争先于唯一约束，会偶发失败；B 下已有 abandoned 行的并发重接走 UPDATE 本就不冲突，design 2.27.5、2.27.7 R2）；不改 `conftest.py`、不新增 fixture、不新增依赖；新增内容追加在文件末尾、LF、单函数 ≤50 行（用例三可拆为两个私有 helper）。

**完成标准**
- [ ] 3 条必做用例存在且按上述断言通过；可选用例四若实现也须通过
- [ ] 用例一未改；用例二已改写为唯一约束直连验证，未删除、未放宽
- [ ] 用例三断言覆盖：仅 1 行、`id` 不变、`status=active`、`thanked=False`、`created_at` 刷新、帖子 `helper_count=1`、`/me/helping` 状态回到 active
- [ ] 既有 4 条用例（接取/放弃、权限与状态、致谢积分、致谢校验）断言未修改、未删除、未放宽
- [ ] `helper_rows` 辅助使用 `SessionLocal` 与 `uuid.UUID`；未修改 `conftest.py`、未新增 fixture/依赖
- [ ] 无真并发用例；新内容位于文件末尾；单函数 ≤50 行

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 需用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_helpers.py -q`；`cd backend && .venv/Scripts/python -m pytest tests/ -q`

---

### 15.6 全量验证与回归

**目标**：按固定顺序执行静态检查、迁移一致性、后端测试与前端构建，记录真实输出，并完成手工验收。

**涉及文件**：无代码改动（失败时只在 15.1–15.5、15.7 允许范围内修复）

**依据**：`spec.md` 6.19.6；`design.md` 2.27.8、2.27.9

**依赖任务**：15.1–15.5、15.7

**验证命令（按顺序，标注执行位置）**

| # | 命令 | 执行位置 |
|---|---|---|
| 1 | `cd backend && .venv/Scripts/python -m ruff check .` | 沙箱可执行 |
| 2 | `cd backend && .venv/Scripts/python -m ruff format --check .` | 沙箱可执行 |
| 3 | `cd backend && .venv/Scripts/python -m alembic check` | 用户本地（需可用 `DATABASE_URL`） |
| 4 | `cd backend && .venv/Scripts/python -m alembic upgrade head` | 用户本地（先备份；在含重复数据的库上更有意义） |
| 5 | `cd backend && .venv/Scripts/python -m alembic downgrade -1` 后 `alembic upgrade head`（可选往返） | 用户本地 |
| 6 | `cd backend && .venv/Scripts/python -m pytest tests/test_helpers.py -q` | 用户本地 |
| 7 | `cd backend && .venv/Scripts/python -m pytest tests/ -q` | 用户本地 |
| 8 | `cd frontend && npx eslint src/types.ts src/pages/MeList.tsx` | 沙箱可执行 |
| 9 | `cd frontend && npm run build`（含 `tsc -b`） | 沙箱可执行 |

**完成标准**
- [ ] 1、2、8、9 在沙箱实际执行并记录真实输出；3–7 由用户本地执行后回贴输出
- [ ] `alembic check` 无待生成变更；`upgrade head` 后重复分组查询为 0 行；可选往返成功
- [ ] `pytest tests/test_helpers.py` 共 7 条（原有 4 条 + 15.5 的 3 条必做；若实现可选用例四则为 8 条）全部通过；全量 `pytest tests/` 无回归（含 `test_me_lists.py`、`test_points.py`、认领/归还/工单用例）
- [ ] 逐文件 `eslint` 无错误；`npm run build` 成功
- [ ] 任一失败时修代码而非改测试或放宽断言，修复后重跑同一条命令
- [ ] 不编造结果；未执行的命令写明「未执行（原因）」
- [ ] 手工核对地点文案：只有 `location_area` 的帖子在 `/hall`、`/me/posts`、`/me/helping`、`/me/favorites` 显示原文；建筑名优先且楼层只跟随建筑名；两者皆空显示「未指定地点」；`/hall/{id}` 地点行保持原样
- [ ] 手工核对委托标签：进行中 / 已找回且致谢 / 已撤销未致谢 / 已放弃四种数据标签正确，致谢场景只有一个「已被致谢」；375px 无横向滚动
- [ ] 手工核对放弃后重接（口径 B）：接取 → 放弃 → 再次接取返回成功；`/me/helping` 该行变回「进行中」、「接取于」为本次日期；库中该组合仍 1 行、`status=active`、`thanked=false`；帖子详情协助者人数保持 1
- [ ] 手工核对帖子关闭后重接：帖子改为「已找回」后再点接取 → 提示「该记录当前不可接取」，`/me/helping` 仍为「已放弃」，库中记录未被改回 active
- [ ] 迁移后 `/me/helping` 与帖子详情协助者人数不因清理重复而异常；同组原本同时有 active 与 abandoned 时，升级后只看到「进行中」一条；迁移文件名记入总结

---

### 15.7 放弃后重接原地恢复（口径 B，必做）

**目标**：按 `design.md` 2.27.3.3 的最终代码形态，落定 `take_helper` 的「已放弃 → 进行中」恢复路径，使「放弃后重接」返回成功且数据库仍只有一条记录，并锁定 B 的分支顺序、时间取值、返回体与副作用边界。

**涉及文件**：`backend/app/services/helper_service.py`（仅 `take_helper` 与该文件内私有查询）

**依据**：`spec.md` 4.5、6.19.3；`design.md` 2.27.3.3（最终代码形态）、2.27.3.4（已采纳 B）

**依赖任务**：15.3、15.4（必做，无条件）

**实现要点**
- 以 `design.md` 2.27.3.3「最终代码形态」为唯一参照逐项核对 15.4 的落地结果，差异就地修正：`_any_helper` 全状态单条查询 + 六段分支顺序 `404 → 403 → 409 不可接取 → active 409 → abandoned UPDATE → 无记录 INSERT`。
- `abandoned` 命中时只改三列：`status = HelperStatus.active`、`thanked = False`、`created_at = datetime.now(UTC)`，随后 `db.commit()` 一次；**不**用 `db.delete` + `db.add`（会换 `id`、且可能再次撞唯一约束），不新增行、不改 `item_id`/`user_id`。
- 「不可接取」前置校验必须早于恢复查询：帖子离开 `searching/reviewing` 时不得因存在 `abandoned` 行而恢复，仍返回 409「该记录当前不可接取」（spec 6.19.3「已知影响」）。
- 恢复后的行必须能继续走放弃流程：`_active_helper` 语义与查询条件保持不变，`abandon_helper` 不改；恢复行再次 `DELETE` 应为 200。
- 并发边界不写成代码分支：两个请求同时重接同一条 `abandoned` 行都会走 UPDATE、均返回 200，库中仍 1 行；只有「两个请求都无记录 → 都 INSERT」由 `IntegrityError` 兜底为 409。该结论写入交付说明，不新增并发测试。
- 副作用写入交付说明：恢复时 `thanked` 被置 `false`，已发放的 `point_record` 不回收、用户积分总额不变（spec 6.19.3）。
- 不新增接口字段、不改表结构，因此**不新增迁移**；不改 `thank_helpers`、`list_my_helping`、`stats_for_items`、`list_helpers`、积分函数。

**完成标准**
- [ ] `take_helper` 的分支顺序与 design 2.27.3.3 一致：404 → 403 → 409 不可接取（先于恢复）→ active 409 → abandoned 恢复 → 无记录 INSERT
- [ ] 恢复走 UPDATE：库中该组合 1 行、`id` 不变、`status=active`、`thanked=False`、`created_at` 为本次接取时间（`datetime.now(UTC)`）
- [ ] 放弃后重接返回 200，响应体与新建完全一致（`helper_count`、`is_helper=True`）；未返回 409「已接取该委托」
- [ ] 帖子已离开 `searching/reviewing` 时重接仍返回 409「该记录当前不可接取」，库中记录保持 `abandoned`
- [ ] 恢复后该行可再次 `DELETE` 放弃（200）；`_active_helper`、`abandon_helper` 未改动
- [ ] 历史 `thanked=True` 被清除，`point_record` 不回收、积分总额不变（写入交付说明）
- [ ] 未新增迁移、未改表结构；本任务只影响 `helper_service.py`；一次业务只 `commit` 一次；行宽 ≤120

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 需用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_helpers.py -q`；`cd backend && .venv/Scripts/python -m pytest tests/ -q`
---

## 16. X2a 双视图地图与素材导入（增量实现，2026-10-20）

**依据**：`spec.md` 6.20.1–6.20.16；`design.md` 2.28.0–2.28.15（重点 2.28.6.3 图层按 `kind` 幂等、2.28.9 演示数据排除规则、2.28.12 测试设计、2.28.13.4 三项已批准改动）。

**与既有章节的关系**：13.8（F8）的「单一 2.5D 底图」由本章替换为「室外平面图 + 室内 2.5D 选楼图」；`backend/app/data/buildings.json` 与 `backend/storage/campus-2.5d.jpg` 在 16.18 删除。13.9、13.11、13.13 的组件、接口与行为保持，本章只做增量改造；第 14、15 章不重写、不删除。认领、核验、归还、协助工单、积分、权限的既有逻辑与测试断言一律不改。
**允许修改的文件（清单外不改）**

- 后端：`backend/app/models/enums.py`、`backend/app/models/building.py`、`backend/app/models/layer.py`；`backend/app/schemas/building.py`、`backend/app/schemas/layer.py`；`backend/app/services/building_service.py`、`backend/app/services/advice_service.py`、`backend/app/services/item_service.py`（仅图层类型校验）；`backend/app/api/v1/layers.py`、`backend/app/api/v1/buildings.py`、`backend/app/api/v1/router.py`（已批准，仅注册 `/map`）；`backend/seed.py`、`backend/scripts/import_buildings.py`、`backend/scripts/seed_demo.py`、`backend/scripts/import_map_assets.py`（新建）
- 迁移：`backend/alembic/versions/20261020_x2a_map_views.py`（新建，本章唯一迁移）
- 前端：`frontend/src/types.ts`、`frontend/src/api/layers.ts`、`frontend/src/api/buildings.ts`、`frontend/src/hooks/useCampusMapLayers.ts`（已批准）；`frontend/src/components/CampusMap/BuildingLayer.tsx`、`BuildingCard.tsx`、`LayerToggles.tsx`、`FloorSwitcher.tsx`、`coords.ts` 及各自 `.module.css`；新建 `frontend/src/components/CampusMap/IsoBuildingLayer.tsx` + `.module.css`；`frontend/src/pages/MapView.tsx` + `MapView.module.css`
- 资源与文档：删除 `backend/app/data/buildings.json`、`backend/storage/campus-2.5d.jpg`；根 `.gitignore`、`backend/.dockerignore`（已批准）、`README.md`
- 测试：`backend/tests/` 下与建筑、图层、楼层、演示数据、推荐相关的测试文件；新建 `backend/tests/fixtures/`
**约束**

- 数据库迁移只有 16.1 一处；其余任务不新增迁移。16.1 的模型与迁移必须同一提交，避免 `alembic check` 检测出待生成变更。
- 除种子编号 16、17、19、21 与图层展示名外，代码与测试不得写死建筑名称、编号、坐标、图片尺寸；素材整体替换后只执行 16.10 的一条命令。
- 位置数据一律使用室外平面图坐标；2.5D 只用于浏览与选楼，不保存任何位置。楼层帖在室外地图显示在所属建筑 `label_position`。
- 不改认领、核验、归还、协助工单、积分、权限；不改 `CampusMap.tsx`、`MapContext.tsx`、`AIRecommendLayer.tsx`、`ItemPointsLayer.tsx`、`ItemForm.tsx`；不新增依赖。
- 沙箱不执行 `pytest`、不启动服务、不安装依赖；`ruff` 与前端检查可执行，`alembic check/upgrade` 与 `pytest` 由用户本地执行。缺素材、缺底图、缺图层必须有中文提示，不静默回退到错误底图。

**任务标签**

- 【迁移】= 涉及新增 Alembic 迁移；【本地】= 需用户本地执行 pytest 或 alembic。
- 提交信息统一为 `feat(backend|frontend|docs|deploy): 16.N 任务标题`；一次提交只含一个任务。
### 16.0 前置裁决与依赖顺序

**裁决 D1（已批准的三处越界改动，全部纳入本章）**

| 文件 | 最小改法 | 落点任务 |
|---|---|---|
| `backend/app/api/v1/router.py` | 仅新增一行 `include_router(layers.map_router, prefix="/map")` | 16.6 |
| `backend/.dockerignore` | 在 `storage/*` 白名单新增 `!storage/campus_flat.webp`、`!storage/campus_25d.webp`、`!storage/floors/`，保留 `!storage/outdoor.jpg` | 16.18 |
| `frontend/src/hooks/useCampusMapLayers.ts` | `listBuildings({limit:100})` 改为 `listAllBuildings()`，全量加载 | 16.11 |

三项均不改变业务规则与公共契约，只补接线；该 hook 的帖子仍为 `listItems({limit:100})`，不扩大其职责。

**裁决 D2（图层幂等键只按 `kind`）**：`flat`/`iso` 各只保留一条，保留 `(created_at, id)` 最早的一条并原地更新名称、图片、宽高、比例尺，`id` 不变；多余记录在 `item.layer_id`、`route.layer_id`、`simulated_point.layer_id` 均无引用时删除，有引用时保留并警告。`floor` 按 `(building_id, floor)` 区分，不参与「各只保留一条」。名称只作新建展示名，不参与匹配。落点 16.8，用例 T24–T26。
**裁决 D3（素材为草稿版，可整体替换）**：图片名、宽高、比例尺、`flat_to_iso`、建筑几何全部来自 `campus_buildings.json` 与 `campus_floors.json`。代码与测试不得写死 `1899×2400`、`2400×1842`、`0.520366` 或矩阵具体值；只有编号 16、17、19、21 与图层展示名允许写死。落点 16.1、16.4、16.6、16.18；测试一律用 `tests/fixtures/` 的小素材。

**裁决 D4（演示数据重建口径）**：`seed_demo` 每次先删 `is_demo=true` 的帖子再生成，第二次执行返回 `created=60`（不是 0），库中恒为 60。旧 `test_demo_seed.py` 的「第二次返回 0」断言按 `spec.md` 6.20.12 改写，属于需求变更导致的测试改写，不是放宽。

**裁决 D5（`/map/meta` 权限与缺失分支）**：登录即可访问，不区分角色；缺 `flat` 或 `iso` 图层、素材文件缺失返回 404 中文提示，不返回缺省的假 id。

**依赖图**

```mermaid
flowchart TD
  M1[16.1 模型与迁移] --> S2[16.2 schemas]
  M1 --> I4[16.4 建筑转换与导入]
  S2 --> I4
  M1 --> V3[16.3 图层校验]
  I4 --> F5[16.5 楼层导入]
  I4 --> L8[16.8 图层与点位同步]
  F5 --> L8
  I4 --> M6[16.6 map/meta]
  L8 --> M6
  I4 --> R7[16.7 推荐改造]
  L8 --> R7
  L8 --> D9[16.9 演示数据]
  R7 --> D9
  L8 --> A10[16.10 导入脚本]
  D9 --> A10
  M6 --> T11[16.11 前端类型与 API]
  T11 --> C12[16.12 coords]
  T11 --> O13[16.13 室外视图]
  T11 --> I14[16.14 室内视图]
  T11 --> F15[16.15 楼层视图]
  C12 --> O13
  C12 --> I14
  O13 --> MV16[16.16 MapView]
  I14 --> MV16
  F15 --> MV16
  O13 --> T17[16.17 测试]
  I14 --> T17
  F15 --> T17
  MV16 --> V19[16.19 全量验证]
  T17 --> V19
  R7 --> V19
  A10 --> V19
  Z18[16.18 资源与文档] --> V19
```

**顺序说明**：16.1 先行，16.2 紧随；16.3–16.7 为后端服务层，16.4 是其余导入任务的公共前置；16.8 完成图层与点位同步；16.9 依赖 16.7 的排除判定与 16.8 的 flat 图层；16.10 是唯一编排入口；16.11–16.16 前端按「类型 → 纯函数 → 三个视图 → 页面」推进；16.17 汇总测试；16.18 可与其他批次并行；16.19 最后执行，失败只回到对应任务修复。
---

### 16.1 模型与 Alembic 迁移【迁移】【本地】

**目标**：为图层增加 `kind`（flat/iso/floor）与 `rooms`，为建筑增加 2.5D 命中、2.5D 标签、绘制层级与入口节点四列，并用一个迁移回填既有图层类型。

**涉及文件**：`backend/app/models/enums.py`、`backend/app/models/building.py`、`backend/app/models/layer.py`、`backend/alembic/versions/20261020_x2a_map_views.py`（新建）

**依据**：`spec.md` 6.20.9；`design.md` 2.28.2.1、2.28.2.2、2.28.2.3

**依赖任务**：无（本章所有任务的前置）

**实现要点**
- `enums.py` 新增 `LayerKind`：`flat`、`iso`、`floor`，与现有枚举同样继承 `str, Enum`。
- `building.py` 新增 `iso_hit_area`（JSON，可空）、`iso_label_position`（JSON，可空）、`draw_order`（int，非空，Python 默认 0）、`entrance_node`（int，可空）。原 `click_region`/`label_position` 语义改为室外平面几何，列本身不动。
- `layer.py` 新增 `kind`（`SAEnum(LayerKind, native_enum=False, length=16)`，非空，默认 `flat`，`index=True`）与 `rooms`（JSON，可空）；`image_path` 保持可空。
- 迁移 revision `20261020_x2a_map`，`down_revision = "20261020_f14_uniq"`；用 `batch_alter_table` 以兼容 SQLite 重建表。
- 升级顺序固定为：加 `kind`（`server_default='flat'`）→ `UPDATE layer SET kind='floor' WHERE floor IS NOT NULL` → `UPDATE layer SET kind='flat' WHERE floor IS NULL AND building_id IS NULL` → 加 `rooms` → 建索引 `ix_layer_kind` → 加建筑四列（`draw_order` 带 `server_default='0'`）。
- 降级按相反顺序删列与索引；docstring 写明不可逆点：删 `kind` 后无法区分三类；删 `iso_*` 后需重新导入素材；本迁移不改任何帖子/路线/点位坐标，不删旧底图文件。
- 迁移只回填 `kind`，不合并同 `kind` 重复记录；合并交给 16.8 的 `sync_layers`。模型默认值与迁移 `server_default` 保持一致，避免 `alembic check` 反复检测。
- 不修改 `tests/conftest.py` 的 `create_all` 建表方式；模型需提供 Python 侧默认值，保证测试库插入无需显式赋值。
**完成标准**
- [ ] `LayerKind` 含 `flat`/`iso`/`floor` 三值，`layer.kind` 非空、默认 `flat`、带索引
- [ ] `layer.rooms` 为可空 JSON；`building` 新增 `iso_hit_area`、`iso_label_position`、`draw_order`、`entrance_node`
- [ ] 迁移 `revision` 为 `20261020_x2a_map`、`down_revision` 为 `20261020_f14_uniq`，全仓单 head
- [ ] 回填规则为「`floor` 非空 → `floor`；`floor` 为空且 `building_id` 为空 → `flat`」，不按名称猜 `iso`
- [ ] 升级与降级均使用 `batch_alter_table`；降级顺序与升级相反
- [ ] 迁移 docstring 写明三类不可逆点
- [ ] 模型默认值与迁移 `server_default` 一致；`alembic check` 无待生成变更
- [ ] 本章只有这一个迁移文件，未新建第二个 revision

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 用户本地：`cd backend && .venv/Scripts/python -m alembic upgrade head`；`cd backend && .venv/Scripts/python -m alembic current`（应为 `20261020_x2a_map`）；`cd backend && .venv/Scripts/python -m alembic check`；可选往返 `alembic downgrade -1 && alembic upgrade head`
---

### 16.2 schemas 与建筑序列化字段【本地】

**目标**：让建筑与图层接口暴露新增字段，同时保持既有响应字段与分页契约不变。

**涉及文件**：`backend/app/schemas/building.py`、`backend/app/schemas/layer.py`、`backend/app/services/building_service.py`（仅 `_serialize`）、`backend/app/api/v1/buildings.py`（预计无需改动）

**依据**：`spec.md` 6.20.2、6.20.3；`design.md` 2.28.2.1「schemas」

**依赖任务**：16.1

**实现要点**
- `BuildingOut` 追加 `iso_hit_area: list[dict] | None`、`iso_label_position: dict | None`、`draw_order: int`、`entrance_node: int | None`；既有 `id/code/name/category/floors/click_region/label_position/active_item_count/has_floor_map` 不动。
- `LayerOut` 追加 `kind: LayerKind`、`rooms: list[RoomOut] | None`；新增 `RoomOut`，字段 `name: str`、`x: float`、`y: float`，坐标按 `Field(ge=0, le=1)` 约束。
- `building_service._serialize` 补齐四个新字段，直接取 ORM 值；不改 `active_item_count`、`has_floor_map` 的查询与含义。
- `api/v1/buildings.py` 只依赖 `BuildingOut` 透传；除非类型检查要求，否则不改动分页、筛选与路由。
- 不新增写接口，不改 `MapAnchorRequest`、`RouteCreate` 等既有请求模型；不改变 `/hall`、`/ai` 依赖的字段。
- `RoomOut` 仅用于输出；`rooms` 为空时返回 `None`。

**完成标准**
- [ ] `BuildingOut` 含四个新字段，类型与 design 2.28.2.1 一致
- [ ] `LayerOut` 含 `kind` 与 `rooms`；`RoomOut` 存在且坐标受 0~1 约束
- [ ] `GET /buildings`、`GET /buildings/{id}` 返回新字段；总数、分页、`category` 筛选不变
- [ ] `GET /layers` 返回 `kind`/`rooms`；既有字段不变
- [ ] 未改动 `MapAnchorRequest`、`RouteCreate` 与任何写入接口
- [ ] `api/v1/buildings.py` 若未改动，在交付说明中写明「响应模型透传，无需改路由」

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 用户本地：16.17 的 `tests/test_map_layers.py::test_building_out_exposes_iso_fields`、`test_layer_out_exposes_kind_and_rooms`
---

### 16.3 图层类型与位置写入校验【本地】

**目标**：在服务层集中实现图层类型校验，使 `iso` 图层拒绝标点、路线、求助点，`floor` 图层标点必须带且匹配 `building_id` 与 `floor`。

**涉及文件**：`backend/app/services/building_service.py`、`backend/app/services/item_service.py`（仅 `set_map_anchor`、`create_route` 的校验）、`backend/app/api/v1/layers.py`（仅创建求助点入口）

**依据**：`spec.md` 6.20.9、6.20.7；`design.md` 2.28.3.1–2.28.3.3

**依赖任务**：16.1

**实现要点**
- 在 `building_service` 新增并集中维护：`get_layer_or_404`、`ensure_position_layer`、`ensure_flat_layer(db, layer_id, action)`、`ensure_floor_anchor(layer, building_id, floor)`、`active_position_layer_id(db)`。错误统一 `ApiError(400, "VALIDATION", 中文)`，不存在统一 404「图层不存在」。
- 文案常量集中在 `building_service`：`2.5D 图仅用于选楼，请在室外地图上标注`、`楼层图仅支持标点，绘制请返回室外地图`、`求助点仅在室外平面图创建`、`在楼层图标点需要先选择建筑与楼层`、`建筑与当前楼层图不一致`、`楼层与当前楼层图不一致`。
- 判定顺序：图层存在（404）→ `kind=iso`（400）→ 动作为路线/求助点时要求 `kind=flat`（400）→ 楼层标点再校验建筑与楼层（400）。任何一步失败都不得写入部分字段，先校验后赋值，最后一次 `commit`。
- `item_service.set_map_anchor`：先 `ensure_position_layer`，再在图层为 `floor` 时用 `item.building_id`、`item.floor` 调 `ensure_floor_anchor`；保持「只能给自己的记录标点」与既有返回体。
- `item_service.create_route`：`body.layer_id` 为空时沿用现状跳过图层校验；非空时调 `ensure_flat_layer(..., "route")`，不进入楼层一致性校验。
- `layers.py` 的创建求助点入口改调 `ensure_flat_layer(..., "help_point")`，替换现有「仅查存在」；不改列表、标定、底图接口。
- 不新增请求字段；楼层一致性由后端用 `item.building_id`/`item.floor` 判定，前端不因此新增参数。
**完成标准**
- [ ] `building_service` 提供五个校验/查询函数，签名与 design 2.28.3.2 一致，`db` 为第一参数
- [ ] 在 `iso` 图层标点、创建路线、创建求助点均返回 400 `VALIDATION`，文案为「2.5D 图仅用于选楼，请在室外地图上标注」
- [ ] 在 `floor` 图层标点且缺 `building_id` 或 `floor` 返回 400「在楼层图标点需要先选择建筑与楼层」
- [ ] `building_id` 不匹配返回 400「建筑与当前楼层图不一致」；`floor` 不匹配返回 400「楼层与当前楼层图不一致」
- [ ] 在 `floor` 图层创建路线返回 400「楼层图仅支持标点，绘制请返回室外地图」；创建求助点返回 400「求助点仅在室外平面图创建」
- [ ] `flat` 图层的标点、路线、求助点行为与现状一致；`layer_id` 为空的路线仍可创建
- [ ] 校验失败时不写 `norm_x/norm_y/layer_id`，不产生部分数据
- [ ] 未改认领、核验、归还、工单、积分与权限逻辑

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_map_layers.py -q`（用例 T14–T18）
---

### 16.4 建筑素材转换与导入【本地】

**目标**：用 `campus_buildings.json` 替换旧 8 栋扁平配置，完成坐标转换、编号去重、未命名与类别映射、按编号幂等导入，并安全清理素材中已删除的旧建筑。

**涉及文件**：`backend/app/services/building_service.py`（替换 `load_config` 及旧格式解析）

**依据**：`spec.md` 6.20.8；`design.md` 2.28.4.1–2.28.4.5

**依赖任务**：16.1、16.2

**实现要点**
- 新增只读素材模型 `MapAsset`（`version`、`flat_*`、`iso_*`、`flat_to_iso`、`buildings`）与 `BuildingData`（八个业务字段）；`load_asset(path: Path | None = None)` 默认读取 `app/data/campus_buildings.json`，测试用参数指向 `tests/fixtures/`。
- 素材文件缺失或 JSON 无法解析时抛 `ValueError`，不写库；顶层必须是对象，`buildings` 必须是数组。
- 坐标：素材 `[x, y]` 转 `{"x": round(x, 8), "y": round(y, 8)}`；越界或非数字使该栋跳过并警告，不中断整批。
- 编号：`code` 为空/空白时用素材 `id`；非空且唯一时原样使用；重复时用 `{code}-{id}` 并只警告一次；超过 32 字符截断并警告；改写后仍冲突则追加 `id` 后缀，最终仍冲突整栋跳过并警告。
- 名称：`named=false` 或名称去空白为空时用 `未命名建筑`。
- 类别：英文按 design 2.28.4.3 映射；`life` 名称含「食堂」或「餐厅」→ 食堂，否则生活服务；未知归「其他」并警告（含编号与原类别），不报错。
- 层数限制 0~200，越界截断并警告；`draw_order` 允许负数，非整数记 0 并警告；`entrance_node` 非整数记空并警告。
- 几何：`flat.footprint` 点数 ≥3 才写 `click_region`，否则空并警告；`flat.label_anchor` 缺失时取轮廓顶点均值，两者都无则空并警告；`iso.hit_area` 同理；`iso.label_anchor` 缺失时用 `label_position` 经素材矩阵换算兜底。素材中的 `entrances`、`units`、`iso.footprint` 等额外字段一律忽略。
- `convert_buildings(asset)` 返回 `(list[BuildingData], list[str])`，不访问数据库；转换阶段完成全部编号、类别与几何规则。
**导入与旧建筑清理**
- `import_buildings(db, asset)` 返回 `BuildingImportResult(created, updated, deleted, skipped, warnings)`；先解析与转换、后写库，写库异常向上抛，整批一次 `commit`。
- 按 `code` 新增或更新；重复导入时全部走更新分支，`created=0`、`updated=总数`。更新写入全部业务字段（名称、类别、层数、平面几何、2.5D 几何、绘制层级、入口节点）。
- 旧建筑 = 库中 `code` 不在本次素材集合的建筑。先统计 `item.building_id` 与 `layer.building_id` 的引用：存在 `is_demo=false` 的帖子引用时保留建筑并警告「建筑 {code} 有 N 条非演示引用，未删除」。
- 仅演示引用时，先删演示帖关联（`candidate` 两侧 → `route` → `item_feature` → `attachment`），再删演示帖、其楼层图层与 `rooms`，最后删建筑；`deleted` 计数。若演示帖存在 `claim`/`comment`/`like`/`favorite`/`helper` 记录，则保留建筑与该帖并警告，不级联删除用户互动。
- 素材中已消失的楼层图层若没有建筑可挂，随建筑一起删除；不删除任何 `is_demo=false` 的帖子、认领、工单、积分记录。
- 删除旧 `CONFIG_PATH`、`load_config`、`_prepare`、`_normalize_point` 及扁平数组解析；同步把 `backend/seed.py`、`backend/scripts/import_buildings.py`、`backend/scripts/seed_demo.py` 的调用改为 `load_asset` + `import_buildings`/后续任务的编排函数，避免残留旧入口。
- 输出契约：脚本按 `[1/5] 建筑：素材 N 栋，新增 a，更新 b，删除 c，跳过 d，警告 e` 打印；警告逐条为「警告：建筑 {code} {原因}」；类别未知、轮廓缺失、编号重复必须出现。
- 本任务提交后，`tests/test_buildings.py`、`test_search_advice.py`、`test_demo_seed.py` 的旧断言（8 栋、`B01`、`load_config`）会失败，由 16.17 统一改写；在该测试任务完成前，本批次不合并主干。这是需求替换素材导致的预期变更，不是放宽测试。
**完成标准**
- [ ] `load_asset` 默认读取 `app/data/campus_buildings.json`，可通过参数指定测试素材；文件缺失或损坏抛 `ValueError` 且不写库
- [ ] `[x,y]` 转为 `{x,y}` 并保留 8 位小数；轮廓、标签、2.5D 命中、2.5D 标签使用同一转换
- [ ] 编号空用素材 `id`；重复用「编号-素材 id」；超长截断；最终冲突跳过并警告
- [ ] `named=false` 名称为「未命名建筑」；类别映射完整，`life` 按名称分流，未知归「其他」并警告
- [ ] 轮廓点数不足、标签缺失、2.5D 命中缺失、矩阵兜底、层数越界、`draw_order` 非整数均有确定的兜底与警告
- [ ] 同素材重复导入：`created=0`、`updated=总数`，建筑总数不变
- [ ] 旧建筑先删演示关联再删建筑；有非演示引用时保留并警告，不删除用户数据
- [ ] 输出含新增/更新/删除/跳过/警告统计；警告逐条可读
- [ ] 代码中未出现正式建筑名称、编号、坐标、图片尺寸或矩阵值
- [ ] 全仓检索 `load_config`、`buildings.json` 无残留调用（文件删除在 16.18）

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_map_assets.py -q`（用例 T01–T09，由 16.17 提供）
---

### 16.5 楼层导入与占位楼层【本地】

**目标**：从 `campus_floors.json` 导入楼层名称、底图、尺寸与房间；文件缺失或楼层无底图时，为综合楼（21）1F/2F 与图文信息中心（17）1F 创建无底图占位楼层。

**涉及文件**：`backend/app/services/building_service.py`（新增楼层模型与导入函数）

**依据**：`spec.md` 6.20.6、6.20.13；`design.md` 2.28.5.1–2.28.5.4

**依赖任务**：16.4

**实现要点**
- 新增 `FloorSpec`、`FloorImportResult(created, updated, skipped, warnings)`；常量 `FLOOR_IMAGE_DIR = Path("floors")`、`DEFAULT_FLOOR_LAYERS = ((21, 1), (21, 2), (17, 1))`、`PLACEHOLDER_FLOOR_SIZE = (1000, 1000)`。21、17 是明确允许写死的种子编号，楼层名与尺寸全部来自数据。
- `load_floor_specs(path: Path | None = None)` 读取 `app/data/campus_floors.json`：文件不存在返回空列表并警告「未找到楼层素材，仅创建占位楼层」；存在但无法解析抛 `ValueError`；同一 `(building_code, floor)` 重复只保留最后一条并警告。
- 图片只取文件名，拒绝 `..` 与路径分隔符；文件位于 `{file_storage_dir}/floors/{image}`，不存在则 `image_path=None` 并警告，按无底图处理。
- 尺寸优先用素材 `width/height`；图片存在但未给尺寸时用占位尺寸并警告。
- 房间 `name` 去空白且长度 ≤32、`x/y ∈ [0,1]`，否则丢弃该房间并警告；`rooms` 为空时存 `None`；坐标为该楼层图归一化坐标（左下角原点）。
- 占位合并：以素材楼层与 `DEFAULT_FLOOR_LAYERS` 合并；素材未提供的种子楼层创建 `kind=floor`、`image_path=None`、占位尺寸；素材提供时以素材为准，允许无底图。
- `import_floors(db, asset, specs)`：按 `(building_id, floor, kind=floor)` 查找并更新 `name/image_path/width/height/rooms`，不存在则新建；`building_code` 在建筑表不存在时跳过并警告；`name` 与其他图层重名时保留旧名并警告；素材中消失的楼层不删除，只计入 `skipped`。
- 不删除素材之外的历史楼层图层；一次 `commit`；楼层图层不参与 16.8 的同 `kind` 收敛。
**完成标准**
- [ ] `campus_floors.json` 缺失时，仍为 21/1F、21/2F、17/1F 创建三个 `kind=floor` 占位图层，`image_path` 为空
- [ ] 素材存在时按 `(building_code, floor)` 导入名称、图片、宽高与房间；重复楼层只保留最后一条并警告
- [ ] 图片路径只取 `floors/` 下文件名，拒绝路径穿越；图片缺失按无底图处理并警告
- [ ] 房间名称与坐标非法时丢弃该房间并警告；合法房间写入 `layer.rooms`
- [ ] 建筑编号不存在时跳过并警告，不创建孤立图层
- [ ] 同一 `(building_id, floor)` 重复导入为更新：`created=0`、`updated=总数`，楼层总数不变
- [ ] 素材中消失的楼层保留，不删除、不产生警告噪音
- [ ] 名称与其他图层冲突时保留旧名并警告，导入不中断
- [ ] 代码未写死建筑名、楼层尺寸或房间数据；仅 21、17 与占位尺寸为常量

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_map_assets.py -q`（用例 T06、T19；T19 在 `test_map_layers.py`）
---

### 16.6 `/map/meta` 接口与路由注册【本地】

**目标**：为所有登录用户提供室外图层 id、2.5D 图层 id 与平面到 2.5D 的 2×3 矩阵，供前端换算，不在前端写死矩阵。

**涉及文件**：`backend/app/schemas/layer.py`（新增 `MapMetaOut`）、`backend/app/services/building_service.py`（新增 `get_map_meta`）、`backend/app/api/v1/layers.py`（新增 `map_router`）、`backend/app/api/v1/router.py`（已批准，仅新增 `/map` 注册）

**依据**：`spec.md` 6.20.10；`design.md` 2.28.7.1、2.28.7.2

**依赖任务**：16.4、16.8

**实现要点**
- `MapMetaOut` 字段为 `flat_layer_id: UUID`、`iso_layer_id: UUID`、`flat_to_iso: list[list[float]]`，声明为响应模型，不返回手写字典。
- `get_map_meta(db)` 按 `kind` 查图层；同 `kind` 多条时取 `(created_at, id)` 最小的一条，与 16.8 的保留规则一致。
- 矩阵直接从 `load_asset()` 读取，不在代码中写死；素材缺失或无法解析返回 404「地图素材文件缺失，请执行素材导入」。
- 缺 flat 图层返回 404「缺少室外平面图图层，请先初始化地图数据」；缺 iso 图层返回 404「缺少 2.5D 选楼图层，请先初始化地图数据」。
- `layers.py` 新增 `map_router = APIRouter(tags=["map"])`，提供 `GET /meta`，依赖 `get_current_user`，不区分角色。
- `router.py` 只新增 `api_router.include_router(layers.map_router, prefix="/map")` 一行，不改任何既有路由。
- 接口只读：不 `commit`、不写库、不返回帖子位置或建筑几何。

**完成标准**
- [ ] `GET /api/v1/map/meta` 返回三个字段；`flat_layer_id`/`iso_layer_id` 与库中 flat/iso 图层一致
- [ ] `flat_to_iso` 为 2×3 数组，值与素材一致，长度与形状正确
- [ ] 未登录返回 401 `UNAUTH`；学生、工作人员、管理员登录后均可访问
- [ ] 缺 flat、缺 iso、素材缺失分别返回 404 `NOT_FOUND`，文案含对应中文提示，不返回假 id
- [ ] `router.py` 仅新增一行注册，既有路由顺序与行为未变
- [ ] 服务层不依赖 FastAPI，`db` 为第一参数；接口只做薄封装

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_map_layers.py -q`（用例 T11–T13）
---

### 16.7 推荐算法改造：排除、类别提示与米数【本地】

**目标**：推荐候选排除天桥、校门与未命名建筑，补充体育馆/运动场/球场/生活服务的物品提示，并把距离理由改为实际米数；评分权重与降级行为不变。

**涉及文件**：`backend/app/services/building_service.py`（新增排除判定）、`backend/app/services/advice_service.py`

**依据**：`spec.md` 6.20.12、6.14；`design.md` 2.28.8.1–2.28.8.5

**依赖任务**：16.4、16.8

**实现要点**
- 在 `building_service` 集中定义 `EXCLUDED_BUILDING_CATEGORIES = frozenset({"天桥", "校门"})`、`UNNAMED_BUILDING = "未命名建筑"`，并提供查询条件 `recommendable_building_clauses()` 与内存判定 `is_recommendable_building(building)`；两者语义必须一致，禁止 `advice_service` 与 `seed_demo.py` 各写一份。
- `advice_service.recommend` 在既有查询上追加 `filter(*recommendable_building_clauses())`；排序仍为 `(-score, code)`，`MAX_LOCATIONS=5`、来源与降级矩阵不变。被排除建筑在 `/buildings` 仍可见、可点击，只是不进入推荐。
- `_BUILDING_HINTS` 补充：体育馆、运动场、球场均映射「水杯、耳机、钥匙、衣物、校园卡」；生活服务映射「校园卡、钱包、雨伞」；图书馆/食堂/教学楼/宿舍沿用现有映射。`_category_hint` 匹配方式不变。
- `_score` 增加 `meters: int | None`：取 flat 图层的 `width/height/pixels_per_meter/scale_calibrated`；`dx = x_point - x_building`、`dy = y_point - y_building`，像素距离 `sqrt((dx*width)^2 + (dy*height)^2)`，米数为 `round(像素距离 / pixels_per_meter)`。未标定或 `pixels_per_meter` 为空时为 `None`。
- 评分仍使用现有归一化 `distance`，不改权重、不改排序键；`meters` 只用于理由与模型上下文。
- `_template_reason` 在 `meters` 非空且存在圈选几何时输出「距你圈选的范围约 N 米」，否则沿用「距离较近/中/远」。
- 模型解释改为追加句：模板距离句始终保留，模型文本拼接在后，总长 ≤200；模型不可用、超时、解析失败仍走规则并 `degraded=true`。
- 模型上下文新增整数 `distance_meters`；不发送精确坐标、联系方式、认领证据。
**完成标准**
- [ ] 排除常量与两个判定函数只在 `building_service` 定义；查询过滤与内存过滤对同一批数据结果一致
- [ ] 推荐结果不含天桥、校门、未命名建筑，`MAX_LOCATIONS` 仍 ≤5，排序与来源标识不变
- [ ] 体育馆/运动场/球场/生活服务的物品提示按 design 2.28.8.2 生效，其余类别映射未改
- [ ] `meters` 按 `dx*width`、`dy*height` 计算像素距离再除 `pixels_per_meter` 并取整；夹具 `meters_per_pixel=0.5` 时可手算
- [ ] 未标定比例尺或 `pixels_per_meter` 为空时 `meters=None`，理由不出现「米」
- [ ] 规则理由含「距你圈选的范围约 N 米」；模型降级时理由仍含该距离句
- [ ] 模型解释为追加句，模板距离句始终保留，总长 ≤200；未发送坐标、联系方式、认领证据
- [ ] 评分权重、排序键、降级矩阵未变；被排除建筑在建筑列表仍可见
- [ ] `seed_demo` 复用 `is_recommendable_building`，未另写类别字符串判断

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd backend && .venv/Scripts/python -m ruff format --check .`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_map_layers.py -q`（用例 T20–T22）；`cd backend && .venv/Scripts/python -m pytest tests/test_search_advice.py -q`（16.17 改写后）
---

### 16.8 初始化图层与点位同步【本地】

**目标**：实现 `sync_layers` 与 `sync_points`，并让 `seed.py` 只做编排：创建 flat/iso/floor 三类图层、缩放比例尺、求助点与校门模拟监控点。

**涉及文件**：`backend/app/services/building_service.py`、`backend/seed.py`

**依据**：`spec.md` 6.20.11；`design.md` 2.28.10.1、2.28.10.2、2.28.6.3

**依赖任务**：16.4、16.5

**实现要点（`sync_layers`）**
- 只维护 `flat`/`iso`，按 `kind` 取全部记录并按 `(created_at, id)` 升序；第一条为目标，其余为多余记录。名称不参与匹配。
- 先处理多余记录：逐一检查 `item.layer_id`、`route.layer_id`、`simulated_point.layer_id`；三者均无引用则删除并计入 `removed`；任一有引用则保留并警告「图层 {name}（{id}）存在引用，未删除」。
- 再更新目标：`name`、`image_path`、`width`、`height`、`pixels_per_meter`、`scale_calibrated`，保留原 `id` 与 `version`；先删多余再改名，避免 `layer.name` 唯一约束冲突。
- 若仍有被保留的记录占用素材规定名称，保留目标原名称并警告，不中断导入。
- 无目标时按素材规定名称新建一条；`flat` 使用 `campus_flat.webp`、素材宽高、`scale_calibrated=true`、`pixels_per_meter=round(1/meters_per_pixel, 4)`；`iso` 使用 `campus_25d.webp`、素材宽高、`scale_calibrated=false`、`pixels_per_meter=None`。
- 图层展示名「校园室外地图」「校园 2.5D 选楼图」可写死，但只用于新建；已存在记录改名即可，不因名称不同另建记录。`floor` 不进入本函数。
- 返回 `LayerSyncResult(created, updated, removed, warnings)`；一次 `commit`。
**实现要点（`sync_points`）**
- 在 `building_service.py` 新增常量 `HELP_POINT_NAME = "校园求助点"`（`kind="help"`）与 `GATE_MONITOR_NAME = "校门模拟监控点"`（`kind="camera"`），只写名称与类型，不写坐标。
- 位置一律取室外平面图坐标：`item.layer_id` 指向 flat 图层，`x`/`y` 为 flat 像素值；不换算、不取 2.5D 坐标。
- 按 `(kind, name)` 查找既有记录：存在则更新 `layer_id`、`x`、`y`、`description`；不存在则新建。重复记录（同 `kind` + 同 `name` 多于一条）保留 `(created_at, id)` 最小的一条，其余计入 `removed`。
- 求助点坐标取 `campus_roads.json` 顶层 `nodes` 中存在 `help` 字段的节点；校门监控点取 `kind == "gate"` 的节点。若该文件缺失或无匹配节点，`sync_points` 返回空结果并追加警告，不抛异常、不影响图层同步结果。
- 仅同步上述两类模拟点位；真实点位、用户上报点位、AI 结果点一律不写。`source` 保持既有默认值，标识来源为模拟。
- 返回 `PointSyncResult(created, updated, removed, warnings)`；由调用方统一 `commit`。

**实现要点（`seed.py` 编排）**
- 删除 `_LAYER_SPECS`、`_POINT_SPECS`、`_LEGACY_LAYER_NAMES` 三处硬编码坐标与旧图层名清理逻辑，`seed.py` 只保留：读取素材 → 调 `sync_layers` → 调 `import_buildings` → 调 `sync_points` → 建管理员 → 打印统计与全部 `warnings`。
- 保留原有 `--reset`/幂等语义：第二次执行输出 `created = 0`，`updated` 反映被刷新条数，不重复插入图层与点位。
- 打印格式固定为可搜索的 key：`layers: created=A updated=B removed=C`、`buildings: created=A updated=B`、`points: created=A updated=B removed=C`；`warnings` 逐行以 `WARN ` 前缀输出。
- 素材读取失败时只输出 `WARN` 并跳过对应步骤，管理员创建仍继续。

**完成标准**
- [ ] `grep -n "_LAYER_SPECS\|_POINT_SPECS\|_LEGACY_LAYER_NAMES" backend/seed.py` 无输出
- [ ] 新库执行 `python seed.py` 后 `layer` 中 `kind` 恰为 `flat`/`iso` 各一条，无 `kind="floor"` 记录
- [ ] 第二次执行 `python seed.py` 仍输出 `layers: created=0`、`points: created=0`，图层与点位总数不变
- [ ] 人为把 flat 图层 `name` 改成任意值后再执行，记录 `id` 与 `version` 不变，`name` 被改回规定名称
- [ ] 人为复制一条 flat 图层记录（改名）后执行，多余记录被删除并计入 `removed`；若该记录已被 `item` 引用则保留并输出 `WARN`
- [ ] 求助点与校门监控点的 `layer_id` 均指向 flat 图层，坐标落在 flat 画布 `1899×2400` 内
- [ ] 素材文件缺失时命令退出码为 0，输出 `WARN` 且管理员仍创建

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check app/services/building_service.py seed.py`；`grep -c "WARN " backend/seed.py`
- 用户本地：`cd backend && .venv/Scripts/python seed.py`（连跑两次，对比 `layers:`/`points:` 行）；`cd backend && .venv/Scripts/python -m pytest tests/test_map_layers.py -q`（用例 T16–T19）

---

### 16.9 演示数据改用新建筑编号【本地】

**目标**：让 `seed_demo.py` 的演示物品与认领挂在建筑素材转换后的真实编号上，并排除不可推荐建筑；重复执行不再累加。

**涉及文件**：`backend/scripts/seed_demo.py`、`backend/tests/test_demo_seed.py`

**依据**：`spec.md` 6.20.12；`design.md` 2.28.9

**依赖任务**：16.4

**实现要点**
- 删除脚本内写死的建筑编号与坐标常量，改为构建「类别 → 候选建筑列表」映射，候选来源是 `building_service.list_buildings` 返回结果按 `category` 分组。
- 排除不可推荐建筑：复用 16.7 的 `is_recommendable_building`，不另写类别字符串比较。
- 选题顺序固定（便于复现）：优先使用编号 16、17、19、21 的演示建筑；不足时按 `(category, code)` 升序补齐。
- 每个演示物品按所选建筑写入 `building_id` 与 flat 图像素坐标（`building.position_x`/`position_y`），不写 2.5D 坐标。
- 幂等：以 `title` 作为幂等键，已存在的演示物品跳过；认领、时间线、工单同理以组合键判定。重复执行返回写入条数 `0`，且各表总数不变。
- 按 D4 裁决：**第二次执行返回 0**（保持既有 `test_demo_seed.py` 断言语义），但第一次必须写入 60 条演示物品；若建筑素材遮挡导致候选不足，按类别循环复用候选，不跳过选题，保证条数稳定为 60。
- 时间字段使用固定基准时间偏移，不使用 `datetime.now()`，避免每次执行产生不同数据。

**完成标准**
- [ ] `grep -nE "B0[0-9]|position_x *= *[0-9]{2,}" backend/scripts/seed_demo.py` 无写死编号或坐标
- [ ] 首次执行 `python -m scripts.seed_demo` 输出写入 60 条，物品 `building_id` 均非空
- [ ] 第二次执行返回 `0`，`item`/`claim`/`timeline`/`work_order` 总数与首次执行后一致
- [ ] 演示物品未落在 `is_recommendable_building` 判定为不可推荐的建筑上
- [ ] 演示物品坐标均在 flat 画布内，且无坐标为 2.5D 图层值

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check scripts/seed_demo.py tests/test_demo_seed.py`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_demo_seed.py -q`

---

### 16.10 素材导入命令 `import_map_assets.py`【本地】

**目标**：提供独立命令完成建筑与楼层素材导入，与 `seed.py` 解耦，便于评审现场单独重导素材。

**涉及文件**：`backend/scripts/import_map_assets.py`、`backend/scripts/import_buildings.py`

**依据**：`spec.md` 6.20.10；`design.md` 2.28.7、2.28.8

**依赖任务**：16.4、16.5

**实现要点**
- 新脚本参数：`--buildings PATH`（默认 `app/data/campus_buildings.json`）、`--floors PATH`（默认 `app/data/campus_floors.json`）、`--dry-run`、`--prune-buildings`（默认关闭）。
- 流程：读 JSON → 校验 `version` 与必需字段 → `import_buildings` → `import_floors` → 单次 `commit`；`--dry-run` 时只打印将写入的条数与差异，不提交、不修改任何行。
- 输出固定 key：`buildings: created=A updated=B pruned=C`、`floors: created=A updated=B placeholders=C`、`warnings: N`，`warnings` 逐行 `WARN ` 前缀。
- 失败语义：JSON 解析失败或 `version` 未知时以退出码 `2` 结束并打印 `ERROR`，不写入部分数据（先解析全部、后写库）。
- `--prune-buildings` 只在显式传入时删除素材中不存在的建筑；删除前检查 `item.building_id` 引用，有引用则跳过并警告。
- 保留 `scripts/import_buildings.py` 作为兼容入口，内部改为调用 `import_map_assets.py` 的建筑分支，不再维护独立的解析逻辑；其原有命令行参数继续可用。
- 所有路径用 `pathlib` 基于脚本自身位置解析，不依赖当前工作目录。

**完成标准**
- [ ] `python -m scripts.import_map_assets --dry-run` 打印条数且不修改数据库（执行前后 `building` 计数一致）
- [ ] 正常执行后建筑条数与 `campus_buildings.json` 中建筑数量一致，`campus_floors.json` 中 `floors` 为空时生成占位楼层并计入 `placeholders`
- [ ] 传入不存在路径时退出码 `2`，打印 `ERROR`，数据库无变化
- [ ] 未传 `--prune-buildings` 时素材中缺失的既有建筑不被删除
- [ ] `python -m scripts.import_buildings` 仍可成功执行且输出与新版一致

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check scripts/import_map_assets.py scripts/import_buildings.py`
- 用户本地：`cd backend && .venv/Scripts/python -m scripts.import_map_assets --dry-run`；`cd backend && .venv/Scripts/python -m scripts.import_map_assets`

---

### 16.11 前端类型与图层 API 对接【本地】

**目标**：让前端类型与 `/layers`、`/layers/{id}/points`、`/map/meta`、建筑列表返回字段对齐。

**涉及文件**：`frontend/src/types.ts`、`frontend/src/api/layers.ts`、`frontend/src/api/buildings.ts`

**依据**：`spec.md` 6.20.13；`design.md` 2.28.11.1

**依赖任务**：16.2、16.6

**实现要点**
- `types.ts` 的 `Layer` 增加 `kind: 'flat' | 'iso' | 'floor'`，其余字段不变；`kind` 按联合类型声明，不用 `string`。
- `Building` 增加 `code`、`campus_name`、`category`、`position_x`、`position_y`、`position_x_25d`、`position_y_25d`、`iso_matrix`、`has_floorplan`、`floor_count`；可空字段显式标 `| null`。
- 新增 `MapMeta` 类型：`flat`、`iso` 两张图的 `{ id, image_path, width, height, pixels_per_meter, scale_calibrated }`，以及 `floors` 数组。
- `api/layers.ts` 增加 `getMapMeta(): Promise<MapMeta>`，路径 `/map/meta`；保持既有 `getLayers`、`getLayerPoints` 签名不变。
- `api/buildings.ts` 的列表函数支持 `category`、`zoom`（`detail`/`summary`）可选参数，未传时不附加查询串，避免破坏既有调用。
- 不修改 `AIRecommendLayer.tsx`、`ItemPointsLayer.tsx` 中的类型引用方式；如出现类型冲突，优先在 `types.ts` 做兼容性扩展。

**完成标准**
- [ ] `cd frontend && npm run build` 通过，无 `any` 新增
- [ ] `grep -n "kind" frontend/src/types.ts` 显示联合类型声明，非 `string`
- [ ] `getMapMeta` 返回类型明确，调用方无需类型断言
- [ ] 既有页面（物品详情、发布、列表）编译通过，未出现字段缺失报错

**验证命令**
- 沙箱可执行：`cd frontend && npm run build`；`cd frontend && npm run lint`
- 用户本地：启动前后端后，浏览器 Network 面板确认 `/api/v1/map/meta` 返回 200

---

### 16.12 坐标换算工具 `coords.ts`【本地】

**目标**：把 flat 与 2.5D 两套图像素坐标统一换算到容器像素，供建筑层与点位层共用。

**涉及文件**：`frontend/src/components/CampusMap/coords.ts`

**依据**：`design.md` 2.28.11.2

**依赖任务**：16.11

**实现要点**
- 导出 `scaleOf(width, height, containerWidth, containerHeight)`：返回 `{ scale, offsetX, offsetY }`，按 `min(containerWidth / width, containerHeight / height)` 等比缩放并居中；容器尺寸为 0 时返回 `scale = 1`，偏移为 0。
- 导出 `flatToContainer(x, y, layer, box)`：直接按 `scaleOf` 换算 flat 像素坐标。
- 导出 `isoToContainer(x, y, matrix, box)`：先用 `flat_to_iso` 矩阵（2×3）变换得到 2.5D 图像素，再用 `scaleOf` 落到容器。
- 矩阵缺省或长度不为 6 时退化为恒等变换并 `console.warn` 一次，不抛异常。
- 保留既有导出（若存在 `imageToContainer`）作为别名，避免 `ItemPointsLayer`、`AIRecommendLayer` 引用报错。
- 纯函数，无 React 依赖，不做浮点四舍五入以外的取整；不写图像宽高常量。

**完成标准**
- [ ] 三个函数签名稳定，参数中无写死的 `1899`/`2400`/`1842`
- [ ] 容器尺寸为 0 时不出现 `NaN`/`Infinity`
- [ ] 矩阵非法时返回有限数值并只警告一次
- [ ] 既有引用 `coords.ts` 的文件编译通过

**验证命令**
- 沙箱可执行：`cd frontend && npm run build`；`grep -nE "1899|2400|1842" frontend/src/components/CampusMap/coords.ts`（应无输出）
- 用户本地：调整浏览器窗口大小，地图内容保持等比且居中

---

### 16.13 室外视图与图层开关【本地】

**目标**：在平面底图上渲染全部建筑与模拟点位，避免逐栋弹窗造成的遮挡。

**涉及文件**：`frontend/src/pages/MapView.tsx`、`frontend/src/pages/MapView.module.css`、`frontend/src/components/CampusMap/BuildingLayer.tsx`、`frontend/src/components/CampusMap/BuildingLayer.module.css`、`frontend/src/components/CampusMap/BuildingCard.tsx`、`frontend/src/components/CampusMap/LayerToggles.tsx`

**依据**：`spec.md` 6.20.13；`design.md` 2.28.11.3

**依赖任务**：16.12

**实现要点**
- `BuildingLayer` 用 `flatToContainer` 把每栋建筑画成圆点或小徽标，不画建筑轮廓图片；同一建筑只渲染一个元素。
- `hovertip` 改为跟随鼠标的浮层（`transform: translate3d`），显示建筑名称、类别与「查看详情」入口；点击打开 `BuildingCard` 抽屉，不跳转页面。
- `BuildingCard` 增加 `code`、`campus_name`、`category`、`has_floorplan` 展示；`has_floorplan` 为真时显示「查看楼层」按钮。
- `LayerToggles` 支持「建筑」「求助点」「校门监控」「推荐结果」四个开关，默认建筑与模拟点位开启；开关状态只影响本视图渲染，不请求后端。
- 请求放大时按 `zoom=summary` 拉取列表，点击卡片后再按需取详情；避免一次性拉全量详情。
- `MapView` 负责编排：`useCampusMapLayers` 全量加载（D1 已批准），把 flat 图层、点位、建筑分发给子组件；本任务暂不接入 2.5D 与楼层视图入口。

**完成标准**
- [ ] 平面视图下 8 栋建筑全部可见，悬停显示浮层，浮层不遮挡其它建筑可点区域
- [ ] 点击建筑打开详情抽屉，URL 不跳走；关闭后地图状态保留
- [ ] 四个开关切换生效，关闭推荐结果时不影响其它图层
- [ ] 无建筑图片时建筑仍可见（不出现空白占位）
- [ ] `MapView.tsx` 中无写死建筑名、编号或坐标

**验证命令**
- 沙箱可执行：`cd frontend && npm run build`；`cd frontend && npm run lint`
- 用户本地：浏览器打开 `/map`，逐栋悬停并点击 2 栋以上，确认浮层与抽屉正常

---

### 16.14 2.5D 选楼层 `IsoBuildingLayer`【本地】

**目标**：在 2.5D 底图上用可点击的立体分层块表示建筑，楼层数来自数据而非写死。

**涉及文件**：`frontend/src/components/CampusMap/IsoBuildingLayer.tsx`、`frontend/src/components/CampusMap/IsoBuildingLayer.module.css`、`frontend/src/pages/MapView.tsx`

**依据**：`spec.md` 6.20.14；`design.md` 2.28.11.4

**依赖任务**：16.13

**实现要点**
- 用 SVG 渲染，每个 `floor_count` 生成一层多边形/矩形；层高、顶面偏移以 CSS 变量或组件常量表达，按容器 `scale` 缩放，不写死像素坐标。
- 位置由 `isoToContainer(building.position_x_25d, building.position_y_25d, building.iso_matrix, box)` 计算；同一建筑的所有层共用同一底面中心。
- 悬停时整栋提升视觉层级（`z-index` 或 SVG 绘制顺序），显示名称与「共 N 层」；点击进入该建筑楼层视图并传递建筑 `id`。
- `floor_count` 为空或 0 时按 1 层渲染，且不显示楼层入口按钮。
- 分层顺序：自下而上绘制，上层不得完全遮住下层轮廓；透明度与描边保证重叠建筑可区分。
- 不渲染建筑照片，不请求额外接口；数据全部来自已加载的建筑列表。
- 本层只读展示，不写入任何位置数据。

**完成标准**
- [ ] 2.5D 视图下每栋建筑的分层数与 `floor_count` 一致
- [ ] 点击任意建筑进入对应楼层视图，建筑 `id` 正确传递
- [ ] 组件内无写死坐标、层高像素、建筑名称
- [ ] 两栋相邻建筑重叠时不出现无法点击的遮挡区域
- [ ] 2.5D 底图缺失时展示占位提示，不白屏

**验证命令**
- 沙箱可执行：`cd frontend && npm run build`；`grep -nE "position_\w+ *= *[0-9]{2,}" frontend/src/components/CampusMap/IsoBuildingLayer.tsx`（应无输出）
- 用户本地：切换到 2.5D 视图，核对至少 3 栋建筑层数并逐一点击

---

### 16.15 楼层视图与楼层切换器【本地】

**目标**：支持按建筑查看楼层底图与占位楼层，楼层切换不重新拉取建筑列表。

**涉及文件**：`frontend/src/components/CampusMap/FloorSwitcher.tsx`、`frontend/src/components/CampusMap/FloorSwitcher.module.css`、`frontend/src/pages/MapView.tsx`、`frontend/src/pages/MapView.module.css`

**依据**：`spec.md` 6.20.15；`design.md` 2.28.11.5

**依赖任务**：16.14、16.5

**实现要点**
- `FloorSwitcher` 接收 `floors`、`currentFloorId`、`onSelect`，按 `floor_no` 升序渲染按钮；当前楼层高亮，键盘左右键可切换。
- 楼层视图使用 `kind="floor"` 图层作为底图；`image_path` 为空（占位楼层）时展示「该楼层暂无平面图」占位块，仍显示楼层按钮与返回室外入口。
- 楼层数据来源：`/map/meta` 返回的 `floors`，或 `/layers` 中 `kind="floor"` 的记录（二者字段一致时以 `/map/meta` 为准），不新增接口。
- 切换楼层只更换底图与高亮，不重复请求建筑列表；返回室外时恢复进入前的视图与开关状态。
- 占位楼层不输出比例尺、不输出米数提示；仅在 `scale_calibrated` 为真时显示比例尺。
- 楼层视图保留「返回室外」「切换 2.5D」两个入口。

**完成标准**
- [ ] 有楼层图的建筑可切换楼层，底图随选中楼层变化
- [ ] 占位楼层展示占位提示，页面不报错、不空白
- [ ] 键盘左右键可切换楼层，焦点顺序符合视觉顺序
- [ ] 返回室外后视图与开关状态与进入前一致
- [ ] 无楼层数据的建筑不显示「查看楼层」入口

**验证命令**
- 沙箱可执行：`cd frontend && npm run build`；`cd frontend && npm run lint`
- 用户本地：进入某建筑楼层视图，切换上下楼层并返回室外，确认状态恢复

---

### 16.16 `MapView` 三视图切换与 URL 状态【本地】

**目标**：在室外平面、2.5D 选楼、楼层三个视图间切换，刷新后保持当前视图。

**涉及文件**：`frontend/src/pages/MapView.tsx`、`frontend/src/pages/MapView.module.css`

**依据**：`spec.md` 6.20.13–6.20.15；`design.md` 2.28.11.6

**依赖任务**：16.13、16.14、16.15

**实现要点**
- 视图状态用查询参数表达：`view=flat|iso|floor`，`building=<id>`，`floor=<id>`；使用现有路由方案读写，不新增路由文件。
- 非法或缺失的 `view` 回落到 `flat`；`view=floor` 但缺少 `building` 时回落到 `iso` 并提示一次。
- 切换视图时用 `replace` 更新查询串，不产生大量历史记录；浏览器后退可回到上一视图。
- 视图切换按钮组固定在页面头部，当前视图可识别（`aria-pressed`）。
- 三个视图共享同一份已加载数据，切换不触发重复请求；仅在首次进入或建筑集合变化时刷新。
- 加载中、加载失败、素材缺失三种状态均有可见提示，失败时保留视图切换按钮可用。

**完成标准**
- [ ] 三个视图可互相切换，刷新页面后停留在同一视图与同一建筑楼层
- [ ] 伪造 `view=xxx` 时回落平面视图，无白屏与报错
- [ ] 切换视图不产生重复的 `/layers`、`/buildings` 请求（Network 面板核对）
- [ ] 切换按钮的 `aria-pressed` 与当前视图一致
- [ ] 后端不可用时页面显示错误提示，视图按钮仍可点击

**验证命令**
- 沙箱可执行：`cd frontend && npm run build`；`cd frontend && npm run lint`
- 用户本地：依次切换三视图并刷新，核对 URL 与页面内容一致；断网后刷新确认提示

---

### 16.17 测试夹具与后端测试补全【本地】

**目标**：为地图素材、图层与推荐改造补齐可回归的自动化测试，覆盖 T01–T26。

**涉及文件**：`backend/tests/fixtures/map_asset.json`、`backend/tests/fixtures/map_floors.json`、`backend/tests/fixtures/map_roads.json`、`backend/tests/test_map_assets.py`、`backend/tests/test_map_layers.py`、`backend/tests/test_buildings.py`、`backend/tests/test_search_advice.py`、`backend/tests/test_demo_seed.py`

**依据**：`spec.md` 6.20.16；`design.md` 2.28.12

**依赖任务**：16.4、16.5、16.6、16.7、16.8、16.9、16.10

**实现要点**
- 夹具使用小尺寸图像（宽高取 100–200 之间的互不相同的值）与 3–5 栋建筑，覆盖：正常建筑、缺 `category`、`category` 不可推荐、`floor_count=0`、坐标越界五类样本；不在夹具中复用真实素材数值。
- `test_map_assets.py` 覆盖 T01–T10、T24–T26：版本校验、字段校验、幂等重导、占位楼层、`--dry-run` 不落库、`--prune-buildings` 引用保护、坐标越界拒绝。
- `test_map_layers.py` 覆盖 T11–T23：`kind` 三类取值、按 `kind` 幂等、重复图层清理与引用保护、`/map/meta` 权限与 404、缩放比例尺、2.5D 无比例尺、点位写入校验、推荐排除与米数。
- 改写既有断言：`test_buildings.py` 的总数断言改为按夹具推导而非写死 8，保留 `B01` 编号用例；`test_search_advice.py` 的建筑引用改为夹具中的可推荐建筑；`test_demo_seed.py` 保持「第二次返回 0」并新增「首次 60 条」断言。
- 用例命名统一 `test_t<编号>_<行为>`，便于按编号定位；每个用例只断言一个行为。
- 所有测试使用 `tests/conftest.py` 既有会话与 `create_all` 建表，不引入新 fixture 作用域层级。

**完成标准**
- [ ] `pytest tests/test_map_assets.py tests/test_map_layers.py -q` 全部通过，用例编号连续覆盖 T01–T26
- [ ] `pytest tests/ -q` 全量通过，无 skipped 的既有用例
- [ ] 夹具中不出现真实素材宽高 `1899`/`2400`/`1842`/`0.520366`
- [ ] 每个新增用例失败时能定位到具体任务编号（通过用例名）
- [ ] 未修改 `conftest.py` 的建表方式

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check tests/`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/test_map_assets.py -q`；`cd backend && .venv/Scripts/python -m pytest tests/ -q`

---

### 16.18 清理旧素材、白名单与文档【本地】

**目标**：移除被取代的旧素材与旧配置，放行新底图与楼层图进入仓库与镜像，更新 README 的地图说明。

**涉及文件**：`backend/app/data/buildings.json`（删除）、`backend/storage/campus-2.5d.jpg`（删除）、`.gitignore`、`backend/.dockerignore`、`README.md`

**依据**：`spec.md` 6.20.16；`design.md` 2.28.13.3、2.28.13.4、2.28.14

**依赖任务**：16.4、16.5、16.10、16.17

**实现要点**
- 删除前确认无代码引用：`grep -rn "data/buildings.json\|campus-2.5d" backend frontend` 只应命中已被取代的旧描述；有运行时代码引用则先完成 16.4 再删。
- 删除 `backend/app/data/buildings.json` 与 `backend/storage/campus-2.5d.jpg`；`outdoor.jpg` 保留不动。
- `.gitignore` 在 `backend/storage/*` 下新增 `!backend/storage/campus_flat.webp`、`!backend/storage/campus_25d.webp`、`!backend/storage/floors/`，保留 `!backend/storage/outdoor.jpg`。
- `backend/.dockerignore`（D1 已批准的越界改动）在 `storage/*` 下新增同三项白名单，规则文字与 `.gitignore` 保持一致，顺序为「忽略全部 → 逐项放行」。
- `README.md` 更新：地图三视图说明、`python seed.py` 与 `python -m scripts.import_map_assets` 的执行顺序、素材文件位置、2.5D 不输出米数的说明；不写入任何密钥、内网地址与真实监控描述。
- 删除后复核：`git status` 中旧素材为 deleted、新底图为 untracked 可加入；`docker compose build` 后容器内 `storage/campus_flat.webp` 存在。

**完成标准**
- [ ] `backend/app/data/buildings.json` 与 `backend/storage/campus-2.5d.jpg` 不存在
- [ ] `git check-ignore -v backend/storage/campus_flat.webp backend/storage/campus_25d.webp` 均提示 `!` 放行规则
- [ ] 镜像内 `ls /app/storage` 可见 `campus_flat.webp`、`campus_25d.webp`、`floors/`
- [ ] `grep -rn "campus-2.5d" backend frontend` 无输出
- [ ] README 中的命令可直接复制执行，未出现密钥或真实监控内容

**验证命令**
- 沙箱可执行：`grep -rn "data/buildings.json\|campus-2.5d" backend/app backend/scripts frontend/src`（应无输出）；`git check-ignore -v backend/storage/campus_flat.webp`
- 用户本地：`docker compose up --build` 后访问地图页确认底图加载；`cd backend && .venv/Scripts/python -m pytest tests/ -q`

---

### 16.19 全量验证与手工检查【本地】

**目标**：确认 X2a 全部能力在真实素材与 Docker 环境下可用，且第 1–15 章既有功能无回归。

**涉及文件**：无代码改动（验证记录写入 PR 描述或评审记录，不改本文件以外的文档）

**依据**：`spec.md` 6.20.1–6.20.16；`design.md` 2.28.12、2.28.15

**依赖任务**：16.1–16.18 全部完成

**实现要点**
- 按顺序执行：`pytest tests/ -q` → `ruff check` → `npm run build` → `docker compose up --build` → 浏览器检查。
- 浏览器检查清单：平面视图 8 栋可见；2.5D 视图分层数与数据一致；点击建筑进入楼层视图；占位楼层提示；返回室外状态恢复；刷新保持视图；推荐结果出现在平面视图；关闭开关后对应图层消失。
- 回归检查：发布寻物、认领提交、工作人员核验、确认归还各走一遍；工作人员账号无法自行注册；认领证据与联系方式不出现在公共接口响应中。
- 记录实际输出：`pytest` 通过数与耗时、构建是否告警、Docker 启动是否报错；不编造未执行的检查结果。
- 验证失败时按任务编号回退到对应任务修复，本任务不直接改代码。

**完成标准**
- [ ] `pytest tests/ -q` 全绿，无 failed/error/skip 的既有用例
- [ ] `ruff check .` 与 `ruff format --check .` 无输出
- [ ] `cd frontend && npm run build` 成功，无 TS 错误
- [ ] `docker compose up --build` 后 `/api/v1/map/meta` 返回 200，两张底图均可访问
- [ ] 上述浏览器清单逐项勾选完成，回归流程四条全部通过
- [ ] 验证结果已如实记录，未执行项标注原因

**验证命令**
- 沙箱可执行：`cd backend && .venv/Scripts/python -m ruff check .`；`cd frontend && npm run build`
- 用户本地：`cd backend && .venv/Scripts/python -m pytest tests/ -q`；`docker compose up --build`；浏览器逐项核对清单

---

**第 16 章提交顺序**：16.1 → 16.2 → 16.3 → 16.4 → 16.5 → 16.6 → 16.7 → 16.8 → 16.9 → 16.10 → 16.11 → 16.12 → 16.13 → 16.14 → 16.15 → 16.16 → 16.17 → 16.18 → 16.19。16.11–16.16 可在 16.10 之后并行，16.17 依赖 16.4–16.10，16.18 依赖 16.4、16.5、16.10、16.17。


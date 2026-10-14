# 校园寻物局 · 阶段2架构设计说明书（v1.0）

## 0. 文档信息

| 项 | 内容 |
|---|---|
| 项目 | 校园寻物局（校园失物协作平台） |
| 阶段 | 阶段2：架构与开发准备（仅设计，不实现） |
| 特性名 | `campus_lost_found` |
| 写入路径 | `.codeartsdoer/specs/campus_lost_found/design.md` |
| 上游输入 | 已确认需求规格 `spec.md` v1.0（2026-10-03） |
| 状态 | v1.0（2026-10-03） |
| 图表约定 | mermaid |

**边界声明**：本项目为参赛作品，当前仓库为空目录（0 源文件），从零搭建。本文不实现产品功能，不产生业务代码、开发记录与测试结果。所有需求依据来自已确认的 `spec.md`，未证实判断沿用其 `[假设]` 标记。

---

# 一、需求与存量功能关系分析

## 1.1 存量资产盘点

| 资产 | 说明 | 约束 |
|---|---|---|
| 源码仓库 | 空目录，无既有业务代码 | 全部功能为新增 |
| 需求规格 `spec.md` | 阶段1已确认 v1.0 | 四套状态机、权限边界、10 条假设、EARS 验收为设计唯一依据 |
| 规划文档 `competition-plan/` | README、阶段提示词、评分验收清单、记录模板、Rules/Skill 设计稿 | Rules/Skill 原文依据 |
| 码道配置 | `rule/metadata.properties` 仅 `projectExpert=[]` | Rules/Skill 由团队按官方文档配置 |

**结论**：本次为纯增量设计，不涉及存量和存量改造。

---

# 二、增量设计方案

## 2.1 总体架构关系

### 2.1.1 架构原则

- **单体架构**（前后端分离）：一个 FastAPI 后端、一个 React 前端、一个 PostgreSQL，不引入微服务、独立向量数据库、消息队列、真实视频。
- **后端为唯一权威**：权限、状态机、脱敏、比例尺门控、事务全部后端强制。
- **AI 为旁路增强**：特征提取与候选推荐可整体降级为手动/规则，故障不阻断主流程。
- **分层可增量落地**：先业务闭环（阶段3），再加地图（阶段4）与 AI（阶段5），工单协作（阶段6）。

### 2.1.2 上下文视图

```mermaid
flowchart LR
  subgraph Client["前端 React + TS (Leaflet 图片地图)"]
    UI["大厅/发布/地图/我的委托"]
  end
  subgraph Server["后端 FastAPI (单体)"]
    API["REST API 层<br/>权限/校验/脱敏"]
    SVC["业务服务层<br/>状态机/匹配/事务"]
    AIHW["模型适配器<br/>提取/推荐 + 降级兜底"]
  end
  DB[("PostgreSQL<br/>业务数据 + 缓存快照")]
  FS[("文件存储<br/>图片/证据/底图 私有")]
  MOD["外部模型接口<br/>(仅提取与推荐)"]

  UI -- "HTTPS/JSON (Axios, Bearer Token)" --> API
  API --> SVC
  SVC --> AIHW
  SVC -- "SQLAlchemy" --> DB
  SVC -- "私密文件读写" --> FS
  AIHW -- "超时/降级/额度控制" --> MOD
```

| 组件 | 职责 | 关键约束 |
|---|---|---|
| 前端 React | 渲染大厅/地图/表单/委托页 | 不放密钥；不自行判断权限 |
| 后端 FastAPI | 认证鉴权、状态机、事务、脱敏、比例尺门控、幂等 | 权限判断在服务端；私密字段不进公共响应 |
| PostgreSQL | 业务实体 + 文件元数据 + 候选缓存快照 | 事务保证同一物品仅一次归还 |
| 文件存储 FS | 图片、认领证据、底图 | 受控接口发放，不暴露目录 |
| 模型适配器 AIHW | 特征提取 + 候选推荐 | 仅提取与推荐，超时降级 |

## 2.2 服务/组件总体架构

### 2.2.1 后端分层模块

```mermaid
flowchart TB
  subgraph httpx["HTTP / 路由层"]
    R_AUTH["auth"]
    R_ITEM["items"]
    R_MAP["layers/地图"]
    R_CLAIM["claims"]
    R_TICKET["tickets"]
    R_ME["me"]
    R_MATCH["candidates"]
  end
  subgraph dep["公共服务"]
    AUTHZ["RoleGuard (student/staff/admin)"]
    PRIV["脱敏与私密域序列化器"]
    IDEM["幂等与并发控制"]
  end
  subgraph domain["业务领域"]
    ITEM["物品/状态机"]
    CLAIM["认领/归还事务"]
    TICKET["工单/授权"]
    MAPDM["图层/坐标/比例尺"]
    BADGE["徽章"]
  end
  subgraph adapt["适配器"]
    AIADP["模型适配器 + 降级"]
    STORE["文件存储适配器"]
    CACHE["候选缓存(可选 PG)"]
  end

  R_AUTH --> AUTHZ --> domain
  R_ITEM --> PRIV --> ITEM
  R_MAP --> MAPDM
  R_CLAIM --> CLAIM
  R_TICKET --> TICKET
  R_ME --> BADGE
  R_MATCH --> AIADP
  CLAIM --> IDEM
  CLAIM --> ITEM
  AIADP --> CACHE
  STORE --> FS
```

| 模块 | 职责 | 归属 |
|---|---|---|
| `auth`、`RoleGuard` | 注册、登录、JWT、角色权限 | B |
| `items` | 发布、筛选、详情脱敏 | B |
| `layers/map` | 图层版本、归一化坐标、比例尺标定、点位 | B/A |
| `claims` | 认领、核验、交接、归还事务、幂等 | B |
| `tickets` | 工单状态机、接单、授权、反馈 | B |
| `candidates/feature` | 特征提取、候选匹配、来源标识、降级 | C |
| `me/badges` | 我的委托聚合、徽章去重 | B |
| 前端 map/leaflet | 渲染、坐标换算、画圈/路线、米数门控 | A |
| 前端交互 | 表单、筛选、状态展示、权限提示 | A |
| 评估/证据/演示 | 匹配评估、证据卡、演示脚本 | C |

### 2.2.2 模型接口适配（旁路，可降级）

| 能力 | 输入 | 输出 | 失败行为 |
|---|---|---|---|
| 特征提取 | 图片（可选）+ 文字 | 结构化标签/描述片段 | 留空，允许手动描述继续 |
| 候选推荐 | 已确认特征 + 候选库 | ≤3 候选 + 解释 + 来源标识 | 降级规则推荐或空候选 |

| 模型故障场景 | 系统行为 | 阻断主流程 |
|---|---|---|
| 未配置 Key | 跳过，来源标"规则推荐/空" | 否 |
| 超时 | 返回规则推荐或空候选 | 否 |
| 解析失败/额度耗尽 | 同上 + 记录告警 | 否 |
| 结果含他者私密信息 | 后端过滤 | 否 |
| 模型尝试批准/归还 | 接口层拒绝（模型无写路由） | — |

## 2.3 数据模型

### 2.3.1 设计目标
支撑四套状态机 + 双向匹配 + 工单协作 + 私密域隔离；术语与 spec.md 严格一致；并发可闭合、可幂等、可溯源。私密字段公开序列化时剥离。

### 2.3.2 实体关系图

```mermaid
erDiagram
  USER ||--o{ ITEM : "发布(owner)"
  USER ||--o{ CLAIM : "发起(applicant)"
  USER ||--o{ CLAIM : "核验(reviewer)"
  USER ||--o{ TICKET : "申请(requester)"
  USER ||--o{ TICKET : "处理(assignee)"
  USER ||--o{ BADGE : "获得"
  LAYER ||--o{ ITEM : "标点所在"
  LAYER ||--o{ SIMULATED_POINT : "包含"
  LAYER ||--o{ ROUTE : "所属图层"
  ITEM ||--o{ ATTACHMENT : "图片"
  ITEM ||--o{ ITEM_FEATURE : "特征"
  ITEM ||--o{ ROUTE : "路线/圈选"
  ITEM ||--o{ CANDIDATE : "候选快照"
  CLAIM ||--o{ CLAIM_EVIDENCE : "证据"
  ITEM ||--o{ CLAIM : "匹配目标"
  ITEM ||--o{ TICKET : "工单目标"
```

### 2.3.3 实体与字段
主键统一 UUID，时间戳 `created_at/updated_at`。私密字段：联系方式、精确位置、证据、路线。

**① `user`**：`id` UUID PK；`username` varchar(64) UNIQUE；`password_hash` text（哈希）；`role` enum(student/staff/admin)；`display_name` varchar(64)；`contact` text（私密）；`created_at`。注册接口强制拒绝 `role≠student`。

**② `layer`**：`id`；`name` varchar(64) UNIQUE；`image_path` text；`version` varchar(32)；`width/height` int；`scale_calibrated` boolean DEFAULT false；`pixels_per_meter` numeric（仅标定后）。未标定 ⇒ `pixels_per_meter IS NULL` ⇒ 不输出米数。

**③ `item`**：`id`；`direction` enum(lost/found)；`category` varchar(32)；`title` varchar(128)；`description` text（公开）；`location_area` varchar(128)（楼层级脱敏公开）；`precise_location` text（私密）；`time_occurred` timestamptz NULLABLE；`status` enum；`owner_user_id` FK→user；`layer_id` FK→layer NULLABLE；`norm_x/norm_y` numeric [0,1]；`is_simulated` boolean（模拟点位标识）；`source` enum(manual/rule/cache/model)；`created_at/updated_at`。
status：lost=`寻找中/核验中/已找回/已撤销`；found=`待认领/核验中/已归还/已撤销`。

**④ `attachment`**：`id/item_id`；`file_path` text；`is_evidence` boolean；`created_at`。

**⑤ `item_feature`**：`id/item_id`；`labels` jsonb；`extracted_text` text；`source` enum(manual/model)；`confirmed` boolean（确认后参与匹配）；`confidence` numeric（仅展示）。

**⑥ `route`**：`id/item_id/layer_id`；`kind` enum(polyline/circle)；`geometry` jsonb（归一化点序列 或 `{cx,cy,r}`）；`floor_segments` jsonb（分层路线）；`is_private` boolean 默认 true；`authorized` boolean。

**⑦ `simulated_point`**：`id/layer_id`；`label` varchar(64)；`norm_x/norm_y` numeric；`is_simulated` boolean 恒 true；`description` text；`created_by` FK→user。

**⑧ `claim`**：`id`；`found_item_id` FK→item；`lost_item_id` FK→item NULLABLE；`applicant_user_id` FK→user；`reviewer_user_id` FK→user NULLABLE；`status` enum(待审核/已通过/已拒绝/已完成)；`idempotency_key` varchar(64) UNIQUE；`reviewed_at/completed_at` timestamptz NULLABLE。

**⑨ `claim_evidence`**：`id/claim_id`；`kind` enum(image/text)；`content` text；`created_at`。仅发布者本人 + 该单处理 staff 可见。

**⑩ `ticket`**：`id/item_id`；`requester_user_id` FK→user（仅本人申请）；`assignee_user_id` FK→user NULLABLE；`status` enum(待接单/处理中/已反馈)；`route_authorized` boolean DEFAULT false；`result` text；时间戳。

**⑪ `badge`**：`id/user_id`；`kind` varchar(32)；`awarded_at`。`UNIQUE(user_id, kind)` 防重复。

**⑫ `candidate`**：`id/lost_item_id/found_item_id`；`score` numeric（仅排序）；`explanation` text；`source` enum(simulated/rule/cache/model)；时间戳。

## 2.4 核心接口清单

### 2.4.1 约定
基路径 `/api/v1`；`Authorization: Bearer <JWT>`；错误结构 `{code, message, details?}`；`RoleGuard` 后端注入；脱敏由序列化器统一执行。

| 状态码 | code | 语义 |
|---|---|---|
| 400 | VALIDATION | 参数缺失 |
| 401 | UNAUTH | 未登录 |
| 403 | FORBIDDEN | 越权 |
| 404 | NOT_FOUND | 不存在 |
| 409 | STATE_CONFLICT | 非法流转/重复归还 |
| 422 | PRECONDITION | 前置不满足（未标定比例尺） |
| 503 | MODEL_UNAVAILABLE | 模型降级（不阻断） |

### 2.4.2 接口分组

**A. 认证用户**：`GET /auth/me`；`POST /auth/register`（禁止 role 字段，带 staff/admin⇒403）；`POST /auth/login`；`POST /admin/staff`（仅 admin）。

**B. 发布筛选**：`POST /items`（权限 student；后置 lost→寻找中/found→待认领）；`GET /items`（筛选，脱敏概览，绝不含 precise_location/contact/evidence/route）；`GET /items/{id}`（公开字段，本人或授权 staff 追加私密字段）。

**C. 地图**：`GET /layers`（含 version）；`GET /layers/{id}/image`；`GET /layers/{id}/points`（is_simulated 必标记）；`POST /items/{id}/map-anchor`（仅发布者本人）；`POST /layers/{id}/calibrate`（仅 admin）。

**D. 特征与候选（AI，实验）**：`POST /items/{id}/extract`（模型不可用返回空 + 503）；`GET /items/{id}/candidates`（≤3 条，source 四类，仅发布者本人，降级规则/空）。

**E. 核验归还**：`POST /claims`（证据必填，幂等键）；`POST /claims/{id}/review`（仅 staff）；`POST /claims/{id}/complete`（仅 staff；后置 claim已完成/lost已找回/found已归还；同一物品仅一次，重复⇒409）。

**F. 工单**：`POST /tickets`（仅本人）；`POST /tickets/{id}/assign`（仅 staff）；`POST /tickets/{id}/authorize-route`（仅发布者本人）；`GET /tickets/{id}/route`（发布者或已授权已分配 assignee，否则 403）；`POST /tickets/{id}/feedback`（仅 assignee）。

**G. 我的委托与徽章**：`GET /me/items`、`GET /me/claims`、`GET /me/tickets`、`GET /me/badges`。

### 2.4.3 权限矩阵速查

| 接口 | student | staff | admin |
|---|---|---|---|
| 发布/认领申请/转工单 | ✓（本人） | ✓（本人） | ✓ |
| 核验/归还/接单/反馈 | ✗ | ✓ | ✓ |
| 创建 staff / 标定比例尺 | ✗ | ✗ | ✓ |
| 查看他人私密 | ✗ | 仅授权+分配 | ✓ |

## 2.5 模块任务表与三人责任

| 序号 | 模块任务 | 前置 | 责任 |
|---|---|---|---|
| T1 | 后端骨架：FastAPI+SQLAlchemy+Alembic+Pydantic | — | B |
| T2 | 认证鉴权 + 角色守卫 + 脱敏序列化 | T1 | B |
| T3 | 物品发布/列表/详情 + 状态机骨架 | T2 | B |
| T4 | 认领提交/核验/归还事务 + 幂等 | T3 | B |
| T5 | 前端工程 + 通用组件 | T2 | A |
| T6 | 大厅/发布/认领/我的委托页 | T3,T5 | A |
| T7 | 图层/底图/归一化坐标/标定/点位后端 | T1 | B |
| T8 | Leaflet 图片地图 + 缩放/标点/画圈/分层路线 | T7 | A |
| T9 | 特征提取适配器 + 降级兜底 | T3 | C |
| T10 | 候选匹配 + 四类来源标识 + 候选缓存 | T9 | C |
| T11 | 工单状态机 + 接单/授权/反馈后端 | T1 | B |
| T12 | 工单协作 UI + 模拟点位 + 核查清单 | T11,T8 | A |
| T13 | 徽章发放去重 + 我的委托聚合 | T4,T11 | B |
| T14 | 匹配评估 + 证据卡 | T10 | C |
| T15 | Docker Compose dev/demo/deploy + 密钥后端化 | T1 | B |
| T16 | Rules/Skill 配置 + 阶段验收 | T1–T15 | C |

关键路径：`T1 → T2 → (T3 → T4) → T5/T6 → T7 → T8 → T9 → T10 → T14 → T11 → T12 → T13 → T15 → T16`。

## 2.6 地图技术约定
1. 3 个固定图层：室外示意图、楼1F、楼2F。
2. `layer.version` 统一，变更递增，前端做缓存失效。
3. 以图片左上角为原点 (0,0)，norm = 像素/尺寸，归一化 [0,1]。
4. 圆形范围：中心 (cx,cy) + 半径 r（归一化）。
5. 分层路线：`floor_segments` 跨层多段线。
6. 比例尺门控：未标定 ⇒ 不返回/不渲染米数，后端返回 422。
7. 模拟点位恒标记"模拟点位"，不宣称真实坐标/覆盖。
8. 版本一致性：地图状态持久化回后端。

## 2.7 归还事务、重复请求与状态冲突
以 `found_item.status` 为闭合点，事务 + 行锁 + CAS：

```
事务开始
1. SELECT ... FOR UPDATE（行锁）
2. 校验 found 且 status='核验中'
3. 校验 claim.status='已通过'
4. UPDATE item SET status='已归还' WHERE id AND status='核验中'（CAS）
5. 关联 lost_item CAS 置 '已找回'
6. UPDATE claim SET status='已完成'
7. 提交；影响行数=0 ⇒ 回滚 409
事务结束
```

幂等：`claim.idempotency_key UNIQUE`；`claim.completed_at` 已存在⇒幂等返回；`badge UNIQUE(user_id,kind)` 去重。四套状态机统一守卫函数校验合法流转，非法流转 409。

## 2.8 开发、演示与部署配置
- `.env.example`/后端 `.env`：密钥仅存后端，`.env` 入 `.gitignore`。
- `docker-compose.dev.yml`（热更新）、`docker-compose.demo.yml`（种子数据+模拟点位+稳定降级）、`docker-compose.prod.yml`（生产镜像+受控卷）。
- 密钥：`DATABASE_URL`、DB 密码、`JWT_SECRET`、`MODEL_API_KEY` 仅存后端；私密证据/联系/路线不进公共接口。
- 演示默认 `MODEL_DISABLED=true` 或降超时，验证模型故障不阻断。

## 2.9 码道项目级 Rules 设计

```text
# 校园寻物局项目约束

技术栈：React＋TypeScript、FastAPI、PostgreSQL、Docker Compose、Leaflet 图片地图，单体架构。

- 工作人员权限在后端检查，不能自行注册获取。
- 公开接口不返回联系方式、私密特征、认领证据或路线。
- 路线默认本人可见，主动授权且工单分配后处理人员可见。
- AI 只提取与推荐，用户确认特征，工作人员核验所有权。
- 同一物品只完成一次归还；相关状态更新具有事务和重复请求处理。
- 模拟点位、规则推荐、缓存结果和实时模型分别标明来源。
- 点位距离不代表覆盖范围，无比例尺的地图不显示米数。
- 密钥只存后端，不出现在代码、日志、截图或对话中。
- 不把私密证据、联系方式或路线作为模型输入。
- 模型故障不阻断手动发布、筛选、核验和归还。
- 不接入真实视频，不增加无关框架、商城、3D或自动追踪。
- 修改业务状态同步检查权限、异常与回归场景。
- 只报告实际执行结果；真实、模拟、目标和未验证项分别标记。
- 需求来自场景分析，未证实判断标为假设；团队模拟不代表真实用户认可。
- 每次任务限定范围，输出改动、实际验证、未解决项和证据索引。
```

## 2.10 "校园业务验收" Skill 设计

**名称**：`校园业务验收`
**触发时机**：变更角色、公开/私密字段、状态、地图保存、模型降级、工单或准备阶段交付时。
**输入**：`spec.md`、验收清单、本次代码差异、可用测试命令及环境。
**输出**：检查表、实际测试结果、可复现问题、未执行原因、最小修复建议。
**流程**：读规格与差异 → 映射验收场景 → 检查权限/状态/事务/图层/模型来源/故障行为 → 执行检查并保留输出 → 失败提供复现与最小修复 → 输出通过/不通过/未执行/不适用（阶段是否通过由人工决定）。

**重点检查矩阵**：

| 范围 | 场景 |
|---|---|
| 权限 | 学生越权、他生读私密、未授权 staff 读路线 |
| 归还 | 未核验即归还、重复提交、多申请、状态冲突 |
| 地图 | 保存刷新、楼层切换、跨层片段、无比例尺 |
| 模型 | 未配置、超时、解析失败、额度耗尽、来源标识 |
| 工单 | 本人申请、分配授权、结果反馈、重复徽章 |
| 真实性 | 目标冒充结果、假设冒充结论、模拟冒充真实 |

**边界**：仅引用已确认清单，不新增业务规则，不自动购买/发布/提交。
---

## 2.11 数据库迁移基线与索引设计（阶段3 · T02 细化）

> 本小节为阶段3编码任务「建立 Alembic 迁移基线，并为常用查询列补索引」的增量设计，对应 `tasks.md` 的 T02。上游依据：`spec.md` 3.3 资源依赖（Alembic）、本 `design.md` 2.3 数据模型与 2.5 T1/T02。硬约束：不改表名/列名/列类型；不改 `backend/tests/conftest.py`（测试继续 `create_all`）。

### 2.11.1 需求与存量功能对比

**本任务开始前的存量现状**：

| 存量项 | 位置 | 说明 |
|---|---|---|
| 12 个 SQLAlchemy 模型 | `backend/app/models/*.py` | user / badge / item / attachment / item_feature / route / candidate / layer / simulated_point / claim / claim_evidence / ticket，均已定义 |
| Alembic 环境 | `backend/alembic/env.py` | `target_metadata = Base.metadata`，连接取自 `get_settings().database_url`；但 `versions/` 无任何迁移版本，schema 无版本追踪 |
| 建表方式 | `seed.py`、`tests/conftest.py` | 依赖 `Base.metadata.create_all` 建表，不产生可回放的迁移历史 |
| 索引现状 | 各模型文件 | 仅个别外键列带 `index=True`，未系统覆盖本任务清单 |

**需求功能对比**：

| 需求功能 | 存量匹配情况 | 判定 |
|---|---|---|
| 8 组常用查询列补索引 | 部分列已带 `index=True`，需系统补齐 17 个索引 | 需扩展 |
| 生成初始迁移基线（12 表 + 全部索引） | `versions/` 为空，无迁移版本 | 需新增 |
| `seed.py` 仅写管理员与图层种子数据 | 现依赖 `create_all` 建表后再写种子 | 需改造 |
| Dockerfile 启动命令「迁移→种子→启动」 | 当前无迁移步骤 | 需改造 |
| README 本地运行步骤增加 `alembic upgrade head` | 当前无迁移步骤 | 需改造 |

### 2.11.2 索引设计

**索引清单（17 个，按表分组）**：

| 表 | 列 | 索引用途 |
|---|---|---|
| item | owner_user_id | 按发布者反查「我的委托」 |
| item | direction | 寻物/拾获方向筛选 |
| item | status | 状态筛选（大厅列表） |
| item | created_at | 列表按时间倒序 |
| claim | found_item_id | 按拾获物品反查认领 |
| claim | lost_item_id | 按寻物物品反查认领 |
| claim | applicant_user_id | 按申请人反查认领 |
| claim | status | 认领状态筛选 |
| claim_evidence | claim_id | 按认领反查证据 |
| ticket | item_id | 按物品反查工单 |
| ticket | requester_user_id | 按申请人反查工单 |
| ticket | assignee_user_id | 按处理人反查工单 |
| ticket | status | 工单状态筛选 |
| route | item_id | 按物品反查路线 |
| simulated_point | layer_id | 按图层反查模拟点位 |
| item_feature | item_id | 按物品反查特征 |
| attachment | item_id | 按物品反查附件 |

**选择依据**：17 列均为「外键列（关联/反查）」或「高频筛选列（status/direction）」或「列表排序列（created_at）」。外键列与常用筛选列加索引是项目代码规范要求（见 `docs/代码规范.md`「外键列和常用筛选列加索引」）。

**实现方式与约束**：仅在对应模型 `mapped_column(...)` 上追加 `index=True`，索引名由 SQLAlchemy 默认生成 `ix_<表>_<列>`（Alembic 用 `op.f()` 规范化）。不新增显式 `Index` 对象，不改列定义、不改表名/列名/列类型。
### 2.11.3 迁移基线设计

**基线形态**：单一初始迁移 `backend/alembic/versions/xxxx_initial_schema.py`，`down_revision = None`。`upgrade()` 按依赖顺序执行 12 张表的 `op.create_table` 与全部 `op.create_index`；`downgrade()` 逆序 `op.drop_index` 与 `op.drop_table`。

**枚举跨库兼容（关键决策）**：模型侧所有枚举列使用 `SAEnum(..., native_enum=False, length=N)`；迁移侧对应生成 `sa.Enum('...', name='...', native_enum=False, length=N)`。效果：

- SQLite（无原生 ENUM）与 PostgreSQL（显式禁用原生 ENUM）下均落为 `VARCHAR(N)` 字符串存储，两种数据库 DDL 行为一致。
- 避免 PostgreSQL 原生 ENUM 类型在 SQLite 下不可用，以及枚举值后续变更需 `ALTER TYPE` 的兼容成本。
- 保证 `alembic check` 判定模型与迁移一致（模型 `SAEnum` 与迁移 `sa.Enum` 参数匹配）。

**主键与默认值**：

- 主键 `sa.Uuid()`：PostgreSQL 落 native UUID，SQLite 落 `CHAR(32)`，由 SQLAlchemy 类型适配，跨库一致。
- 时间戳 `server_default=sa.text('(CURRENT_TIMESTAMP)')`：PostgreSQL 与 SQLite 均支持，与模型 `func.now()` 对齐。

**迁移命令与生命周期**：

| 命令 | 作用 | 使用时机 |
|---|---|---|
| `alembic upgrade head` | 建库/升级到最新版本 | 新环境初始化、容器启动 |
| `alembic downgrade -1` | 回退一步 | 排错 |
| `alembic check` | 校验模型与迁移脚本一致 | 验收 / CI |

**schema 一致性保证**：模型仅追加 `index=True`（不改表名/列名/列类型），因此 `create_all` 与迁移脚本生成相同 schema。测试链路（`conftest.py` 继续 `create_all`）与迁移建库互不冲突，且迁移不依赖数据库外键报错（建表仅声明约束，业务写入前仍由 service 校验引用存在）。

### 2.11.4 启动流程改造

- 改造前：`seed.py`（`create_all` + 写种子）→ 启动服务。
- 改造后：`alembic upgrade head`（建表/升级）→ `python seed.py`（仅写种子）→ `uvicorn`（启动服务）。

```mermaid
flowchart LR
  M["alembic upgrade head<br/>建表 / 升级"] --> S["python seed.py<br/>写管理员 + 图层"] --> U["uvicorn<br/>启动服务"]
```

**各文件改动边界**：

| 文件 | 改动 |
|---|---|
| `backend/seed.py` | 移除 `create_all`，仅保留幂等种子写入（管理员按 username 存在则跳过；图层按 name 幂等 upsert） |
| `backend/Dockerfile` | `CMD` 改为 `alembic upgrade head && python seed.py && uvicorn app.main:app ...` |
| `README.md` | 本地运行步骤在 `seed.py` 之前插入 `alembic upgrade head` |

### 2.11.5 验收方案

| # | 验收项 | 期望结果 |
|---|---|---|
| 1 | 删除 `backend/demo.db` → `alembic upgrade head` → `python seed.py` → 启动 → 访问 `/api/v1/health` | 全链路成功，health 返回 ok |
| 2 | 再次执行 `alembic upgrade head` | 幂等，不报错（无待应用迁移） |
| 3 | 执行 `alembic check` | 报告模型与迁移一致，无差异 |
| 4 | `pytest tests/ -q` | 后端测试结果不变（`conftest.py` 继续 `create_all`） |

> 说明：`backend/demo.db` 为本地 SQLite 演示库（`scripts/configure_local.py` 生成 `DATABASE_URL=sqlite:///./demo.db`）；`backend/test_pytest.db` 为测试库，二者互不影响，验收仅针对前者。
---

## 2.12 服务层下沉重构设计（阶段3 · T20）

> 本小节为阶段3编码任务「将路由文件中的业务逻辑下沉至服务层」的增量设计，对应 `tasks.md` 的 T20。上游依据：本 `design.md` 2.2.1 后端分层模块（HTTP/路由层与业务领域分离）、`docs/代码规范.md`「分层」一节。目标为纯重构：接口地址、参数、返回内容、状态码、错误信息全部保持不变。

### 2.12.1 现状与目标

**存量现状**：`app/api/v1/` 下路由函数混杂业务判断、查询拼装与事务提交（`db.query`/`db.add`/`db.commit`），违反「路由层只做取参数、鉴权、调用、返回」的分层约定。

**目标结构**：

| 层 | 职责 | 本次改动 |
|---|---|---|
| `app/api/v1/` | 解析请求、鉴权依赖、调用 service、返回 schema | 移除业务逻辑，仅保留路由职责 |
| `app/services/` | 业务规则、状态流转、事务 | 新增，承接下沉逻辑 |

### 2.12.2 服务划分

| 新建文件 | 承接来源 | 职责 |
|---|---|---|
| `item_service.py` | `items.py` | 物品创建/列表/详情/标点/路线/特征提取/候选获取 |
| `claim_service.py` | `claims.py` | 认领创建/审核/完成三段逻辑及辅助函数 |
| `ticket_service.py` | `tickets.py` | 工单列表/创建/接单/授权路线/查路线/反馈 |
| `matching_service.py` | `items.py` 候选打分 | 导出 `find_candidates`，输入寻物记录返回 ≤3 候选 |
| `user_service.py` | `auth.py` + `admin.py` | 合并「检查用户名存在并创建用户」 |

### 2.12.3 关键约束

- `claim_service.py` 中 `serialize_claim_mutation`、`lock_items`、`replay`、`restore_unclaimed`、`editable_claim` 及创建/审核/完成逻辑原样搬移，加锁顺序、flush/commit 位置、条件更新语句不变。
- 不改 `tests/`、`models/`、`schemas/`；不新增依赖；不顺手优化其他问题。
- 验收：测试仍 18 通过 1 跳过；`ruff check` 无报错；五个路由文件不再出现 `db.query`/`db.add`/`db.commit`。
---

## 2.13 接口响应模型、列表分页与大厅搜索设计

> 本小节为「给所有接口补响应模型、列表接口分页、大厅关键词搜索」任务的增量设计。上游依据：`docs/代码规范.md`「接口」一节（列表接口统一 `limit`/`offset`、返回 `items/total/limit/offset`、每个接口声明 `response_model`）、`spec.md` 3.1 大厅功能（按类别/地点/时间/状态筛选）。本任务会改变列表接口返回结构，前端调用与测试同步适配。硬约束：`precise_location` 仅对发布者本人返回；分页参数越界返回 400（而非 FastAPI 默认 422）。

### 2.13.1 需求与存量功能对比

| 需求功能 | 存量实现 | 代码位置 | 匹配度 |
|---|---|---|---|
| 泛型分页模型 Page | `Page[T]`（items/total/limit/offset） | `backend/app/schemas/common.py:4` | 100% |
| GET /items 分页 + limit/offset | `response_model=Page[ItemPublic]`，`Query(20, ge=1, le=100)`、`Query(0, ge=0)` | `backend/app/api/v1/items.py:22` | 100% |
| GET /claims 分页 | `response_model=Page[ClaimOut]`，仅 staff | `backend/app/api/v1/claims.py:16` | 100% |
| GET /tickets 分页 | `response_model=Page[TicketOut]` | `backend/app/api/v1/tickets.py:16` | 100% |
| GET /me/items、/me/claims、/me/tickets 分页 | 三接口均 `Page[...]` | `backend/app/api/v1/me.py:17/28/39` | 100% |
| GET /items 关键词 q | `ilike` 匹配 title/description/category | `backend/app/services/item_service.py:56` | 100% |
| category 改模糊匹配 | `Item.category.ilike(f"%{category}%")` | `backend/app/services/item_service.py:61` | 100% |
| 8 个接口补齐 response_model | 均已声明 | 见 2.13.5 清单 | 100% |
| precise_location 仅发布者可见 | 详情按 owner 判断，非本人置 None | `backend/app/services/item_service.py:99` | 100% |
| 前端读取 items、types Page | 页面读 `.data.items`；`Page<T>` 已定义 | `frontend/src/types.ts:5`、各页面 | 100% |
| 测试适配与新增 | `test_pagination.py` 4 用例；`test_acceptance.py` 读 items | `backend/tests/` | 100% |

**结论**：本任务所有改动点已在代码中落地，本节作为该实现方案的归档设计，记录关键决策与接口契约，便于后续回归与评审，不新增实现工作。

### 2.13.2 分页模型设计

**泛型模型** `Page[T]`（`backend/app/schemas/common.py`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `items` | `list[T]` | 当前页数据，T 由各列表接口指定（ItemPublic/ClaimOut/TicketOut） |
| `total` | `int` | 满足筛选条件的总条数（供前端未来翻页） |
| `limit` | `int` | 本次请求每页条数，回显 |
| `offset` | `int` | 本次请求偏移量，回显 |

**设计要点**：
- 采用 Pydantic v2 泛型（`class Page[T](BaseModel)`，项目 pydantic 2.13 支持 PEP 695 语法），`items` 元素类型由 T 在声明处静态确定，杜绝 `Any` 与手写字典。
- `total` 在应用 offset/limit **之前**用 `query.count()` 计算，是「过滤后全集条数」而非「当前页条数」；`limit/offset` 回显请求值，便于前端与日志定位分页状态。
- 分页排序统一 `created_at` 倒序（claims 追加 `id` 作稳定二级排序），保证翻页稳定、不重不漏。

### 2.13.3 列表接口分页改造

| 接口 | 返回 | limit/offset | 排序 |
|---|---|---|---|
| GET /items | Page[ItemPublic] | Query(20, ge=1, le=100) / Query(0, ge=0) | created_at desc |
| GET /claims | Page[ClaimOut] | 同上 | created_at desc, id |
| GET /tickets | Page[TicketOut] | 同上 | created_at desc |
| GET /me/items | Page[ItemPublic] | 同上 | created_at desc |
| GET /me/claims | Page[ClaimOut] | 同上 | created_at desc |
| GET /me/tickets | Page[TicketOut] | 同上 | created_at desc |

```mermaid
flowchart LR
  A["用户请求<br/>带 limit/offset/q/category"] --> B["路由层<br/>Query 校验 + 鉴权"]
  B --> C["service 拼查询<br/>filter + ilike + count"]
  C --> D["排序 + offset + limit<br/>返回 (items, total)"]
  D --> E["路由包装 Page<br/>回填 limit/offset"]
  E --> F["响应 {items,total,limit,offset}"]
```

**校验与错误**：
- `limit` 超出 1~100、`offset` 小于 0 由 FastAPI `Query(ge=..., le=...)` 触发 `RequestValidationError`；`app/errors.py:42` 的处理器统一转为 **400 / VALIDATION**，满足代码规范「参数错 400」，避免默认 422。
- 列表接口均保留鉴权（`get_current_user`）；claims 列表仍仅 staff/admin（`require_role(Role.staff)`）；tickets 列表对非 staff 在服务层按 `requester_user_id` 自动过滤。

**服务层签名**：`list_items/list_claims/list_tickets/list_my_*` 统一返回 `tuple[list[T], int]`（数据 + total），路由层负责包装为 `Page` 并回填 limit/offset，职责边界与「路由只取参/鉴权/调用/返回」分层约定一致。

### 2.13.4 大厅关键词搜索

GET /items 新增 `q` 参数，`category` 由精确匹配改为模糊匹配：

| 参数 | 匹配方式 | 匹配字段 |
|---|---|---|
| `q` | `ilike`（不区分大小写） | title、description、category（OR 关系） |
| `category` | `ilike`（模糊） | category |
| `location_area` | `ilike`（模糊） | location_area |

**设计要点**：
- 用 SQLAlchemy `ilike(f"%{kw}%")` 实现不区分大小写包含匹配；多字段用 `or_` 组合。
- `q` 与 `direction/status` 等筛选为 AND 关系，可叠加。
- 关键词为空串时跳过该条件（`if q:`），不产生空匹配子句。
- 搜索仅作用于公开概览字段（title/description/category），不触及 precise_location 等私密字段，符合隐私约束。

### 2.13.5 响应模型补齐清单

为原先直接返回字典的接口声明 `response_model`，字段与现有返回完全一致：

| 接口 | 响应模型 | 关键字段 |
|---|---|---|
| GET /items/{id} 物品详情 | `ItemDetail` | 公开字段 + is_owner + norm/layer + precise_location（仅 owner 非空） |
| POST /items/{id}/map-anchor 设置标点 | `MapAnchorOut` | ok |
| POST /items/{id}/route 创建路线 | `RouteOut` | id、kind、is_private |
| GET /items/{id}/route 查询路线 | `list[RouteDetail]` | id、kind、geometry、floor_segments、is_private、authorized |
| POST /items/{id}/extract 特征提取 | `FeatureExtractionOut` | labels、extracted_text、confidence、source、degraded |
| GET /items/{id}/candidates 候选列表 | `list[CandidateOut]` | found_item_id、score、explanation、source、title、category、location_area |
| GET /me/badges 我的徽章 | `list[BadgeOut]` | id、kind、awarded_at |
| GET /tickets/{id}/route 工单路线 | `list[TicketRouteOut]` | id、kind、geometry、floor_segments |

**设计要点**：
- 服务层返回 dict 中枚举字段以 `.value` 字符串传出，Pydantic 校验时还原为对应枚举，响应 JSON 仍是字符串值，对外契约不变。
- `precise_location` 在 `get_item_detail` 按 `item.owner_user_id == user.id` 判断：非发布者恒为 `null`，发布者返回原文；`is_owner` 字段独立表达归属，二者解耦，便于前端展示。
- 列表模型 `ItemPublic` **不含** `precise_location` 字段，公开列表永不泄露精确位置。

### 2.13.6 前端适配

| 改动 | 位置 |
|---|---|
| 新增泛型 `Page<T>` 类型 | `frontend/src/types.ts:5` |
| 大厅读 `.data.items` + q 搜索输入 | `frontend/src/pages/Home.tsx` |
| 我的委托读三接口 `.data.items` | `frontend/src/pages/MyDelegations.tsx` |
| 认领审核读 `.data.items` | `frontend/src/pages/StaffClaims.tsx` |
| 工单页读 `.data.items` + Page 断言 | `frontend/src/pages/Tickets.tsx` |

**设计要点**：
- 本任务不做翻页 UI，页面仍一次取默认 limit=20 的结果，仅将读取位置从数组改为 `.items`，保证现有功能不变。
- 前端类型与后端 schema 对齐：`Item` 增加可选 `precise_location`、`is_owner`；`Page<T>` 字段与后端一致。

### 2.13.7 测试设计

**现有用例适配**：`test_acceptance.py` 中读取列表的断言由 `r.json()[0]` 改为 `r.json()["items"][0]`（如 `test_private_fields_not_in_public_list`），断言内容不变。

**新增用例**（`backend/tests/test_pagination.py`）：

| 用例 | 覆盖要求 |
|---|---|
| test_list_items_pagination_applies_limit_and_offset | limit/offset 生效，total 正确，越界页返回空 items |
| test_list_items_limit_over_100_returns_400 | limit=101 返回 400 |
| test_list_items_keyword_search_matches_title_description_category | q 命中标题/描述/类别，且不区分大小写 |
| test_item_detail_precise_location_hidden_from_non_owner | 发布者可见 precise_location，他人为 null |

### 2.13.8 验收方案

| # | 验收项 | 期望 |
|---|---|---|
| 1 | 后端 `pytest tests/ -q` | 全部通过（含新增 4 用例）；PostgreSQL 并发用例按环境跳过 |
| 2 | 后端 `ruff check .` | 无报错 |
| 3 | 前端 `npm run lint` 与 `npm run build` | 通过 |
| 4 | 打开 `/docs` | 上述接口均展示 Page 响应结构与 8 个补齐的响应模型 |
---

## 2.14 输入校验与一致性修复设计（阶段3 · T22）

> 本小节为「修复一批已确认的输入校验和一致性问题」任务的增量设计。上游依据：`spec.md` 第 4/5 章（状态机与权限边界）、`docs/代码规范.md`「数据」一节（字符串字段必须有长度上限、归一化坐标用 `Field(ge=0, le=1)` 约束、写入前校验被引用的记录存在）、以及本次任务给定的 8 条缺陷清单。
>
> **允许修改**：`backend/app/schemas/`、`backend/app/services/`、`backend/app/api/v1/`、`backend/app/models/claim.py`、新建一个 Alembic 迁移、`backend/tests/test_validation.py`、`frontend/src/pages/StaffClaims.tsx`、`frontend/src/components/Layout.tsx`。
>
> **硬约束**：不改变认领流程的加锁与事务顺序；不改动第 1~8 条之外的行为。

### 2.14.1 需求与存量功能对比

| # | 需求功能 | 存量实现 | 代码位置 | 判定 |
|---|---|---|---|---|
| 1 | 归一化坐标 0~1，越界 400 | `MapAnchorRequest`/`SimulatedPointCreate` 已用 `Field(ge=0, le=1)`，越界由 `RequestValidationError` 处理器统一转 400/VALIDATION | `schemas/layer.py:27-28,45-46`、`errors.py:42` | 需扩展（补 schema 约束） |
| 2 | 各类字符串长度上限 | 各 schema 已声明 `StringConstraints(max_length=...)` | `schemas/item.py`、`auth.py`、`staff.py`、`layer.py`、`claim.py` | 需扩展（补 schema 约束） |
| 3 | pixels_per_meter 必须 > 0 | `CalibrateRequest` 已用 `Field(gt=0)` | `schemas/layer.py:22` | 需扩展 |
| 4 | 路线几何按 kind 判别结构 | `RouteCreate` 已拆为 `PolylineGeometry`/`CircleGeometry` 联合 + `model_validator` | `schemas/layer.py:50-78` | 需扩展 |
| 5 | 引用存在性校验（layer_id 404） | 三处写入均先 `db.get(Layer, ...)` 判空 | `api/v1/layers.py:68`、`services/item_service.py:105,118` | 需扩展 |
| 6 | 特征提取 text 改请求体 + 去重更新 | `FeatureExtractRequest` 请求体 + `extract_item_features` 按 `confirmed=False` 复用 | `schemas/item.py:56`、`api/v1/items.py:69-76`、`services/item_service.py:151-163` | 需扩展 |
| 7 | 工作人员可执行操作管理员同样可执行 | 后端 `require_role(Role.staff, Role.admin)`，前端导航含 admin | `api/v1/{claims,tickets,layers}.py`、`components/Layout.tsx:29` | 需扩展 |
| 8 | 认领拒绝理由列 + 保存 + 返回 | `claim.review_reason` 列 + 迁移 + 审核保存 + 详情返回 + 前端理由输入 | `models/claim.py:24`、`alembic/versions/7b8c9d0e1f2a_*.py`、`services/claim_service.py:90,171`、`pages/StaffClaims.tsx:139-147` | 需扩展 |

**结论**：本任务为「校验补强 + 一致性修复」，无新增实体、无新增接口，全部改动落在既有 schema/service/路由/模型/迁移/前端组件上；8 条均已在代码中落地，本节作为实现方案归档设计，记录关键决策与契约。

### 2.14.2 分层归属与文件改动清单

| 文件 | 分层 | 改动 |
|---|---|---|
| `backend/app/schemas/layer.py` | schemas | `MapAnchorRequest`/`SimulatedPointCreate` 归一化坐标 `Field(ge=0, le=1)`；`SimulatedPointCreate.label` 1~64、`description` ≤500；`CalibrateRequest.pixels_per_meter` `gt=0`；新增 `RoutePoint/PolylineGeometry/CircleGeometry`，`RouteCreate.geometry` 改为判别联合 + `model_validator` |
| `backend/app/schemas/item.py` | schemas | `ItemCreate.description` ≤2000、`precise_location` ≤200；新增 `FeatureExtractRequest`（`text` 请求体字段 ≤2000） |
| `backend/app/schemas/auth.py` | schemas | `RegisterRequest.contact` ≤100 |
| `backend/app/schemas/staff.py` | schemas | `StaffCreateRequest.contact` ≤100 |
| `backend/app/schemas/claim.py` | schemas | `ReviewRequest.reason` ≤500；`ClaimDetail` 新增 `review_reason` |
| `backend/app/services/item_service.py` | services | `set_map_anchor`/`create_route` 写入前校验 `layer_id` 存在（404）；`extract_item_features` 复用 `confirmed=False` 的 `ItemFeature`，不新增重复记录 |
| `backend/app/api/v1/items.py` | api | `extract` 改为从 `body: FeatureExtractRequest` 取 `text` |
| `backend/app/api/v1/layers.py` | api | `create_simulated_point` 写入前校验 `layer_id` 存在（404） |
| `backend/app/services/claim_service.py` | services | `review_claim` 保存 `review_reason`；`get_claim` 返回 `review_reason` |
| `backend/app/models/claim.py` | models | `Claim` 新增 `review_reason: Mapped[str \| None]`（`Text`，可空） |
| `backend/alembic/versions/7b8c9d0e1f2a_add_claim_review_reason.py` | 迁移 | 新增迁移：`op.add_column('claim', sa.Column('review_reason', sa.Text(), nullable=True))` |
| `backend/tests/test_validation.py` | tests | 8 类校验与一致性用例 |
| `frontend/src/components/Layout.tsx` | components | 导航「认领审核」对 `role === 'staff' \|\| 'admin'` 显示 |
| `frontend/src/pages/StaffClaims.tsx` | pages | 拒绝时可填写理由（`textarea`），提交时携带 `reason` |

**分层说明**：所有参数范围/长度校验下沉到 `schemas` 层（Pydantic），路由与服务层不做手写范围判断；引用存在性与去重更新属业务规则，落在 `services` 层；路由仅取参、鉴权、调用、返回。
### 2.14.3 schema 结构设计

**归一化坐标与长度约束**（`schemas/layer.py`、`schemas/item.py`、`schemas/auth.py`、`schemas/staff.py`、`schemas/claim.py`）：

| Schema 字段 | 约束 | 越界行为 |
|---|---|---|
| `MapAnchorRequest.norm_x/norm_y` | `float = Field(ge=0, le=1)` | 400 / VALIDATION |
| `SimulatedPointCreate.norm_x/norm_y` | `float = Field(ge=0, le=1)` | 400 / VALIDATION |
| `SimulatedPointCreate.label` | `StringConstraints(strip_whitespace=True, min_length=1, max_length=64)` | 400 |
| `SimulatedPointCreate.description` | `StringConstraints(max_length=500)`，可空 | 400 |
| `ItemCreate.description` | `StringConstraints(max_length=2000)`，默认 `""` | 400 |
| `ItemCreate.precise_location` | `StringConstraints(max_length=200)`，可空 | 400 |
| `RegisterRequest.contact` / `StaffCreateRequest.contact` | `StringConstraints(max_length=100)`，可空 | 400 |
| `ReviewRequest.reason` | `StringConstraints(max_length=500)`，可空 | 400 |
| `CalibrateRequest.pixels_per_meter` | `float = Field(gt=0)` | 400 |
| `FeatureExtractRequest.text` | `StringConstraints(strip_whitespace=True, max_length=2000)`，可空 | 400 |

**路线几何判别联合**（`schemas/layer.py`）：

| 模型 | 字段与约束 | 语义 |
|---|---|---|
| `RoutePoint` | `x: float = Field(ge=0, le=1)`、`y: float = Field(ge=0, le=1)` | 归一化坐标点 |
| `PolylineGeometry` | `points: list[RoutePoint] = Field(min_length=2, max_length=200)` | 折线，2~200 个点 |
| `CircleGeometry` | `center: RoutePoint`、`radius: float = Field(gt=0, le=1)` | 圆，圆心 + 半径（0<r≤1） |
| `RouteCreate` | `kind: RouteKind`、`layer_id: uuid.UUID \| None`、`geometry: PolylineGeometry \| CircleGeometry \| None`、`floor_segments: list \| None` | 顶层创建模型 |

`RouteCreate` 以 `@model_validator(mode="after")` 校验 `kind` 与 `geometry` 结构匹配：`polyline` 必须为 `PolylineGeometry`、`circle` 必须为 `CircleGeometry`，否则抛 `ValueError`，由校验处理器转 400。`geometry` 可空（允许先建路线后补几何），但一旦提供则必须与 `kind` 一致。

**响应模型**：`ClaimDetail(ClaimOut)` 新增 `review_reason: str | None = None`，与 `Claim` 模型新增列对齐；`RouteDetail`/`TicketRouteOut` 的 `geometry: dict | None` 继续以字典回显（存储侧 `RouteCreate.geometry.model_dump()` 落库），对外契约不变。

### 2.14.4 service 改动

**引用存在性（第 5 条）**：

| 函数 | 改动 |
|---|---|
| `set_map_anchor`（`services/item_service.py`） | 在 `_get_owned_item` 后、写入 `item.layer_id/norm_*` 前，`db.get(Layer, body.layer_id)` 为空则 `raise ApiError(404, "NOT_FOUND", "图层不存在")` |
| `create_route`（`services/item_service.py`） | 在 `_get_owned_item` 后，`body.layer_id is not None` 且 `db.get(Layer, ...)` 为空则 404 |
| `create_simulated_point`（`api/v1/layers.py`） | 在 `require_role` 后，`db.get(Layer, layer_id)` 为空则 `raise ApiError(404, ...)` |

> 说明：`layer_id` 在三处均为可选/路径参数，须「写入前校验引用存在」而非依赖数据库外键报错，符合代码规范「不依赖数据库外键报错」。

**特征提取去重（第 6 条）**：

`extract_item_features`（`services/item_service.py`）改为「查找未确认记录 → 有则更新、无则新建」：

```
feature = db.query(ItemFeature).filter(item_id == id, confirmed == False).first()
if feature is None: 新建 ItemFeature(item_id, confirmed=False) 并 db.add
feature.labels / extracted_text / source / confidence = result[...]
db.commit()
```

同一物品重复调用仅更新已有未确认记录，不再新增重复 `ItemFeature`。`extract` 路由（`api/v1/items.py`）改为接收 `body: FeatureExtractRequest`，`text` 从请求体取，不再从地址栏参数取。

**拒绝理由（第 8 条）**：

`review_claim`（`services/claim_service.py`）在状态流转与 `reviewer_user_id`、`reviewed_at` 赋值同处追加 `claim.review_reason = body.reason`；`get_claim` 在构造 `ClaimDetail` 时透传 `review_reason=claim.review_reason`。**不改变** `editable_claim`/`lock_items` 的加锁顺序、`flush`/`commit` 位置与条件更新语句。

### 2.14.5 迁移内容

新建 `backend/alembic/versions/7b8c9d0e1f2a_add_claim_review_reason.py`，`down_revision = '5a312e915b0f'`（挂在初始基线之上）：

- `upgrade()`：`op.add_column('claim', sa.Column('review_reason', sa.Text(), nullable=True))`
- `downgrade()`：`op.drop_column('claim', 'review_reason')`

`review_reason` 用 `Text` 可空列，不设默认值、不加索引（仅审核写入，低频查询）；模型侧 `Mapped[str | None] = mapped_column(Text, nullable=True)` 与迁移一致，`alembic check` 无差异。测试链路 `conftest.py` 继续 `create_all`，`review_reason` 随模型建表，与迁移建库行为一致。

### 2.14.6 角色一致与前端改动

**后端**：以下操作已统一 `require_role(Role.staff, Role.admin)`，管理员与工作人员同权：

| 操作 | 路由 |
|---|---|
| 查看/审核/确认归还认领 | `api/v1/claims.py` 的 `GET /claims`、`POST /claims/{id}/review`、`POST /claims/{id}/complete` |
| 接单/反馈工单 | `api/v1/tickets.py` 的 `POST /tickets/{id}/assign`、`POST /tickets/{id}/feedback` |
| 查看/创建模拟点位 | `api/v1/layers.py` 的 `GET/POST /layers/{id}/simulated-points` |

**前端**：`components/Layout.tsx` 导航「认领审核」入口条件由仅 staff 改为 `role === 'staff' || role === 'admin'`；`pages/StaffClaims.tsx` 同步以 `role !== 'staff' && role !== 'admin'` 守卫，拒绝时新增「拒绝理由（可选）」`textarea`，`act('reject')` 提交 `{ approve: false, reason: reason.trim() || undefined }`。

> 前端隐藏按钮仅作展示，权限仍在后端强制（`require_role`），管理员可执行操作不会因前端条件遗漏而受限。

### 2.14.7 测试设计思路

新增 `backend/tests/test_validation.py`（复用 `test_acceptance.py` 的 `create_user/login/register/auth` 与自建 `create_layer/item/staff_token/admin_token` 辅助函数），按 8 条逐类覆盖，每类含正常 + 非法输入/权限：

| # | 用例 | 覆盖 |
|---|---|---|
| 1 | `test_map_anchor_coordinate_out_of_range_returns_400`、`test_simulated_point_coordinate_out_of_range_returns_400` | 归一化坐标越界（1.5 / -0.1）返回 400 |
| 2 | `test_item_description_and_precise_location_length_limits`、`test_contact_length_limit_on_register_and_staff`、`test_simulated_point_label_and_description_length_limits`、`test_review_reason_length_limit` | 各字符串长度上限（2001/201/101/65/501/501）返回 400，临界值（2000/200）返回 200 |
| 3 | `test_calibrate_non_positive_pixels_per_meter_returns_400` | `pixels_per_meter` 为 0 / 负 返回 400 |
| 4 | `test_route_polyline_geometry_validation`、`test_route_circle_geometry_validation` | 折线少于 2 点 / 坐标越界 / 结构错配；圆半径 0 或 >1 / 结构错配 返回 400，合法结构 200 |
| 5 | `test_simulated_point_missing_layer_returns_404`、`test_map_anchor_missing_layer_returns_404`、`test_route_missing_layer_returns_404` | `layer_id` 不存在返回 404 |
| 6 | `test_extract_uses_request_body_and_length_limit`、`test_extract_repeat_updates_existing_unconfirmed_feature` | 请求体 `text` 生效、>2000 返回 400；重复调用仅一条 `ItemFeature` 且内容为最新 |
| 7 | `test_admin_can_review_and_complete_claim`、`test_admin_can_assign_and_feedback_ticket`、`test_admin_can_list_simulated_points` | 管理员可查看/审核/完成认领、接单/反馈工单、查看模拟点位 |
| 8 | `test_review_reason_saved_and_returned` | 拒绝理由保存且认领详情返回 |

### 2.14.8 验收方案

| # | 验收项 | 期望 |
|---|---|---|
| 1 | `cd backend && .venv/Scripts/python -m pytest tests/ -q` | 全部通过（含新增 `test_validation.py` 用例；PostgreSQL 并发用例按环境跳过） |
| 2 | `cd backend && .venv/Scripts/python -m ruff check .` | 无报错 |
| 3 | `cd backend && .venv/Scripts/alembic upgrade head` + `alembic check` | 迁移应用成功，模型与迁移一致无差异 |
| 4 | `cd frontend && npm run lint` 与 `npm run build` | 通过 |---

## 2.15 前端接口层、请求 Hook 与基础组件重构设计

> 本小节为「为前端搭建接口层、请求 Hook、设计变量和基础组件，并把现有页面迁移过去」任务的增量设计。上游依据：`spec.md` 3.1 必做功能（大厅/发布/匹配/认领/工单/我的委托/地图）、`docs/代码规范.md`「前端」一节（`src/api/` 每类资源一个文件、页面不直接写接口地址、不写内联 `style`、统一 `useAsync`、颜色/间距/圆角/字号只引用 `tokens.css`）。目标为**纯前端重构**：页面功能与文案不变，视觉只做统一，不改路由结构、页面数量与业务流程；不新增任何第三方依赖；全程不使用 `any`。

**用户已确认的三个关键点（必须纳入）**：
1. 颜色取值：主色 `#2563eb`、成功 `#16a34a`、警告 `#d97706`、危险 `#dc2626`；所有颜色只定义在 `tokens.css`，组件与页面不得出现任何颜色数值。
2. 搜索框 `q` 与类别输入框一样，均做 300 毫秒防抖。
3. `AuthContext` 的 `login`、`register`、`me` 也改用 `api/auth.ts`、`api/me.ts`；最终整个 `frontend/src` 中只有 `src/api/` 目录下文件可导入并使用 `client`。

**硬约束**：不引入 UI 组件库与 CSS 框架；不改路由结构、页面数量、业务流程；不使用 `any`。

### 2.15.1 需求与存量功能对比

#### 已实现功能（可直接复用）

| 需求功能 | 存量功能 | 代码位置 | 匹配度 |
|---|---|---|---|
| axios 封装与鉴权注入 | `client`（baseURL `/api/v1`、Bearer 注入、401 广播 `auth-expired`、`errorMessage`） | `frontend/src/api/client.ts:1-48` | 100% |
| 前端基础类型 | `Direction/ItemStatus/Source/Page/Item/Ticket/Claim/ClaimDetail/Candidate` 及中文 label | `frontend/src/types.ts:1-92` | 75% |
| 认证上下文 | `AuthProvider`（login/register/logout/token 持久化/auth-expired 监听） | `frontend/src/auth/AuthContext.tsx:17-87` | 75% |
| 路由结构 | 8 个路由 + Layout + RequireAuth | `frontend/src/App.tsx:14-36` | 100% |

#### 需扩展的功能

| 需求功能 | 存量功能 | 差异说明 | 扩展方向 |
|---|---|---|---|
| `types.ts` 与后端响应对齐 | `Item` 缺 `norm_x/norm_y/layer_id`；缺 `Role/User/Layer/SimulatedPoint/Badge/Evidence/FeatureExtractionOut` | 后端 `ItemDetail` 已含 `norm_x/norm_y/layer_id/precise_location/is_owner`（`schemas/item.py:37-53`） | `Item` 增补三字段（可选），新增上述类型 |
| AuthContext 改走接口层 | `login/register/me` 直接 `client.post/get`（`AuthContext.tsx:38-80`） | 需满足「只有 `src/api/` 可引用 client」 | 改用 `api/auth.ts` 的 `login/register/me` |
| Layout 角色中文 + 去内联 style | 显示 `角色：{role}`，内联 style（`Layout.tsx:16-31`） | 需中文映射 + 组件化 | 用 `roleLabels` + 基础组件 + `Layout.module.css` |
| 页面状态管理 | 各页面手写 `active/loading/error` 标记与 `client` 调用 | 需统一到 `useAsync` | 用 `useAsync` 替换 |
| 大厅类别/搜索防抖 | 输入即时发请求（`Home.tsx:38-54`） | q 与 category 均需 300ms 防抖 | 用 `useDebounce` |
| 幂等键生成 | `crypto.randomUUID()`（`ItemDetail.tsx:76`） | 非 HTTPS 且非 localhost 下不存在 | 新建 `utils/id.ts` 兜底 |

#### 需新增的功能或接口

**接口层（`src/api/`）**：`auth.ts`、`items.ts`、`claims.ts`、`tickets.ts`、`layers.ts`、`me.ts`（`client.ts` 保留为唯一 axios 入口）。

**Hook（`src/hooks/`）**：`useAsync.ts`、`useDebounce.ts`。

**设计变量（`src/styles/`）**：`tokens.css`。

**基础组件（`src/components/`）**：`Button`、`Card`、`Tag`、`Field`、`Empty`、`ErrorNotice`、`Spinner`、`PageContainer`（各带同名 `.module.css`）。

**工具（`src/utils/`）**：`id.ts`（幂等键生成，兼容非 HTTPS 环境的 `crypto.randomUUID`）。

### 2.15.2 目标目录结构与依赖关系

```
frontend/src/
├── api/
│   ├── client.ts        # 唯一 axios 入口（仅 api/ 内部引用）
│   ├── auth.ts          # 登录/注册/当前用户
│   ├── items.ts         # 物品 CRUD/标点/路线/特征/候选
│   ├── claims.ts        # 认领列表/详情/提交/审核/完成
│   ├── tickets.ts       # 工单列表/创建/接单/授权/反馈/路线
│   ├── layers.ts        # 图层列表/底图/标定/模拟点位
│   └── me.ts            # 我的物品/认领/工单/徽章
├── hooks/
│   ├── useAsync.ts      # 异步请求状态（data/error/loading/reload）
│   └── useDebounce.ts   # 输入防抖
├── styles/
│   └── tokens.css       # CSS 设计变量（唯一颜色来源）
├── utils/
│   └── id.ts            # 幂等键生成
├── components/
│   ├── Button.tsx / Button.module.css
│   ├── Card.tsx / Card.module.css
│   ├── Tag.tsx / Tag.module.css
│   ├── Field.tsx / Field.module.css
│   ├── Empty.tsx / Empty.module.css
│   ├── ErrorNotice.tsx / ErrorNotice.module.css
│   ├── Spinner.tsx / Spinner.module.css
│   ├── PageContainer.tsx / PageContainer.module.css
│   ├── Layout.tsx（改造）+ Layout.module.css（新增）
│   └── RequireAuth.tsx（改造）
├── pages/（9 页改造，删除内联 style 与 client 调用）
├── auth/AuthContext.tsx（改造，改走接口层）
├── types.ts（补全）
├── App.tsx / main.tsx / index.css（index.css 精简为 tokens 引入 + reset）
```

```mermaid
flowchart TB
  subgraph P["页面层 src/pages + components/Layout"]
    HOME["Home"]; FORM["ItemForm"]; DETAIL["ItemDetail"]; MAP["MapView"]
    ME["MyDelegations"]; STAFF["StaffClaims"]; TK["Tickets"]; AUTH["Login/Register"]
  end
  subgraph C["基础组件 src/components"]
    BTN["Button"]; CARD["Card"]; TAG["Tag"]; FIELD["Field"]
    EMPTY["Empty"]; ERR["ErrorNotice"]; SPIN["Spinner"]; PC["PageContainer"]
  end
  subgraph H["src/hooks"]
    UA["useAsync"]; UD["useDebounce"]
  end
  subgraph API["接口层 src/api"]
    A["auth"]; I["items"]; CL["claims"]; T["tickets"]; L["layers"]; M["me"]
  end
  CLIENT["client.ts (axios)"]
  TOKENS["styles/tokens.css"]
  BE["后端 /api/v1"]

  P --> C
  P --> H
  P --> API
  AUTH --> API
  C --> TOKENS
  P --> TOKENS
  API --> CLIENT --> BE
```

**依赖边界**：页面与 `AuthContext` 只依赖接口层函数与 Hook；只有 `src/api/*` 导入 `client.ts`；颜色/间距/圆角/字号只引用 `tokens.css` 变量。

### 2.15.3 接口层设计

#### 总体设计

- 每个资源一个文件，导出「带完整类型的请求函数」，命名与后端业务语言一致（`listItems`、`getItem`、`createClaim` 等）。
- 所有函数返回 `Promise<具体类型>`，入参使用精确接口类型（可选参数显式标注 `| null | undefined`），**不使用 `any`**。
- `client.ts` 继续承担 baseURL、Bearer 注入、401 广播与 `errorMessage`；`setToken/getToken` 供 `AuthContext` 使用，但页面不再 import client。
- 列表接口统一返回 `Page<T>`；`GET /layers` 返回数组；`GET /layers/{id}/image` 返回 `Blob`。

#### 接口清单

**`auth.ts`**（`Role`/`User` 定义于 `types.ts`）：

```ts
export interface LoginRequest { username: string; password: string }
export interface RegisterRequest { username: string; password: string; display_name: string; contact?: string | null }
export interface TokenResponse { token: string; role: Role }

export function login(body: LoginRequest): Promise<TokenResponse>
export function register(body: RegisterRequest): Promise<TokenResponse>
export function me(): Promise<User>
```

**`items.ts`**：

```ts
export interface ListItemsParams {
  direction?: Direction | null
  category?: string | null
  location_area?: string | null
  status?: ItemStatus | null
  q?: string | null
  limit?: number
  offset?: number
}
export interface ItemCreateInput {
  direction: Direction
  category: string
  title: string
  description: string
  location_area: string
  precise_location: string | null
  time_occurred?: string | null
  is_simulated?: boolean
}
export interface MapAnchorInput { layer_id: string; norm_x: number; norm_y: number; is_simulated?: boolean }
export interface RoutePoint { x: number; y: number }
export interface PolylineGeometry { points: RoutePoint[] }
export interface CircleGeometry { center: RoutePoint; radius: number }
export type RouteKind = 'polyline' | 'circle'
export interface RouteCreateInput {
  kind: RouteKind
  layer_id?: string | null
  geometry?: PolylineGeometry | CircleGeometry | null
  floor_segments?: unknown[] | null
}
export interface RouteOut { id: string; kind: RouteKind; is_private: boolean }
export interface RouteDetail {
  id: string
  kind: RouteKind
  geometry: Record<string, unknown> | null
  floor_segments: unknown[] | null
  is_private: boolean
  authorized: boolean
}
export interface FeatureExtractionOut {
  labels: Record<string, unknown> | null
  extracted_text: string | null
  confidence: number | null
  source: string
  degraded: boolean
}

export function listItems(params?: ListItemsParams): Promise<Page<Item>>
export function getItem(id: string): Promise<Item>
export function createItem(body: ItemCreateInput): Promise<Item>
export function setMapAnchor(id: string, body: MapAnchorInput): Promise<{ ok: boolean }>
export function createRoute(id: string, body: RouteCreateInput): Promise<RouteOut>
export function getRoutes(id: string): Promise<RouteDetail[]>
export function extractFeatures(id: string, text: string | null): Promise<FeatureExtractionOut>
export function getCandidates(id: string): Promise<Candidate[]>
```

> 说明：`route`/`feature` 等函数为对齐后端契约一并补齐，供后续地图/提取页使用，本阶段页面若未用到可先不调用；核心要求是 `listItems`、`getItem`、`createItem`、`getCandidates` 及 `Item` 增补 `norm_x/norm_y/layer_id`。

**`claims.ts`**：

```ts
export interface EvidenceInput { kind: 'text' | 'image'; content: string }
export interface ClaimCreateInput {
  found_item_id: string
  lost_item_id: string | null
  evidence: EvidenceInput[]
  idempotency_key: string
}
export interface ReviewInput { approve: boolean; reason?: string | null }
export interface ListClaimsParams { status?: ClaimStatus | null; limit?: number; offset?: number }

export function listClaims(params?: ListClaimsParams): Promise<Page<Claim>>
export function getClaim(id: string): Promise<ClaimDetail>
export function createClaim(body: ClaimCreateInput): Promise<Claim>
export function reviewClaim(id: string, body: ReviewInput): Promise<Claim>
export function completeClaim(id: string): Promise<Claim>
```

**`tickets.ts`**：

```ts
export interface TicketCreateInput { item_id: string }
export interface FeedbackInput { result: string }
export interface TicketRoute {
  id: string
  kind: RouteKind
  geometry: Record<string, unknown> | null
  floor_segments: unknown[] | null
}
export interface ListTicketsParams { status?: TicketStatus | null; limit?: number; offset?: number }

export function listTickets(params?: ListTicketsParams): Promise<Page<Ticket>>
export function createTicket(body: TicketCreateInput): Promise<Ticket>
export function assignTicket(id: string): Promise<Ticket>
export function authorizeRoute(id: string): Promise<Ticket>
export function getTicketRoute(id: string): Promise<TicketRoute[]>
export function feedbackTicket(id: string, body: FeedbackInput): Promise<Ticket>
```

**`layers.ts`**：

```ts
export interface CalibrateInput { pixels_per_meter: number }
export interface SimulatedPointInput { label: string; norm_x: number; norm_y: number; description?: string | null }

export function listLayers(): Promise<Layer[]>
export function getLayerImage(id: string, signal?: AbortSignal): Promise<Blob>
export function calibrateLayer(id: string, body: CalibrateInput): Promise<Layer>
export function listSimulatedPoints(id: string): Promise<SimulatedPoint[]>
export function createSimulatedPoint(id: string, body: SimulatedPointInput): Promise<SimulatedPoint>
```

**`me.ts`**：

```ts
export function listMyItems(params?: { limit?: number; offset?: number }): Promise<Page<Item>>
export function listMyClaims(params?: { limit?: number; offset?: number }): Promise<Page<Claim>>
export function listMyTickets(params?: { limit?: number; offset?: number }): Promise<Page<Ticket>>
export function listMyBadges(): Promise<Badge[]>
```

### 2.15.4 类型补全（`types.ts`）

**新增类型**（与后端 schema 对齐，`id` 均以字符串承接 UUID）：

| 类型 | 字段 |
|---|---|
| `Role` | `'student' \| 'staff' \| 'admin'` |
| `roleLabels: Record<Role, string>` | 学生 / 工作人员 / 管理员 |
| `User` | `id; username; display_name; role: Role` |
| `Layer` | `id; name; version; width; height; scale_calibrated; image_path: string \| null` |
| `SimulatedPoint` | `id; label; norm_x; norm_y; is_simulated; description: string \| null` |
| `Badge` | `id; kind; awarded_at` |
| `EvidenceKind` | `'text' \| 'image'` |

**`Item` 增补**：`norm_x: number | null`、`norm_y: number | null`、`layer_id: string | null`（列表响应中为 null，详情响应返回实际值；`precise_location`/`is_owner` 保持可选）。

**`ClaimDetail` 增补**：`review_reason: string | null`（对齐后端 `ClaimDetail.review_reason`）。

> 设计说明：`Item` 作为「列表项 + 详情」的超集接口沿用现状（详情字段可选）；如后续需区分可再定义 `ItemDetail extends Item` 将 `norm_x/norm_y/layer_id` 收敛为必填，本阶段为降低改动面暂用单一接口 + 可选字段。

### 2.15.5 请求 Hook 设计

**`useAsync.ts`**：

```ts
export interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T>
```

- `fn` 返回 Promise；挂载及 `deps` 变化时自动执行，`loading` 置 true，成功后写入 `data`，失败后把 `errorMessage(e)` 写入 `error`。
- **旧结果丢弃**：用「请求序号 + active 标志」实现——每次执行/卸载递增序号，回调前校验序号未变且未卸载，否则丢弃结果，避免竞态与卸载后 setState 告警。
- `reload` 手动重新触发（不改变依赖数组）。

**`useDebounce.ts`**：

```ts
export function useDebounce<T>(value: T, delayMs = 300): T
```

- 内部 `useEffect` + `setTimeout`，返回延迟后的值；value 变化 300ms 内重置计时器，清理时 `clearTimeout`。

**页面用法**（以 `Home.tsx` 为例）：`q`、`category` 分别 `useDebounce` 得到 `debouncedQ/debouncedCategory`，连同 `direction/status` 作为 `useAsync(listItems, [debouncedQ, debouncedCategory, direction, status])` 的依赖，实现搜索框与类别输入均 300ms 防抖后发请求。
### 2.15.6 设计变量（`styles/tokens.css`）

唯一颜色来源；组件与页面只引用变量，不写具体数值。取值沿用现有页面颜色（`index.css` 与各页内联色），主/成功/警告/危险按用户确认值。

```css
:root {
  /* 语义色 */
  --color-primary: #2563eb;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;

  /* 文字三级 */
  --color-text-1: #1f2937;   /* 主要 */
  --color-text-2: #6b7280;   /* 次要 */
  --color-text-3: #9ca3af;   /* 辅助 */

  /* 背景两级 */
  --color-bg-1: #f5f7fa;     /* 页面背景 */
  --color-bg-2: #ffffff;     /* 卡片/容器背景 */

  /* 边框 */
  --color-border: #e5e7eb;

  /* 间距 6 级 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  /* 圆角 3 级 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* 字号 5 级 */
  --font-xs: 12px;
  --font-sm: 14px;
  --font-md: 16px;
  --font-lg: 20px;
  --font-xl: 24px;

  /* 阴影 2 级 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.10);
}
```

**取值依据**：主色 #2563eb、成功 #16a34a、警告 #d97706、危险 #dc2626 为用户确认值；文字 #1f2937/#6b7280、背景 #f5f7fa/#ffffff、边框 #e5e7eb 沿用 `index.css:9-10`、`Home.tsx:69`、`Layout.tsx:21`；圆角 8px 沿用 `index.css:29`；字号/间距从现有 14px、12px、8px、16px、24px、32px 归纳为 5/6/3/2 级。`index.css` 精简为 `@import './styles/tokens.css'` + reset（`*{box-sizing}`、`body{margin:0}`、`font-family`、控件 `font: inherit`）。

### 2.15.7 基础组件设计

每个组件一个文件 + 同名 `.module.css`，样式只引用 tokens 变量；组件与业务无关，可复用。

| 组件 | Props | 变体/行为 |
|---|---|---|
| `Button` | `variant?: 'primary' \| 'secondary' \| 'danger'`（默认 primary）、`loading?: boolean`、`disabled?: boolean`、`type?: 'button' \| 'submit'`、`onClick?`、`children` | loading 时禁用并显示 `Spinner`；disabled/loading 均不可点击 |
| `Card` | `children`、`className?` | 背景 bg-2、圆角 radius-md、内边距 space-4、阴影 shadow-sm |
| `Tag` | `children`、`tone?: 'neutral' \| 'primary' \| 'success' \| 'warning' \| 'danger'` | 小型标签，用于状态/来源标识 |
| `Field` | `label: string`、`error?: string \| null`、`required?: boolean`、`htmlFor?`、`children` | 表单项：label + 控件插槽 + 错误提示（danger 色，`role="alert"`） |
| `Empty` | `text?: string`（默认「暂无数据」） | 空态占位 |
| `ErrorNotice` | `message: string` | 错误提示（`role="alert"`，danger 色） |
| `Spinner` | `size?: 'sm' \| 'md'` | 加载指示（CSS 动画，不引第三方图标） |
| `PageContainer` | `children` | 页面容器：max-width、margin auto、内边距 space-5（替代原 `.page`） |

**无障碍约定**：`Button` 支持 `loading` 时加 `aria-busy`；`Field` 通过 `htmlFor` 关联 label 与控件（或控件自带 `aria-label`）；`ErrorNotice`/`Empty` 带 `role="alert"`/`role="status"`，满足代码规范「表单控件必须有 label 或 aria-label」「提交类按钮请求期间禁用」。

**`Layout` 改造**：内联 style 移入新增 `Layout.module.css`；角色显示改用 `roleLabels[role]`（学生/工作人员/管理员），`role` 为 null 时不渲染角色；导航「认领审核」条件保持 `role === 'staff' || role === 'admin'`；「退出」用 `Button variant="secondary"`。

### 2.15.8 页面迁移映射

| 页面 | 原 client 调用 | 迁移后调用 | 组件/Hook |
|---|---|---|---|
| `Home` | `GET /items` | `listItems(params)` | `useAsync` + `useDebounce`(q、category 各 300ms) + `Card`/`Tag`/`Empty`/`ErrorNotice`/`Spinner`/`PageContainer` |
| `ItemDetail` | `GET /items/:id`、`GET /items/:id/candidates`、`GET /me/items`、`POST /claims` | `getItem`/`getCandidates`/`listMyItems`/`createClaim` | `useAsync` + `Card`/`Field`/`Button` + `id.ts` 幂等键 |
| `ItemForm` | `POST /items` | `createItem` | `Field`/`Button`/`ErrorNotice`/`PageContainer` |
| `Login` | `login`（context） | `login`（context 内部已改走 `api/auth.ts`） | `Field`/`Button`/`ErrorNotice` |
| `Register` | `register`（context） | `register`（context） | `Field`/`Button`/`ErrorNotice` |
| `MapView` | `GET /layers`、`GET /layers/:id/image`、`GET /layers/:id/simulated-points` | `listLayers`/`getLayerImage`/`listSimulatedPoints` | `useAsync`(图层)+ Leaflet 副作用保留 + `ErrorNotice`/`PageContainer` |
| `MyDelegations` | `GET /me/items\|claims\|tickets\|badges` | `listMyItems`/`listMyClaims`/`listMyTickets`/`listMyBadges`（`Promise.all`） | `useAsync` + `Card`/`Tag`/`Empty`/`Spinner` |
| `StaffClaims` | `GET /claims`、`GET /claims/:id`、`GET /items/:id`、`POST review/complete` | `listClaims`/`getClaim`/`getItem`/`reviewClaim`/`completeClaim` | `useAsync` + 提交 `busy` 保留（`Button loading`）+ `Card`/`Field`/`Tag` |
| `Tickets` | `GET /tickets`、`GET /me/items`、`POST /tickets*` | `listTickets`/`listMyItems`/`createTicket`/`assignTicket`/`authorizeRoute`/`feedbackTicket` | `useAsync` + `Button loading` + `Card`/`Field`/`Empty` |
| `AuthContext` | `client.post /auth/login`、`/auth/register`、`client.get /auth/me` | `login`/`register`/`me`（`api/auth.ts`） | 保持 token 持久化与 auth-expired 监听逻辑 |

**迁移原则**：页面只做「数据获取 + 组件拼装」，不写接口地址、不写 `client.`、不写内联 `style`；提交类操作（认领、发布、审核、工单动作）保留 `busy` 防重复，改用 `Button loading/disabled` 呈现；列表空态用 `Empty`，错误用 `ErrorNotice`，加载用 `Spinner`。

### 2.15.9 兼容性修复（`utils/id.ts`）

`ItemDetail.tsx:76` 使用 `crypto.randomUUID()`，在非 HTTPS 且非 localhost 环境下不存在。新建 `utils/id.ts`：

```ts
export function createIdempotencyKey(): string
```

- 优先 `crypto.randomUUID()`（带 `typeof crypto !== 'undefined' && 'randomUUID' in crypto` 判空）；
- 不可用时回退 `crypto.getRandomValues(new Uint8Array(16))` 生成 32 位十六进制串（与 UUID 长度一致），保障幂等键在 HTTP 环境可用。
- 返回值为「等长随机十六进制串」，满足后端 `idempotency_key` 长度 ≤64 约束（`schemas/claim.py:19`）。

`ItemDetail` 的 `key.current = crypto.randomUUID()` 改为 `key.current = createIdempotencyKey()`，其余逻辑不变。

### 2.15.10 验收方案

| # | 验收项 | 期望 |
|---|---|---|
| 1 | `frontend/src` 搜索 `style={{` | 结果 0 |
| 2 | `frontend/src/pages` 搜索 `client.` | 结果 0（`client` 仅 `src/api/` 内引用） |
| 3 | `frontend/src` 中颜色十六进制数值 | 仅出现在 `styles/tokens.css`，组件/页面零颜色数值 |
| 4 | `cd frontend && npm run lint` | 通过（无 any、无未用导入） |
| 5 | `cd frontend && npm run build` | 通过（`tsc -b` 类型检查 + vite 构建） |
| 6 | 启动前后端手工走查 | 注册→发布寻物→发布拾获→查看候选→提交认领→我的委托→打开地图 全流程正常，文案与功能不变 |
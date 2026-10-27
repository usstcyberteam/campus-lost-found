# 校园寻物局 - 架构分析报告

## 1. 项目概述

### 1.1 项目简介

**校园寻物局** 是一个校园失物协作平台，服务于高校场景下的失物招领需求。平台连接学生与工作人员两个角色，提供从发布寻物/拾获、候选推荐、私密认领、工作人员核验到确认归还的完整工作流。

### 1.2 核心业务能力

- **寻物/拾获发布**: 学生可发布寻物或拾获信息，包含类别、标题、描述、地点、时间等
- **规则候选推荐**: 基于类别和地点匹配，自动推荐可能的失物-拾获对
- **私密认领机制**: 认领证据（文本/图片）仅对本人和工作人员可见
- **工作人员审核**: 工作人员审核认领申请，可批准或拒绝
- **归还确认**: 事务性保证同一物品只能完成一次归还
- **协助工单**: 无候选时可转协助工单，工作人员接单处理
- **地图标记**: 支持室内外地图标记与路线授权

### 1.3 目标用户

| 角色 | 权限范围 |
|------|----------|
| 学生 (student) | 注册登录、发布记录、查看候选、提交认领、申请协助、地图标记 |
| 工作人员 (staff) | 审核认领、确认归还、接单工单、查看模拟点位（由管理员创建） |
| 管理员 (admin) | 创建工作人员、校准地图图层 |

---

## 2. 目录结构

```
campus-lost-found-main/
├── backend/                 # FastAPI 后端应用
│   ├── app/
│   │   ├── api/v1/         # API 路由层
│   │   │   ├── auth.py     # 认证（注册/登录/我的信息）
│   │   │   ├── admin.py    # 管理员（创建工作人员）
│   │   │   ├── items.py    # 物品管理（CRUD/候选/路线/特征提取）
│   │   │   ├── claims.py   # 认领管理（创建/审核/完成）
│   │   │   ├── tickets.py  # 工单管理（创建/接单/授权路线/反馈）
│   │   │   ├── layers.py   # 图层管理（底图/模拟点位）
│   │   │   ├── me.py       # 当前用户信息
│   │   │   └── router.py   # 路由聚合
│   │   ├── core/           # 核心组件
│   │   │   ├── security.py # 密码哈希/JWT 令牌
│   │   │   └── deps.py     # 依赖注入（当前用户/角色校验）
│   │   ├── models/         # 数据模型（SQLAlchemy ORM）
│   │   │   ├── user.py     # 用户、徽章
│   │   │   ├── item.py     # 物品、附件、特征、路线、候选
│   │   │   ├── claim.py    # 认领、证据
│   │   │   ├── ticket.py   # 工单
│   │   │   ├── layer.py    # 图层、模拟点位
│   │   │   └── enums.py    # 枚举定义
│   │   ├── schemas/        # Pydantic 模式
│   │   │   ├── auth.py     # 认证请求/响应
│   │   │   ├── item.py     # 物品创建/公开响应
│   │   │   ├── claim.py    # 认领请求/响应
│   │   │   ├── ticket.py   # 工单请求/响应
│   │   │   ├── layer.py    # 图层请求/响应
│   │   │   ├── staff.py    # 工作人员创建
│   │   │   └── validation.py # 输入校验约束
│   │   ├── services/       # 业务服务
│   │   │   └── model.py    # 特征提取（手动降级）
│   │   ├── config.py       # 配置管理（Pydantic Settings）
│   │   ├── database.py     # 数据库连接与会话
│   │   ├── errors.py       # 异常处理与错误响应
│   │   └── main.py         # FastAPI 应用入口
│   ├── alembic/            # 数据库迁移（当前无正式版本）
│   ├── tests/              # 测试套件
│   │   ├── test_acceptance.py # 验收测试
│   │   ├── test_regressions.py # 回归测试
│   │   └── conftest.py     # 测试配置
│   ├── requirements.txt    # 生产依赖
│   ├── requirements-dev.txt # 开发依赖
│   ├── seed.py             # 数据种子（初始化管理员与图层）
│   └── Dockerfile          # 后端容器配置
├── frontend/               # React 前端应用
│   ├── src/
│   │   ├── api/client.ts   # Axios HTTP 客户端
│   │   ├── auth/AuthContext.tsx # 认证状态管理
│   │   ├── components/
│   │   │   ├── Layout.tsx  # 页面布局
│   │   │   └── RequireAuth.tsx # 路由守卫
│   │   ├── pages/
│   │   │   ├── Home.tsx    # 大厅（物品列表/筛选）
│   │   │   ├── ItemForm.tsx # 发布物品表单
│   │   │   ├── ItemDetail.tsx # 物品详情/认领
│   │   │   ├── Login.tsx   # 登录页
│   │   │   ├── Register.tsx # 注册页
│   │   │   ├── MapView.tsx # 地图视图
│   │   │   ├── MyDelegations.tsx # 我的委托
│   │   │   ├── Tickets.tsx # 工单管理
│   │   │   └── StaffClaims.tsx # 认领审核（工作人员）
│   │   ├── App.tsx         # 路由配置
│   │   ├── main.tsx        # 应用入口
│   │   └── types.ts        # TypeScript 类型定义
│   └── package.json        # 前端依赖
├── competition-plan/       # 比赛规划文档
├── docs/                   # 项目文档
├── scripts/                # 工具脚本
├── docker-compose.yml      # Docker Compose 编排
└── AGENTS.md               # 项目说明
```

---

## 3. 技术栈

### 3.1 后端技术

| 组件 | 技术选型 | 版本 |
|------|----------|------|
| 运行时 | Python | 3.13 |
| Web 框架 | FastAPI | - |
| ORM | SQLAlchemy | - |
| 数据库 | PostgreSQL / SQLite | - |
| 迁移工具 | Alembic | - |
| 认证 | JWT (PyJWT) | HS256 |
| 密码哈希 | bcrypt | - |
| 校验 | Pydantic | v2 |
| 配置 | pydantic-settings | - |

### 3.2 前端技术

| 组件 | 技术选型 | 版本 |
|------|----------|------|
| 运行时 | Node.js | 22.12+ |
| 框架 | React | 18 |
| 语言 | TypeScript | - |
| 构建工具 | Vite | - |
| HTTP 客户端 | Axios | - |
| 路由 | React Router | - |
| 地图 | Leaflet | - |

### 3.3 基础设施

| 组件 | 技术选型 |
|------|----------|
| 容器化 | Docker Compose |
| 服务编排 | docker-compose.yml |
| 数据库容器 | PostgreSQL |

---

## 4. 核心架构组件

### 4.1 后端分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        API 路由层                            │
│  (app/api/v1/*.py)                                          │
│  - 请求校验、权限检查、响应格式化                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        业务服务层                            │
│  (app/services/model.py)                                    │
│  - 特征提取（当前手动降级）                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据访问层                            │
│  (app/models/*.py)                                          │
│  - SQLAlchemy ORM 实体定义                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        数据存储层                            │
│  PostgreSQL / SQLite                                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 核心模块说明

#### 4.2.1 认证模块 (`app/api/v1/auth.py`)

- **注册**: `POST /api/v1/auth/register` - 创建学生账户
- **登录**: `POST /api/v1/auth/login` - 获取 JWT 令牌
- **我的信息**: `GET /api/v1/auth/me` - 获取当前用户信息

**安全机制**:
- 密码使用 bcrypt 哈希
- JWT 令牌包含用户 ID 和角色
- 令牌有效期 1440 分钟（24 小时）

#### 4.2.2 物品模块 (`app/api/v1/items.py`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/items` | POST | 发布物品 | 已登录用户 |
| `/items` | GET | 物品列表（筛选） | 已登录用户 |
| `/items/{id}` | GET | 物品详情 | 已登录用户 |
| `/items/{id}/map-anchor` | POST | 设置地图标记 | 物品所有者 |
| `/items/{id}/route` | POST/GET | 路线管理 | 物品所有者 |
| `/items/{id}/extract` | POST | 特征提取 | 物品所有者 |
| `/items/{id}/candidates` | GET | 候选推荐 | 物品所有者 |

**隐私保护**:
- 非所有者无法查看精确位置、坐标、图层信息

#### 4.2.3 认领模块 (`app/api/v1/claims.py`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/claims` | GET | 认领列表 | 工作人员 |
| `/claims/{id}` | GET | 认领详情（含证据） | 申请人/工作人员 |
| `/claims` | POST | 创建认领 | 学生 |
| `/claims/{id}/review` | POST | 审核认领 | 工作人员 |
| `/claims/{id}/complete` | POST | 完成归还 | 工作人员 |

**并发控制**:
- PostgreSQL advisory lock 串行化写操作
- 行锁 + 条件更新保证归还唯一性
- 幂等键防止重复提交

#### 4.2.4 工单模块 (`app/api/v1/tickets.py`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/tickets` | GET | 工单列表 | 已登录用户（仅自己的） |
| `/tickets` | POST | 创建协助工单 | 物品所有者 |
| `/tickets/{id}/assign` | POST | 接单 | 工作人员 |
| `/tickets/{id}/authorize-route` | POST | 路线授权 | 工单申请人 |
| `/tickets/{id}/route` | GET | 获取路线 | 申请人/已授权接单人 |
| `/tickets/{id}/feedback` | POST | 反馈结果 | 接单人 |

#### 4.2.5 图层模块 (`app/api/v1/layers.py`)

| 端点 | 方法 | 功能 | 权限 |
|------|------|------|------|
| `/layers` | GET | 图层列表 | 已登录用户 |
| `/layers/{id}/image` | GET | 底图获取 | 已登录用户 |
| `/layers/{id}/calibrate` | POST | 校准比例尺 | 管理员 |
| `/layers/{id}/items` | GET | 图层物品 | 已登录用户 |
| `/layers/{id}/simulated-points` | GET/POST | 模拟点位 | 工作人员/管理员 |

---

## 5. 数据模型

### 5.1 实体关系图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    User     │       │    Item     │       │    Layer    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◀──────│ owner_user_id│       │ id (PK)     │
│ username    │       │ layer_id    │──────▶│ name        │
│ password_hash│      │ ...         │       │ image_path  │
│ role        │       └─────────────┘       │ ...         │
│ display_name│               │             └─────────────┘
│ contact     │               │
└─────────────┘               │
      │                       │
      │                       ▼
      │             ┌──────────────────┐
      │             │     Claim        │
      │             ├──────────────────┤
      │             │ found_item_id    │
      │             │ lost_item_id     │
      │             │ applicant_user_id│
      │             │ reviewer_user_id │
      │             │ status           │
      │             │ idempotency_key  │
      │             └──────────────────┘
      │                       │
      ▼                       ▼
┌─────────────┐       ┌──────────────────┐
│   Ticket    │       │  ClaimEvidence   │
├─────────────┤       ├──────────────────┤
│ item_id     │       │ claim_id         │
│ requester_id│       │ kind             │
│ assignee_id │       │ content          │
│ status      │       └──────────────────┘
│ route_auth  │
└─────────────┘
```

### 5.2 枚举定义

| 枚举 | 值 |
|------|-----|
| Role | student, staff, admin |
| Direction | lost, found |
| ItemStatus | searching, reviewing, found, withdrawn, pending, returned |
| ClaimStatus | pending, approved, rejected, completed |
| TicketStatus | pending, processing, feedback |
| Source | manual, rule, cache, model |
| RouteKind | polyline, circle |
| EvidenceKind | image, text |

---

## 6. 安全架构

### 6.1 认证流程

```
┌────────┐     POST /auth/register      ┌────────┐
│  用户   │─────────────────────────────▶│  后端   │
│        │                               │        │
│        │     POST /auth/login          │        │
│        │─────────────────────────────▶│        │
│        │                               │        │
│        │◀────── JWT Token ─────────────│        │
│        │                               │        │
│        │     Bearer Token              │        │
│        │─────────────────────────────▶│        │
└────────┘                               └────────┘
```

### 6.2 权限控制

**角色层级**:
```
admin (创建工作人员、校准图层)
  │
  ├── staff (审核认领、接单工单、查看模拟点位)
  │   │
  │   └── student (发布记录、提交认领、申请协助、地图标记)
```

**权限校验实现**:

```python
# 依赖注入实现角色校验
def require_role(*roles: Role) -> Callable:
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="无权限")
        return user
    return dependency
```

### 6.3 数据隐私

| 数据 | 可见范围 |
|------|----------|
| 认领证据 | 仅申请人 + 工作人员 |
| 联系方式 | 仅本人 + 工作人员 |
| 精确位置 | 仅物品所有者 |
| 路线 | 默认私密，授权后工单接单人可访问 |

### 6.4 并发安全

**认领写操作**:
- PostgreSQL advisory lock: `pg_advisory_xact_lock(13000338)`
- 行锁: `SELECT ... FOR UPDATE`
- 条件更新: `UPDATE ... WHERE status = 'reviewing' AND rowcount = 1`

**归还唯一性保证**:
```python
result = db.execute(update(Item)
    .where(Item.id == claim.found_item_id, Item.status == ItemStatus.reviewing)
    .values(status=ItemStatus.returned))
if result.rowcount != 1:
    db.rollback()
    raise ApiError(409, "STATE_CONFLICT", "物品已归还或状态冲突")
```

---

## 7. 数据流

### 7.1 认领流程

```
┌─────────┐    发布寻物记录     ┌─────────┐
│  学生A   │──────────────────▶│  物品表  │
└─────────┘                    └─────────┘
                                    │
┌─────────┐    发布拾获记录        │
│  学生B   │──────────────────▶│
└─────────┘                    │
                               ▼
                        ┌─────────────┐
                        │  候选推荐    │
                        │ (规则匹配)   │
                        └─────────────┘
                               │
                               ▼
┌─────────┐    提交认领        ┌─────────────┐
│  学生A   │──────────────────▶│  认领表     │
│         │    私密证据        │ (pending)   │
└─────────┘                    └─────────────┘
                                    │
                                    ▼
┌─────────┐    审核              ┌─────────────┐
│ 工作人员 │──────────────────▶│  认领表     │
│         │    批准/拒绝         │ (approved/  │
└─────────┘                    │  rejected)  │
                               └─────────────┘
                                    │
                                    ▼
┌─────────┐    确认归还          ┌─────────────┐
│ 工作人员 │──────────────────▶│  物品表     │
│         │    事务保证          │ (returned)  │
└─────────┘                    └─────────────┘
```

### 7.2 工单流程

```
┌─────────┐    申请协助          ┌─────────────┐
│  学生   │──────────────────▶│  工单表     │
│         │                    │ (pending)   │
└─────────┘                    └─────────────┘
                                    │
                                    ▼
┌─────────┐    接单              ┌─────────────┐
│ 工作人员 │──────────────────▶│  工单表     │
│         │                    │ (processing)│
└─────────┘                    └─────────────┘
                                    │
                                    ▼
┌─────────┐    授权路线          ┌─────────────┐
│  学生   │──────────────────▶│  路线表     │
│         │                    │ (authorized)│
└─────────┘                    └─────────────┘
                                    │
                                    ▼
┌─────────┐    反馈结果          ┌─────────────┐
│ 工作人员 │──────────────────▶│  工单表     │
│         │                    │ (feedback)  │
└─────────┘                    └─────────────┘
```

---

## 8. 状态机

### 8.1 物品状态机

**寻物 (lost)**:
```
寻找中 ──▶ 核验中 ──▶ 已找回
   │
   └──▶ 已撤销
```

**拾获 (found)**:
```
待认领 ──▶ 核验中 ──▶ 已归还
   │
   └──▶ 已撤销
```

### 8.2 认领状态机

```
待审核 ──▶ 已通过 ──▶ 已完成
   │
   └──▶ 已拒绝
```

### 8.3 工单状态机

```
待接单 ──▶ 处理中 ──▶ 已反馈
```

---

## 9. 前端架构

### 9.1 组件层次

```
┌─────────────────────────────────────┐
│           App.tsx (路由)             │
├─────────────────────────────────────┤
│  AuthProvider (认证状态)             │
│  │                                  │
│  ├── RequireAuth (路由守卫)          │
│  │   └── Layout (页面布局)           │
│  │       ├── Home (大厅)            │
│  │       ├── ItemForm (发布)        │
│  │       ├── ItemDetail (详情)      │
│  │       ├── MapView (地图)         │
│  │       ├── MyDelegations (我的)   │
│  │       ├── Tickets (工单)         │
│  │       └── StaffClaims (审核)     │
│  ├── Login (登录)                   │
│  └── Register (注册)                │
└─────────────────────────────────────┘
```

### 9.2 认证状态管理

```typescript
// AuthContext.tsx
interface AuthState {
  token: string | null
  role: Role | null
  userId: string | null
  ready: boolean
  login: (username, password) => Promise<void>
  register: (username, password, displayName) => Promise<void>
  logout: () => void
}
```

**会话持久化**: sessionStorage 存储令牌

**自动刷新**: 401 响应时触发 `auth-expired` 事件，自动登出

### 9.3 API 客户端

```typescript
// client.ts
const client = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

// 请求拦截器：注入 Bearer Token
client.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：401 自动登出
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth-expired'))
    }
    return Promise.reject(error)
  }
)
```

---

## 10. 部署架构

### 10.1 Docker Compose 编排

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://campus:campus@db:5432/campus
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    depends_on:
      - backend

  db:
    image: postgres:latest
    environment:
      - POSTGRES_USER=campus
      - POSTGRES_PASSWORD=campus
      - POSTGRES_DB=campus
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 10.2 网络拓扑

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ http://localhost:5173
       ▼
┌─────────────┐      ┌─────────────┐
│  Frontend   │─────▶│  Backend    │
│  (Vite Dev) │      │  (uvicorn)  │
└─────────────┘      └──────┬──────┘
                            │ postgresql://db:5432
                            ▼
                     ┌─────────────┐
                     │  PostgreSQL │
                     └─────────────┘
```

---

## 11. 关键设计决策

### 11.1 并发控制策略

**问题**: 同一拾获记录可能被多个认领同时申请，需要保证归还唯一性。

**解决方案**:
- PostgreSQL advisory lock 串行化认领写操作
- 行锁 (`SELECT ... FOR UPDATE`) 锁定关联物品
- 条件更新 (`UPDATE ... WHERE status = 'reviewing' AND rowcount = 1`)

### 11.2 隐私保护策略

**问题**: 认领证据和联系方式需要保护，防止泄露。

**解决方案**:
- 认领证据仅对申请人和工作人员可见
- 精确位置和坐标仅对物品所有者可见
- 路线默认私密，需主动授权

### 11.3 AI 降级策略

**问题**: 真实 AI 模型不可用时，系统需要继续工作。

**解决方案**:
- 特征提取服务明确返回 `degraded: True`
- 来源标识为 `manual` 而非 `model`
- AI 仅用于推荐，不决定所有权

---

## 12. 待改进项

| 领域 | 改进项 |
|------|--------|
| 数据库迁移 | 无正式 Alembic 版本，需建立迁移流程 |
| 图片上传 | 未实现图片上传与理解功能 |
| 特征提取 | 真实模型调用未实现 |
| 语义匹配 | 规则匹配仅基于类别和地点 |
| 地图 | 室内底图尚未提供 |
| 高并发 | 认领写操作串行化，未针对高并发优化 |
| 测试 | PostgreSQL 并发测试默认跳过 |
| 部署 | 当前配置仅供本地开发，非公网部署方案 |

---

## 13. 总结

校园寻物局是一个采用 FastAPI + React 单体架构的校园失物协作平台。系统采用基于角色的访问控制，通过事务级并发控制保证数据一致性，实现了完整的寻物-拾获-认领-归还工作流。当前系统已完成基础功能，AI 功能处于降级状态，适合作为后续开发的基础。

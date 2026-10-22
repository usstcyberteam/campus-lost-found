# AI 模块交接文档

日期：2026-10-21。截止：2026-10-31。
仓库：`https://github.com/usstcyberteam/campus-lost-found`，当前所有开发在 **`feature/cui-docs-update`** 分支上（还没合并到 main）。

---

## 一、AI 在项目里做什么

AI 页（底部第三个标签）有两个功能：

| 功能 | 用户操作 | 系统做什么 |
|---|---|---|
| **智能整理发帖** | 用一句话描述，如"昨天下午在一食堂二楼丢了蓝色水杯" | 提取类别、标题、描述、地点、楼层、时间、建筑，生成草稿；跳到发布页由用户确认后才发布 |
| **寻物地点推荐** | 选一条自己的寻物帖（用它保存的圈选范围或路径），或在地图上现画 | 推荐最多 5 个优先寻找的建筑，每个附理由和米数；结果在地图"AI 推荐层"高亮 |

推荐的做法是**算法打分 + 模型写理由**：先按距离、该楼历史寻物/拾获数量、同类物品数量、楼的类型与物品是否相关打分排序，再让模型根据分数写一句理由。模型不可用时用模板理由。

### 必须遵守的规则

这些写在仓库根目录 `AGENTS.md` 和码道规则里，评委会看：

1. AI 只能提取、推荐、生成草稿；**不能批准认领、确认归还，也不能替用户发布**。
2. AI 输出要经用户确认才保存，界面标注"AI 生成，仅供参考"和来源（实时模型 / 规则）。
3. **发给模型的内容不得包含**：精确位置、联系方式、认领证据、他人的私密路线。代码里有手机号、邮箱、身份证号的过滤。
4. **模型挂了不能影响任何手动流程**：超时 10 秒，失败自动降级为规则结果。
5. **密钥只放在 `backend/.env`**，不能写进代码、提交到 Git、出现在截图或码道对话里。

---

## 二、代码在哪里

### 后端

| 文件 | 作用 |
|---|---|
| `backend/app/services/model_client.py` | 调用模型的唯一入口。OpenAI 兼容的 `/chat/completions` 接口，温度 0.2，失败返回 None |
| `backend/app/services/ai_service.py` | 智能整理发帖：规则提取（`_rule_draft`）+ 模型提取（`_model_draft`），提示词在 `_SYSTEM_PROMPT` |
| `backend/app/services/advice_service.py` | 寻物地点推荐：打分（`_score`）、米数（`_meters`）、模型写理由（`_model_reasons`），提示词在 `_EXPLAIN_PROMPT` |
| `backend/app/api/v1/ai.py` | 两个接口：`POST /api/v1/ai/draft-post`、`POST /api/v1/ai/search-advice` |
| `backend/app/schemas/ai.py` | 请求和返回的数据结构 |
| `backend/app/services/matching_service.py` | 寻物帖的候选匹配，**目前只有规则**（类别一致 +1，地点一致 +0.5） |
| `backend/app/services/model.py` | 旧的特征提取占位函数，未接模型 |
| `backend/tests/test_ai_draft.py`、`test_search_advice.py` | 15 个测试，用假的模型客户端模拟各种返回 |

### 前端

| 文件 | 作用 |
|---|---|
| `frontend/src/pages/AiPage.tsx` | AI 页 |
| `frontend/src/components/AiChat/` | 对话式输入框和消息列表 |
| `frontend/src/api/ai.ts` | 两个接口的调用函数 |
| `frontend/src/hooks/useSearchAdvice.ts` | 推荐请求状态，AI 页和地图页共用 |
| `frontend/src/components/CampusMap/AIRecommendLayer.tsx` | 地图上的 AI 推荐层 |
| `frontend/src/components/CampusMap/HeatmapLayer.tsx` | 热力层（按建筑统计进行中的帖子） |

### 模型配置（`backend/.env`）

```text
MODEL_BASE_URL=        # 例如华为云 ModelArts Studio 的 OpenAI 兼容地址，填到 /v1 为止即可
MODEL_NAME=            # 模型名称
MODEL_API_KEY=         # 密钥，只放这里
MODEL_DISABLED=true    # 改成 false 才会真正调用
MODEL_TIMEOUT_SECONDS=10
```

任何一项为空，或 `MODEL_DISABLED=true`，都视为模型不可用，自动走规则。

---

## 三、现状与待办

### 已完成

- 两个接口、规则降级、模型调用封装、隐私过滤、15 个测试
- AI 页界面；草稿带入发布页并提示"已带入 AI 整理草稿"
- 推荐结果显示真实楼名和米数，在地图上高亮
- 演示数据 60 条，供推荐和热力图使用

### 待办（按优先级）

| 编号 | 任务 | 说明 |
|---|---|---|
| **A1** | 接入真实模型并修正发帖提取 | 目前**从来没有真正调用过模型**，所有结果都是规则降级。另有两个缺陷：草稿没有提取"寻物还是拾获"；提示词要求模型输出建筑编号，但没告诉它有哪些楼，模型只能瞎猜 |
| **A2** | AI 候选匹配 | 寻物帖的候选拾获目前只看类别和地点是否完全相同。改为模型比较描述相似度并给出理由，是 AI 部分最能体现"专业贴合与创新"的点 |
| **A3** | 提示词评测 | 评分里明确写了"Prompt 设计质量"。用 20 条测试描述评估提取准确率，形成一份评测记录，也是码道使用证明的好材料 |
| A4（可选） | 照片识别 | 上传照片后用多模态模型识别物品类别和颜色。取决于能用的模型是否支持图片，时间不够就不做 |

**A1 是前提，做完再做 A2、A3。**

---

## 四、开始前的准备

### 1. 拉代码、建自己的分支

```bash
git clone https://github.com/usstcyberteam/campus-lost-found.git
```

```bash
cd campus-lost-found
```

```bash
git checkout feature/cui-docs-update
```

```bash
git checkout -b feature/ai-model
```

以后每做完一个任务提交到自己的分支，完成后合并回 `feature/cui-docs-update`。开始新任务前先拉取最新代码：`git pull origin feature/cui-docs-update`。

### 2. 搭本地环境

需要 Python 3.13 以上、Node.js 22 以上。

```bash
python scripts/configure_local.py
```

```bash
cd backend; python -m venv .venv; .venv/Scripts/python -m pip install -r requirements-dev.txt
```

```bash
.venv/Scripts/python -m alembic upgrade head; .venv/Scripts/python seed.py; .venv/Scripts/python scripts/import_map_assets.py
```

```bash
.venv/Scripts/python -m pytest tests/ -q
```

最后一条应为 177 个左右通过、1 个跳过、0 失败。

启动（两个终端）：

```bash
cd backend; .venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend; npm ci; npm run dev
```

浏览器打开 `http://localhost:5173`。

### 3. 配置码道

码道的规则文件不在仓库里（被 Git 忽略了），需要从队长那里拿两份文件，放到你自己仓库的 `.codeartsdoer/rule/` 下：`代码规范.mdc` 和 `码道项目规则Rules.mdc`。

码道的沙箱**跑不了后端测试、启动不了服务**，这是正常的。它让你在终端执行的验证命令，你自己执行后把结果贴回给它。

### 4. 申请模型

推荐用**华为云 ModelArts Studio（MaaS）**上的大模型：评分里"技术架构"一项要求"结合华为云其他服务"。它提供 OpenAI 兼容接口，项目代码不用改，只需在 `.env` 里填地址、模型名和密钥。拿不到的话，任何 OpenAI 兼容的服务都行，在说明文档里如实写明。

---

## 五、码道提示词

每个任务在码道里新开会话，先发开场提示词（让它读项目），再发任务提示词。码道在"需求规格""技术设计"阶段停下时，内容没问题就回复"进入下一阶段"。

### A1 接入真实模型并修正发帖提取

先在 `backend/.env` 里填好模型配置并把 `MODEL_DISABLED` 改为 `false`。**不要把 .env 的内容发给码道。**

```text
任务：A1 让"智能整理发帖"真正调用模型，并修正提取缺陷。

允许修改：
- backend/app/services/ai_service.py、backend/app/schemas/ai.py
- backend/tests/test_ai_draft.py
- frontend/src/pages/AiPage.tsx、frontend/src/types.ts、frontend/src/api/ai.ts
- frontend/src/pages/ItemForm.tsx（只允许接收草稿中的类型字段）

要求：
1. 草稿增加 direction 字段（lost 寻物 / found 拾获）。规则提取：含"丢""掉了""找不到""遗失"判为 lost；含"捡到""拾到""发现了一个"判为 found；都没有时为 null。模型提取：提示词增加该字段。发布页收到草稿后预选对应类型。
2. 建筑匹配改为按名称：提示词让模型输出 building_name（建筑名称原文），不再输出编号。后端用 building 表做匹配：先完全相同，再看名称是否互相包含，再试常用简称（如"一食堂"对应"第一食堂"、"图书馆"对应"图文信息中心"），简称对照表写成模块级常量。匹配不到时只保留 location_area 文字，不填建筑。
3. 提示词中给出 2 个输入输出示例（一个寻物、一个拾获），要求只输出 JSON，未知字段填 null。
4. 不改变降级行为：模型不可用、超时、返回无法解析时，结果与现在的规则提取一致。
5. 测试：新增类型提取（寻物、拾获、无法判断各一个）、简称匹配（一食堂、图书馆）、模型返回未知楼名时不填建筑。原有测试不改。

验收：
- ruff check、ruff format --check、npm run lint、npm run build 通过。
- 总结中列出需要我在终端运行的测试命令，以及需要我在浏览器中验证的步骤：在 AI 页输入 5 句不同的描述，记录每句的提取结果和来源是"实时模型"还是"规则"。
```

做完后，你自己在浏览器里试几句，**截图保存来源显示为"实时模型"的结果**，这是"真实调用过模型"的证据。

### A2 AI 候选匹配

```text
任务：A2 把寻物帖的候选匹配升级为"规则初筛 + 模型复核"。

参照：
- 模型调用一律通过 backend/app/services/model_client.py 的 chat_completion。
- 降级与隐私过滤的写法参照 backend/app/services/advice_service.py 中的 _model_reasons 和 _sanitize。

允许修改：
- backend/app/services/matching_service.py
- 相关 schemas（只允许给候选增加字段）
- 新建 backend/tests/test_matching_model.py
- frontend/src/pages/ItemDetail.tsx 中显示候选的部分、frontend/src/types.ts

要求：
1. 规则初筛：在"待认领"或"核验中"的拾获帖中，按类别相同或相近、发布时间不早于寻物时间前 3 天，选出最多 10 条。
2. 模型复核：把寻物帖与这 10 条拾获帖的标题、类别、公开描述、建筑与楼层发给模型，让它为每条给出 0~100 的相似度和一句理由，只输出 JSON。
3. 发给模型的内容不得包含精确位置、联系方式、认领证据、照片；发送前用与 advice_service 相同的规则过滤手机号、邮箱、证件号。
4. 最终返回相似度最高的 3 条，每条带分数、理由、来源（model 或 rule）。模型不可用、超时、返回无法解析时，完全退回现在的规则结果，来源为 rule。
5. 前端候选卡片显示理由和来源标签："AI 匹配，仅供参考"或"规则推荐"。
6. AI 只能推荐，不能自动发起认领或通知对方。
7. 测试：模型正常时按模型分数排序；模型超时退回规则；模型返回的 id 不在候选中时忽略；发给模型的内容不含精确位置和手机号。

验收：
- ruff check、ruff format --check、npm run lint、npm run build 通过。
- 总结中列出需要我在终端运行的测试命令和浏览器验证步骤。
```

### A3 提示词评测

这个任务主要是写文档，可以在码道里让它帮你生成测试数据和统计，但**结果必须是真实跑出来的**，不能让模型编。

1. 准备 20 条描述：寻物 10 条、拾获 10 条；覆盖口语化、错别字、简称（一食堂、三教）、没有地点、没有时间等情况。
2. 对每条，人工写出"正确答案"（类型、类别、建筑、楼层）。
3. 用 AI 页逐条测试，记录模型输出，统计每个字段的准确率。
4. 改一版提示词再测一次，对比前后准确率。
5. 整理成 `docs/提示词评测.md`：测试集、两版提示词、两轮结果、改了什么、为什么。

---

## 六、和其他人的分工边界

- **地图页**（`MapView.tsx`、`components/CampusMap/` 下除 AI 推荐层以外的文件）正在由队长做 X3 手机布局改造，这段时间**不要改这些文件**，否则合并时会冲突。
- AI 推荐层 `AIRecommendLayer.tsx` 属于你，但改之前先和队长确认 X3 是否已经合并。
- 数据库结构如果要改，必须新建 Alembic 迁移，并在群里说一声，避免两边同时加迁移导致版本冲突。

---

## 七、留存证据

比赛要提交"码道使用证明"，占 25 分。每个码道会话都要：

1. 在 `码道证据` 文件夹里建子文件夹，命名如"A1-接入真实模型"。
2. 导出整段对话存成 Markdown 放进去。
3. 截图：你发的提示词；码道停下确认需求和设计的画面；最终总结；浏览器里"实时模型"来源的结果。
4. 码道出错、你指出、它修正的过程也要保留，这就是"排错过程记录"。

截图里不能出现密钥和 `.env` 内容。

---

## 八、遇到问题

- 码道总结发到群里或发给队长，由架构那边核对后再提交。
- 测试失败时，把终端里完整的报错贴给码道，不要只说"不对，再改改"。
- 模型调用失败时，后端日志里会有"模型调用失败，已降级"的记录，先检查 `.env` 的三项配置。

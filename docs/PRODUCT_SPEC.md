# 星枢 StarDesk — 产品规格

> 本文是《星枢 StarDesk：个人工作台完整开发提示词》（项目根目录
> `personal-workbench-development-prompt.md`）中核心决策的落地记录。
> 需求以该文档为准；本文记录已确认的实现决策与当前范围，供后续阶段与接手开发保持一致。

## 1. 产品范围

单人使用、桌面优先、兼顾手机的中文 Web 工作台。帮助个人把长期方向拆成近期计划，
把计划落实为今日行动，再通过记录和复盘不断调整。首版本地可用，不依赖账号、云端或收费服务。

**统一业务关系：** 领域模块 → 目标 → 项目 → 任务 → 活动记录 → 周期复盘。
习惯是另一种持续行动，可属于领域并关联目标；笔记和资源可关联领域/项目/目标。

## 2. 已确认的实现决策

| 决策点 | 结论 |
| --- | --- |
| 前端框架 | React 19 + TypeScript + Vite（沿用需求默认栈） |
| 路由 | React Router 7，采用 **HashRouter**（本地单页，无需服务器 SPA 回退） |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite` + `@theme inline` 映射语义 Token），CSS 变量管理主题 |
| 数据持久化 | Dexie 4（IndexedDB），业务数据唯一持久化来源 |
| 校验 | Zod 4 |
| 图标 | lucide-react |
| 日期 | 自定义 `src/lib/date.ts`（纯日历运算 + Intl 时区），date-fns 仅辅助 |
| 测试 | Vitest 5 + React Testing Library + fake-indexeddb；Playwright E2E（`npm run test:e2e`，本机 Edge） |
| 个人/演示空间 | 独立 Dexie 数据库名（`stardesk` / `stardesk-demo`），严格隔离 |
| 主题默认 | 深色（dark / light / system，首启默认 dark） |
| 周开始日 | 默认周一（weekStartsOn = 1） |
| 时区 | 默认设备时区，读取失败回退 Asia/Shanghai |

## 3. 关键统计规则（统一实现，页面不各自写算法）

- **目标/项目自动进度** = 已完成有效叶子任务数 / 全部有效叶子任务数；已取消、已删除不计入；
  关联同一目标且该项目也属该目标时按唯一 ID 去重；父任务由子任务决定完成态；
  无有效任务显示「尚未拆解」（不显示 100%）。
- **今日计划**：`Task.plannedDate` 唯一决定某日计划任务集合；`DailyPlan` 只保存顺序与重点（最多三项）。
  已完成任务保留在分母；已取消、已删除不计入；分母为零显示「尚未安排」。
- **逾期判定**：仅「有截止日期且截止日期早于今天」的未完成任务逾期；取消/完成/删除不逾期。
- **日期口径**：纯日期用 `YYYY-MM-DD`；绝对时间用 UTC ISO。今天/周/月区间按设置 IANA 时区计算，
  绝不用 `toISOString().slice(0,10)`。本周从设置的周开始日计算。
- **习惯口径 / 专注计时口径**：见需求第六节，阶段 2 / 4 实现并配套测试。

## 4. 模块扩展约定

- `ModuleDefinition`（代码，`src/modules/registry.ts`）与 `ModuleConfig`（数据库）分离。
- 图标、颜色使用白名单映射（`ICON_MAP` / `COLOR_MAP`），用户文本不直接当类名/路径执行。
- 四个内置领域 `growth/career/hobbies/fitness` 复用统一的目标/项目/任务/笔记/活动记录。
- 普通自定义模块使用 `generic` 定义 + 新 `ModuleConfig` ID，只组合已有能力（阶段 5）。

## 5. 数据模型

字段契约见需求第八节（`src/domain/entities.ts` 为类型落地）。通用字段：
`id / createdAt / updatedAt / revision / deletedAt? / deleteBatchId?`，归档实体另含 `archivedAt?`。
枚举数据层存英文值，界面映射中文。

## 6. 首版明确后置（不提前做入口）

账号与跨设备同步、AI 计划/复盘/问答、外部日历与穿戴设备、系统通知、文件附件与富文本、
可拖拽仪表盘/表单设计器/插件市场、PWA/桌面包/原生 App、招聘抓取与自动投递。
详见需求 2.2 与 5.x 各节的「后续版本」。

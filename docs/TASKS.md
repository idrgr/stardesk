# 星枢 StarDesk — 任务清单

状态取值：未开始 / 进行中 / 已验证完成 / 已实现待验证 / 阻塞。
每个完成项附简短验证证据。

## 阶段 1：工程、设计系统和任务闭环

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| 初始化工程（Vite + React + TS） | 已验证完成 | `vite build` 通过（2020 模块） |
| 建立 docs/PRODUCT_SPEC.md、TASKS.md、HANDOFF.md | 已验证完成 | 三份文档已创建 |
| 主题 Token（深色/浅色，CSS 变量） | 已验证完成 | `src/styles/index.css`；构建产出 CSS 31KB |
| 应用框架（侧栏、顶栏、路由） | 已验证完成 | 冒烟测试渲染品牌/导航/四领域通过 |
| 数据库初始版本（ModuleConfig、Task、UserSettings、DailyPlan、meta） | 已验证完成 | `src/data/db/db.ts` version 1 |
| 模块注册表契约 + 四内置模块 + 迁移入口 | 已验证完成 | `src/modules/registry.ts`；内置模块种子化幂等 |
| 个人/演示空间隔离方式 | 已验证完成 | 独立 DB 名 `stardesk`/`stardesk-demo`（`getDb`） |
| 任务新增/编辑/完成/重新打开/软删除/基本筛选 | 已验证完成 | `src/data/tasks.test.ts` 6 用例通过 |
| 总览核心区域（真实任务） | 已验证完成 | 冒烟测试渲染「今日航线/今日节奏/领域卡」 |
| 空状态与基本手机适配 | 已验证完成 | EmptyState 组件；侧栏 <768px 抽屉化 |

**验收：** 从空白工作台创建任务 → 完成后刷新保留 → 主要页面可打开 → 构建/类型检查通过。
- ✅ `tsc --noEmit` 通过
- ✅ `vite build` 通过
- ✅ `vitest run` 22 用例通过（日期 9、规则 5、任务仓储 6、应用冒烟 2）
- ✅ 开发服务器可启动并返回页面

## 阶段 2：统一行动系统

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| 目标实体与仓储 | 已验证完成 | `repositories/goals.ts`；`relations.test.ts` |
| 项目实体与仓储（改目标同步任务） | 已验证完成 | `repositories/projects.ts`；改目标同步任务测试通过 |
| 任务继承项目目标、子任务 | 已验证完成 | `repositories/tasks.ts`；`relations.test.ts` 父子状态/级联删除 |
| 今日计划 + 最多三项重点 | 已验证完成 | `repositories/dailyplan.ts`；三项上限/改期清理测试 |
| 习惯、频率版本、暂停、打卡唯一 | 已验证完成 | `domain/habits.ts` + `repositories/habits.ts`；`habits.test.ts` |
| 简单日程（周 + 日列表） | 已验证完成 | `ScheduleView.tsx` |
| 统一统计与日期工具 | 已验证完成 | `domain/rules.ts`（目标进度去重/叶子计权）、`lib/date.ts` |
| 任务详情抽屉 | 已验证完成 | `TaskDetailDrawer.tsx` |
| 批量操作（完成/改期/归档/删除） | 已验证完成 | `TasksView.tsx` 选择模式 + 批量栏 |
| 数据库 v1→v2 增量迁移 | 已验证完成 | `db.ts` version 2（goals/projects/habits/habitCheckins） |

**验收：** 目标→项目→任务→今日执行流程贯通；自动进度无重复计算；打卡唯一；跨天/周边界正确。
- ✅ `vitest run` 60 用例通过（新增：目标进度 9、习惯口径 8、习惯仓储 7、关联 6）
- ✅ `tsc --noEmit` 通过、`vite build` 通过

## 阶段 3：四个领域与知识库

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| 活动记录（learning/hobby/workout 类型化 details） | 已验证完成 | `repositories/activities.ts`；`phase3.test.ts` |
| 四个领域概览（个人提升/职业规划/兴趣爱好/运动健身） | 已验证完成 | `features/domains/*`；`domains.test.tsx` 4 用例 |
| 职业技能自评（1-5 级 + 差距 + 关联学习项目） | 已验证完成 | `repositories/assessments.ts`（skillGap 下限 0） |
| 可选体重记录（同模块同日唯一，更新流程） | 已验证完成 | `upsertBodyMeasurement`；唯一约束测试 |
| 笔记、资源及关联（Markdown 预览/安全链接） | 已验证完成 | `repositories/notes.ts`、`resources.ts`、`KnowledgePage.tsx` |
| 领域摘要与首页真实汇总 | 已验证完成 | 首页接入今日习惯/进行中目标/最近活动 |
| 数据库 v2→v3 增量迁移 | 已验证完成 | `db.ts` version 3 |

**验收：** 四领域完成各自示例流程；同一笔记录在不同页面显示一致；无四套重复数据。
- ✅ 四领域复用统一 goal/project/task/note/activity，无重复表
- ✅ 活动记录在领域页与首页「最近活动」读同一 `activityLogs` 表
- ✅ `vitest run` 69 用例通过；`tsc --noEmit`、`vite build` 通过

## 阶段 4：日常效率与复盘

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| 全局搜索（任务/笔记/资源/目标/项目） | 已验证完成 | `SearchPalette.tsx` 搜索全实体并打开详情 |
| 专注计时（运行片段模型、暂停/继续/结束/放弃） | 已验证完成 | `domain/focus.ts` + `repositories/focus.ts` + `FocusPanel.tsx` |
| 待确认会话与刷新恢复 | 已验证完成 | `isExpired` + 到点进入待确认；会话存库可恢复 |
| 防重复结束/防重复转活动 | 已验证完成 | `completeFocus` 幂等；`findActivityByFocusSession` 防重 |
| 周/月复盘 + 统计快照 + 行动转换 | 已验证完成 | `domain/reviews.ts` + `repositories/reviews.ts` + `ReviewsPage.tsx` |
| 真实趋势图（7/30 天） | 已验证完成 | `TrendChart.tsx`（Recharts，含文字摘要） |
| 数据库 v3→v4 增量迁移 | 已验证完成 | `db.ts` version 4（focusSessions、reviews） |

**验收：** 搜索打开详情；专注结束不重复写记录；复盘行动只创建一次；快照不被历史编辑静默修改。
- ✅ `focus.test.ts` + `focus-reviews.test.ts`（片段封顶、唯一活动会话、幂等结束、行动防重）
- ✅ `vitest run` 79 用例通过；`tsc --noEmit`、`vite build` 通过

## 阶段 5：模块扩展与数据可靠性

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| 模块中心（创建/改名/图标/颜色/顺序/启停/归档） | 已验证完成 | `ModuleCenterPage.tsx` + `module.test.ts`（旅行计划改名不丢数据） |
| 首页组件显示与顺序设置 | 已验证完成 | `SettingsPage.tsx` 首页组件开关 |
| JSON 导出/恢复（版本化 + 校验 + 事务替换） | 已验证完成 | `backup/backup.ts` + `backup.test.ts`（往返一致 + 损坏拒绝） |
| 回收站及恢复 | 已验证完成 | `SettingsPage.tsx` 回收站（任务恢复） |
| 多标签页冲突检测（revision） | 已验证完成 | `updateTask` expectedRevision + `relations.test.ts` 陈旧版本拒绝 |
| 正式/演示空间分离 | 已验证完成 | `data/demo/seed.ts` + 首次启动选择 + 演示标识 + 独立 DB |
| 设置页（昵称/主题/密度/时区/周开始日/专注偏好） | 已验证完成 | `SettingsPage.tsx` |

**验收：** 旅行计划模块立即可用；改名不丢数据；导出恢复一致；损坏导入不改旧数据。
- ✅ `module.test.ts`（旅行计划 + 改名）、`backup.test.ts`（往返 + 损坏拒绝 + 原数据不变）
- ✅ `vitest run` 84 用例通过；`tsc --noEmit`、`vite build` 通过

## 阶段 6：视觉打磨、综合验证与交付

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| 路由拆包（React.lazy） | 已验证完成 | 构建产出按路由分包（Dashboard 365KB 独立加载，主包 417KB，无 >500KB 告警） |
| 首页「本周专注」接入真实专注时长 | 已验证完成 | `DashboardPage.tsx` 读取已完成 FocusSession 周统计 |
| 统一卡片/表单/图表/弹窗/交互状态 | 已验证完成 | 设计 Token + 语义组件贯穿；深浅主题自适应 |
| 键盘焦点 / 减少动效 / Esc 关闭弹窗 | 已验证完成 | `Dialog/Drawer` 焦点限制 + `prefers-reduced-motion` 全局处理 |
| 完整 README 与交接文档 | 已验证完成 | `README.md`、`docs/*` 更新到最终状态 |

**验收：** 全部关键流程真实运行，检查结果分类清楚，已有数据继续可用，交付可启动应用。
- ✅ `tsc --noEmit` 通过、`vite build` 通过（路由拆包）
- ✅ `vitest run` 84 用例通过
- ✅ 数据库 v1→v4 增量迁移完整，无删库
- ⚠️ 真实浏览器端到端（Playwright）— **V1.1.0 已接入**：Edge 28 + WebKit iPad 19（见 `feat/ipad-pwa` / main）

## V1.1.0 — iPad PWA 正式版（2026-09-24）

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| PWA manifest + SW + 图标 | 已验证完成 | Vitest `src/pwa/`；`npm run build` |
| iPad 布局 / Safe Area / 触控 | 已验证完成 | E2E `08`；CSS `index.css` |
| GitHub Pages HTTPS | 已验证完成 | `.github/workflows/deploy-pages.yml`；生产 URL smoke |
| 后台恢复触控（fix/ipad-resume-touch） | 已验证完成 | Vitest `app-resume.test.ts`；E2E `10`；**真实 iPad 用户验收** |
| Vitest 全量 | 已验证完成 | **115** 用例 |
| Playwright 全量 | 已验证完成 | **47** 用例（Edge 28 + WebKit 19） |
| 真实 iPad 部分清单 | 已实现待验证 | `docs/IPAD_ACCEPTANCE_CHECKLIST.md`（JSON/断网/键盘等未全勾） |

**V1.1.0 正式发布** — 详见 `docs/V1_1_RELEASE_REPORT.md`。

## feat/ipad-pwa（已合并 main @ v1.1.0）

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| vite-plugin-pwa + manifest + SW | 已验证完成 | `vite.config.ts`；Vitest `src/pwa/build-artifacts.test.ts` |
| PWA 图标 192/512 + apple-touch-icon | 已验证完成 | `public/*.png`；`npm run icons` |
| iPad 布局 lg 断点 / Safe Area / 触控 | 已验证完成 | `AppShell` / `index.css`；E2E `08` |
| 安装说明 + 更新提示 + 数据说明 | 已验证完成 | `InstallStarDeskSection` / `PwaUpdateNotice` |
| epoch Safari 补检轮询 | 已验证完成 | `epoch.ts` + Vitest |
| WebKit iPad E2E | 已验证完成 | `e2e/08` + `e2e/10` |
| 真实 iPad：PWA + 触控恢复 | 已验证完成 | 用户实机；清单顶部记录 |

详见 `docs/IPAD_PWA_DELIVERY_REPORT.md`。

## V1 Final QA & Closeout（2026-09-24）

| 任务 | 状态 | 验证证据 |
| --- | --- | --- |
| 专注结束「显式转为领域活动」UI | 已验证完成 | `FocusPanel` + `ConvertToActivityDialog`；E2E `02`；`epoch-focus.test.ts` |
| dataEpoch 跨标签页失效通知 | 已验证完成 | `epoch.ts` + `EpochNotice`；E2E `05`；写入守卫单测 |
| Playwright 关键流程 E2E | 已验证完成 | `e2e/01`–`07`，**28/28** 通过 |
| 多断点 360–1920 / 主题 / a11y smoke | 已验证完成 | `e2e/06` + `e2e-evidence/*.png` |
| 约 1000 条负载浏览器交互 | 已验证完成 | `e2e/07` + `e2e-evidence/load-data-report.json` |
| Vitest 全量 | 已验证完成 | **107** 用例通过 |
| 生产构建 | 已验证完成 | `npm run build` 通过 |

**V1 正式完成** — 详见 `docs/V1_FINAL_DELIVERY_REPORT.md`。

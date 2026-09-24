# 星枢 StarDesk — 交接文档

最后更新：2026-09-24（**V1 Final QA & Closeout 完成**）

## 当前状态

- **版本：** StarDesk **V1 正式完成**（见 `docs/V1_FINAL_DELIVERY_REPORT.md`）。
- **可运行状态：** 完整个人工作台——总览、行动中心、四领域、知识库、搜索、专注、复盘、模块中心、备份恢复、回收站、演示空间、设置。
- **浏览器验收：** Playwright **28/28** 通过（Microsoft Edge）；多断点截图在 `e2e-evidence/`。

## 技术栈与命令

- React 19.3、TypeScript 7.0、Vite 8.3、React Router 7（HashRouter）、Tailwind CSS 4.3、
  Dexie 4.4、Zod 4.6、Vitest 5、Playwright 1.63（`channel: 'msedge'`）。
- 命令：
  - `npm run dev` / `npm run build` / `npm run preview`
  - `npm run test`（Vitest，当前 **107** 用例）
  - `npm run test:e2e`（Playwright，**28** 用例）
  - `npm run typecheck`

## 关键文件

| 文件 | 作用 |
| --- | --- |
| `src/features/focus/FocusPanel.tsx` | 专注 UI + 结束转领域记录入口 |
| `src/features/focus/ConvertToActivityDialog.tsx` | 显式转活动表单（防重复） |
| `src/data/repositories/activities.ts` | `convertFocusToActivity` 幂等 + `projectId` |
| `src/data/db/epoch.ts` | dataEpoch 广播、写入守卫、`StaleDataError` |
| `src/components/shared/EpochNotice.tsx` | 跨标签页恢复后的 UI 提示 |
| `src/data/backup/backup.ts` | 导出/校验/导入 + `renewDataEpoch` |
| `e2e/helpers.ts` | E2E 启动、窄屏导航、IndexedDB 读取 |
| `playwright.config.ts` | 端口 5199、Edge、webServer |

## 数据库与备份版本

- Dexie 数据库版本：**5**（v4 表结构 + v5 `activityLogs` 上 `&sourceFocusSessionId` 唯一索引）。
- 备份：`exportFormatVersion = 1`，`schemaVersion = 5`；恢复后生成新 `dataEpoch` 并广播。

## 已执行检查（2026-09-24 Closeout）

| 检查 | 结果 |
| --- | --- |
| `tsc --noEmit` | ✅ |
| `npm run build` | ✅ |
| `vitest run` | ✅ 107 通过 |
| `playwright test` | ✅ 28 通过 |
| `npm run lint` | ⚠️ eslint 未安装 |
| git diff | ⚠️ 非 git 仓库 |

## 已知问题

- ESLint 脚本无工具链；项目目录未初始化 git。
- Playwright 依赖本机 Edge；端口 5199 冲突时需释放或改配置。

## 需保持的约束

- 业务数据只存 IndexedDB；localStorage 仅 UI 偏好与 epoch 回退键。
- 统计与规则在 `src/domain/*`；页面不重复写算法。
- 新增表/字段走 Dexie 版本递增迁移，禁止删库。
- 不新增登录/云服务；文案简体中文。

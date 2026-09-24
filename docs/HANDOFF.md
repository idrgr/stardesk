# 星枢 StarDesk — 交接文档

最后更新：2026-09-24（**V1.1.0 — iPad PWA 正式版**）

## 当前状态

- **main @ v1.1.0：** iPad / 可安装 PWA、GitHub Pages 正式部署、触控恢复修复（见 `docs/V1_1_RELEASE_REPORT.md`）。
- **main @ v1.0.0（tag 保留）：** V1 桌面稳定基线（`docs/V1_FINAL_DELIVERY_REPORT.md`）。
- **feat/ipad-pwa：** 已合并进 main；后续功能开发请从 main 开新分支。
- **浏览器自动化：** Playwright **47** 用例（Edge **28** + WebKit iPad **19**）；截图 `e2e-evidence/`（可选，非发布必需）。
- **真实 iPad：** 用户已验证 PWA 安装、standalone 启动、后台恢复后触控；详见 `docs/IPAD_ACCEPTANCE_CHECKLIST.md`。

## 技术栈与命令

- React 19.3、TypeScript 7.0、Vite 8.3、React Router 7（HashRouter）、Tailwind CSS 4.3、
  Dexie 4.4、Zod 4.6、Vitest 5、Playwright 1.63（`channel: 'msedge'`）、vite-plugin-pwa 1.3。
- 命令：
  - `npm run dev` / `npm run dev:host` / `npm run build` / `npm run build:pages` / `npm run preview:pages`
  - `npm run test`（Vitest）
  - `npm run test:e2e`（Playwright）
  - `npm run typecheck`

## 关键文件

| 文件 | 作用 |
| --- | --- |
| `src/lib/app-resume.ts` | PWA 从后台恢复：清交互锁、关闭短暂 overlay |
| `src/lib/touch-debug.ts` | `?debugTouch=1` 触控诊断 |
| `src/features/focus/FocusPanel.tsx` | 专注 UI + 结束转领域记录入口 |
| `src/data/db/epoch.ts` | dataEpoch 广播、写入守卫 |
| `src/components/shared/EpochNotice.tsx` | 跨标签页恢复后的 UI 提示 |
| `src/data/backup/backup.ts` | 导出/校验/导入 + `renewDataEpoch` |
| `.github/workflows/deploy-pages.yml` | GitHub Pages（**push `main`** + workflow_dispatch） |
| `e2e/helpers.ts` | E2E 启动、窄屏导航 |
| `playwright.config.ts` | 端口 5199、Edge + WebKit iPad 项目 |

## 数据库与备份版本

- Dexie 数据库版本：**5**（与 V1 相同；v1.1.0 无 schema migration）。
- 备份：`exportFormatVersion = 1`，`schemaVersion = 5`。

## 发布前 Gates（v1.1.0 记录）

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | ✅ |
| `npm run build` / `build:pages` | ✅ |
| `npm run test`（Vitest） | ✅ **115** 用例（22 文件） |
| `npm run test:e2e` | ✅ **47** 通过（Edge 28 + WebKit 19） |
| `npm run lint` | ⚠️ ESLint 未安装，**未**作为发布 gate |
| `git diff --check` | ✅ 无冲突标记 |

## 已知限制

- 数据 **local-first**；Windows 与 iPad 不自动同步；删除 Web App / 清站点数据会丢数据，需 JSON 导出。
- ESLint 脚本无工具链。
- Playwright Edge 依赖本机 Microsoft Edge；端口 5199 冲突时需释放或改配置。
- 部分 iPad 清单项（JSON 恢复、断网冷启动、PWA 更新提示、外接键盘等）仍 **未实机验证**。

## 需保持的约束

- 业务数据只存 IndexedDB；localStorage 仅 UI 偏好与 epoch 回退键。
- 统计与规则在 `src/domain/*`。
- 新增表/字段走 Dexie 版本递增迁移，禁止删库。
- 不新增登录/云服务（除非新产品决策）；文案简体中文。

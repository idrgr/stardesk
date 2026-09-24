# 星枢 StarDesk

一个单人使用、桌面优先、兼顾手机与 **iPad PWA** 的中文个人工作台。帮助你：
把长期方向拆成近期计划，把计划落实为今日行动，再通过记录和复盘不断调整。

深色未来感界面，数据保存在你自己的浏览器里，不登录、不上传、不收费。

## 功能

- **总览首页**：今日航线（最多三项重点）、今日节奏、四个指标、领域概览、投入趋势、最近活动。
- **行动中心**：任务（子任务/优先级/计划日期/筛选/看板式列表/批量操作）、目标（自动/手动进度）、项目、习惯（频率/暂停/连续次数）、日程（周/日）。
- **四个领域**：个人提升、职业规划、兴趣爱好、运动健身，共用统一的数据。
- **知识库**：笔记（Markdown 预览）、资源（链接收藏、待看/已看）。
- **专注计时**：环形计时器，暂停/继续/结束/放弃，刷新可恢复。
- **周期复盘**：周/月复盘，统计快照，下一周期行动转任务。
- **模块中心**：创建自己的模块（如「旅行计划」），改名、换图标颜色、排序、启停。
- **设置与数据**：主题/密度/时区/周开始日，JSON 备份导出与完整恢复，回收站。
- **演示空间**：与个人空间隔离的示例数据，可随时重置。

## 环境要求

- Node.js 18+（开发时使用 Node 24）
- npm（或 pnpm）
- 现代浏览器（Chrome / Edge / Firefox / Safari）

## 安装与启动

```bash
npm install      # 安装依赖
npm run dev      # 启动开发版（默认 http://localhost:5173）
npm run dev:host # 监听 0.0.0.0，供 iPad/手机在同一局域网访问
```

生产构建与预览：

```bash
npm run build    # 类型检查 + 生产构建（输出到 dist/）
npm run preview  # 预览生产构建
```

## 测试

```bash
npm run test         # 运行单元/组件测试（Vitest）
npm run test:e2e     # Playwright：Edge 回归 + WebKit iPad 模拟（44 用例）
npm run typecheck    # 仅类型检查
npm run icons        # 从 favicon.svg 再生 PWA PNG 图标
```

## PWA 与 iPad

- 生产构建集成 **vite-plugin-pwa**：`manifest.webmanifest`、`sw.js`（预缓存 app shell，**不**缓存 IndexedDB 数据）。
- 「添加到主屏幕」需 **HTTPS** 安全上下文（开发机 localhost 除外）；局域网 HTTP 主要用于布局与功能调试。
- 数据仍保存在当前浏览器 / Web App 的 **IndexedDB** 中，不会自动 iCloud 备份；请定期 JSON 导出。
- 实机验收清单：`docs/IPAD_ACCEPTANCE_CHECKLIST.md`；分支交付说明：`docs/IPAD_PWA_DELIVERY_REPORT.md`。

### GitHub Pages（iPad HTTPS 验收）

仓库名假设为 **`stardesk`**，Project Pages 地址：

`https://<GitHub用户名>.github.io/stardesk/#/dashboard`

1. 在 GitHub：**Settings → Pages → Build and deployment → Source → GitHub Actions**
2. 推送 `feat/ipad-pwa` 后打开 **Actions → Deploy StarDesk to GitHub Pages**
3. 生产构建设置 `GITHUB_PAGES=true`，Vite `base` 为 `/stardesk/`（本地 `npm run dev` 仍为 `/`）
4. 本地子路径 smoke：`npm run build:pages` → `npm run preview:pages` → 打开 `http://localhost:4173/stardesk/#/`

未 merge `main`、未打 v1.1.0；实机清单见 `docs/IPAD_ACCEPTANCE_CHECKLIST.md`。

## 数据存在哪里

数据保存在**当前浏览器的 IndexedDB** 中（数据库名 `stardesk`，演示空间为 `stardesk-demo`），
仅本地存储，不会上传到任何服务器。

> 更换浏览器、删除 Web App、清除网站数据或访问地址前，请先在「设置与数据」里导出备份，再在新环境恢复。

## 首次使用

首次启动可选择「创建我的空白工作台」或「进入演示空间」。演示空间带有一份连贯的示例数据，
并始终显示明显的「演示空间」标识；个人空间不会被自动填入示例数据。

## 备份、恢复与迁移

在「设置与数据 → 数据管理」中：

- **导出备份（JSON）**：下载包含全部业务数据、模块配置、习惯历史、归档与回收站、设置的备份文件。
- **恢复备份**：选择备份文件后会先校验并展示预览，确认后完整替换当前数据；任何损坏/重复/悬空引用都会被拒绝，原有数据不受影响。

## 技术栈

React + TypeScript + Vite · React Router（HashRouter）· Tailwind CSS 4 · Dexie（IndexedDB）· Zod · lucide-react · Recharts · react-markdown · Vitest

## 首版限制

- 无账号、无跨设备同步、无云存储（数据只在本浏览器 / Web App 本地环境）。
- 尚未接入 AI、外部日历、可穿戴设备与系统通知。
- 不支持文件附件、图片上传与复杂富文本。
- 无原生 iOS App；iPad 通过 **PWA（添加到主屏幕）** 使用，实机验收见 `docs/IPAD_ACCEPTANCE_CHECKLIST.md`。

## 目录结构

```
src/
  app/              应用入口、路由、全局 Provider
  components/       通用 UI、布局、共享组件
  features/         dashboard/actions/domains/knowledge/focus/reviews/...
  modules/          模块注册表（内置 + 通用模板）
  domain/           实体类型、枚举、校验、业务规则（纯函数）
  data/             Dexie 数据库、仓储、迁移、备份、演示种子
  lib/              日期、ID、格式化等工具
  styles/           设计 Token 与全局样式
docs/               PRODUCT_SPEC / TASKS / HANDOFF
```

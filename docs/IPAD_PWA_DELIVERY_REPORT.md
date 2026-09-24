# StarDesk iPad PWA 交付报告

**分支**：`feat/ipad-pwa`（基于 `main` @ `d752149` / tag `v1.0.0`）  
**日期**：2026-09-24  
**说明**：WebKit 自动化 ≠ 真实 iPad Safari 实机验证。实机请使用 [IPAD_ACCEPTANCE_CHECKLIST.md](./IPAD_ACCEPTANCE_CHECKLIST.md)。

---

## 1. 已实现且自动验证

| 能力 | 证据 |
|------|------|
| **vite-plugin-pwa** `1.3.0`（Vite 8.3 / Node 24） | `package.json` / `package-lock.json` |
| Web App Manifest（name、standalone、zh-CN、orientation: any、192/512 图标） | `vite.config.ts`；Vitest `src/pwa/build-artifacts.test.ts` |
| Service Worker + Workbox 预缓存 app shell / JS / CSS / 静态资源 | `npm run build` 产出 `dist/sw.js`；同上 Vitest |
| 本地 PNG 图标 + `apple-touch-icon` | `public/pwa-192.png`、`pwa-512.png`、`apple-touch-icon.png`；`npm run icons` |
| 更新提示（prompt，不自动 reload） | `PwaUpdateNotice` + `registerType: 'prompt'` |
| iPad 布局：&lt;1024 抽屉、≥1024 侧栏 | `AppShell` `lg:` 断点；E2E `08` 横竖屏 |
| Safe Area / 触控目标 / 非 hover 操作可见 | `index.css`；E2E Safe Area 用例 |
| 中文 composition（搜索 Enter） | `SearchPalette`；E2E composition 用例 |
| dataEpoch Safari 补检 | `refreshEpochStaleFromHints` + 20s 轮询；Vitest epoch 用例 |
| 设置页安装说明 + 数据/local 说明 | `InstallStarDeskSection`；E2E |
| 抽屉导航点击后关闭（避免遮罩挡操作） | `Sidebar.onNavigate` |
| 桌面 V1 回归 | Edge E2E 28 + WebKit iPad 16 = **44** 通过 |

### 执行的命令与结果

```text
npx tsc --noEmit          → 通过
npm run build             → 通过（PWA precache 28 entries）
npx vitest run            → 21 files, 112 tests 通过
npm run test:e2e          → 44 passed（~4.8 min）
git diff --check          → 无冲突标记
npm run lint              → 未执行（项目仍无 ESLint 依赖）
```

---

## 2. 已实现但需要真实 iPad 验证

- Safari **添加到主屏幕** 与 standalone 图标观感  
- HTTPS 环境下的 **Service Worker 注册与离线再次打开**（自动化在 dev server 不测 SW 注册；生产 SW 文件由 Vitest 验证）  
- iPadOS **文件 app** 下 JSON 导出/导入路径与文案  
- 切后台、断网、外接 Magic Keyboard 的长时体验  
- PWA **新版本**提示后手动「重新加载」  

→ 见 [IPAD_ACCEPTANCE_CHECKLIST.md](./IPAD_ACCEPTANCE_CHECKLIST.md)。

---

## 3. 未实现（本轮后置）

- 账号同步、云备份、iCloud 声明或后台同步  
- Capacitor / Electron / RN 原生壳  
- 自动部署到公网 HTTPS（仅文档说明部署方式）  
- 真实 iPad Safari 的 Playwright 驱动（使用 WebKit + viewport 模拟）

---

## 4. 已知限制

- **安全上下文**：PWA 安装与 SW 需 HTTPS（或 localhost）；iPad 局域网测试用 `npm run dev:host`，完整 PWA 需 HTTPS 静态托管。  
- **数据**：仍为 IndexedDB；删除 Web App / 清除网站数据会导致丢失，需 JSON 导出。  
- **数据库**：无 schema migration（Dexie v5 未变）。  
- **ESLint**：`npm run lint` 仍不可用。  
- **v1.0.0 tag / main**：未修改；本工作仅在 `feat/ipad-pwa`。

---

## 5. iPad / 局域网访问（开发）

```bash
npm run dev:host
# 在 iPad Safari 打开 http://<电脑局域网IP>:5173/#/...
```

## 6. GitHub Pages（RC 部署）

| 项 | 值 |
|----|-----|
| Workflow | `.github/workflows/deploy-pages.yml` |
| 触发分支 | `feat/ipad-pwa`（push + `workflow_dispatch`） |
| 构建 | `GITHUB_PAGES=true` → Vite `base: '/stardesk/'` |
| manifest `start_url` / `scope` | `./`（相对 `/stardesk/`） |
| SW | `/stardesk/sw.js`（Workbox 相对子路径注册） |
| 预期 URL | `https://<GitHub用户名>.github.io/stardesk/#/dashboard` |

**Pages 设置**：Repository → Settings → Pages → Source → **GitHub Actions**。

本地子路径 smoke：`npm run build:pages` → `npm run preview:pages` → `http://127.0.0.1:4173/stardesk/#/`

区分三类场景：

1. **局域网 HTTP**：`npm run dev:host`（功能与布局；通常无法完整 PWA 安装）  
2. **GitHub Pages HTTPS**：RC 实机验收（见上表）  
3. **生产构建本地预览**：`npm run build && npm run preview --host`

---

## 7. 新增依赖

- `vite-plugin-pwa@1.3.0`（含 workbox-build / workbox-window ^7.4.1）  
- `sharp@0.34.5`（dev，仅 `scripts/generate-pwa-icons.mjs` 生成图标）

---

## 8. Migration

**无。** IndexedDB schema 与 V1 语义保持不变。

# StarDesk v1.1.0 正式发布报告

**日期：** 2026-09-24  
**结论：** **StarDesk v1.1.0 正式发布**（merge、gates、tag、push、Pages 部署见下文最终状态）

---

## 1. Release commit

| 项 | 值 |
|----|-----|
| Merge commit | `db3f6cb` — `release: StarDesk v1.1.0` |
| 方式 | `git merge --no-ff feat/ipad-pwa`（未 squash） |
| 基线 | `main` @ `d752149` / tag **`v1.0.0`**（未改动） |

## 2. v1.1.0 tag

- **Annotated tag：** `v1.1.0`
- **Message：** `StarDesk V1.1.0 - iPad PWA`

## 3. Merge 情况

- `feat/ipad-pwa` 含 PWA/iPad 功能、`fix/ipad-resume-touch` 触控恢复、发布文档与 E2E 稳定性修复。
- `feat/portfolio-module` **未**合并。
- 发布前 `feat/ipad-pwa` 额外提交：`bba8f63`（v1.1.0 文档与 Playwright 配置）。

## 4. GitHub Pages workflow

- 文件：`.github/workflows/deploy-pages.yml`
- **v1.1.0 起：** `push` 触发分支为 **`main`**（保留 `workflow_dispatch`）。
- 后续 `feat/*` push **不再**自动覆盖正式 Pages。

## 5. GitHub Pages 生产 URL

- https://idrgr.github.io/stardesk/
- https://idrgr.github.io/stardesk/#/dashboard
- `base`: `/stardesk/` · HashRouter · manifest / SW 子路径见线上 smoke

## 6–8. 自动化 Gates（main @ merge 后实测）

| Gate | 结果 |
|------|------|
| `npm run typecheck` | ✅ |
| `npm run build` | ✅（PWA precache 28 entries） |
| `npm run build:pages` | ✅ |
| `npm run test`（Vitest） | ✅ **115** 用例，**22** 文件 |
| `npm run test:e2e`（Playwright） | ✅ **47** 用例 |
| → Edge `msedge-desktop` | **28** |
| → WebKit `webkit-ipad-pwa` | **19**（`08` + `10`） |
| `git diff --check` | ✅ |
| `npm run lint` | ⚠️ ESLint 未安装，**未**作为发布 gate |

## 9. 真实 iPad 验收

用户已确认（见 `docs/IPAD_ACCEPTANCE_CHECKLIST.md` 顶部记录）：

- 真实 iPad 可用；HTTPS Pages；**添加到主屏幕 / standalone**
- **`fix/ipad-resume-touch`** 后后台/重新打开点击恢复正常

**仍未全清单实机验证：** JSON 恢复、断网冷启动、PWA 更新提示、外接 Magic Keyboard 等。

## 10. 已知限制

- Local-first IndexedDB；无跨设备同步；删 Web App / 清站点数据会丢数据 → 定期 JSON 导出。
- Dexie v5，v1.1.0 无 schema migration。
- Playwright WebKit ≠ iPadOS 原生 suspend 全覆盖。

## 11. 未完成但非阻塞

- Portfolio / AI / 云同步等新功能（刻意未纳入 v1.1.0）
- ESLint 工具链
- iPad 清单剩余未勾选项

## 12. 发布时 Git 状态

见发布完成时终端输出（`git status` / `branch -vv` / `log` / `tag -n1`）。

---

## GitHub Release 建议正文

**Title:** StarDesk v1.1.0 — iPad PWA

**Body 要点：**

**新增：** 可安装 PWA · iPad 横竖屏 · Safe Area · 触控优化 · 主屏幕图标 · Service Worker 离线壳 · PWA 更新提示 · GitHub Pages HTTPS

**修复：** iPad PWA 后台/重新打开后触控恢复（`app-resume` / transient UI dismiss）

**质量：** Vitest 115 · Playwright 47（Edge 28 + WebKit 19）· 真实 iPad：PWA + 触控恢复已验收

**限制：** 仍 local-first · 无自动同步 · 需 JSON 备份 · 部分 iPad 项未实机验证

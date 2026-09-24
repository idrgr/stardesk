# iPad PWA 恢复后点击不灵敏 — 修复报告（fix/ipad-resume-touch）

**分支：** `fix/ipad-resume-touch`（基于 `feat/ipad-pwa` @ `5ec9372`）  
**优先级：** v1.1 P0  
**日期：** 2026-09-24  

---

## 1. 是否复现 / 环境

| 环境 | 本仓库自动化能否复现 | 说明 |
|------|----------------------|------|
| Playwright WebKit（iPad Pro 11 viewport） | 可模拟 **visibility + pageshow(persisted)** 路径 | 见 `e2e/10-ipad-resume-touch.spec.ts` |
| 真实 iPad Safari 标签页 | **未在本机 CI 验证** | 需用户按验收清单 A–G |
| 真实 iPad「添加到主屏幕」standalone PWA | **未在本机 CI 验证** | iOS suspend/BFCache 行为 Playwright 无法完全等价 |

**用户反馈现象：** 从后台重新打开 standalone PWA 后，点击「不灵敏」或像被挡住。  
**代码侧假设（非设备甩锅）：** 恢复时 React 未必 remount；若移动抽屉/搜索/任务抽屉等在挂起前处于 `open`，或 body/html 上残留 inline 交互锁，会出现透明层或 `pointer-events` 仍拦截点击。

---

## 2. 代码调查结论

### 2.1 透明 overlay / 残留 DOM

- Dialog / Drawer / SearchPalette / 移动导航在 **关闭时应 unmount**（非仅 `opacity: 0`）。
- 风险在于 **BFCache / resume 后 React 状态仍认为 overlay 打开**，DOM 仍存在且 `pointer-events: auto`。
- 已为关键层增加 `data-sd-overlay` 标记（`mobile-nav`、`search`、`drawer`、`dialog`、`epoch-modal`），便于调试与 resume 扫描。

### 2.2 body / html 交互锁

- 新增 `src/lib/document-interaction.ts`：记录并清除 StarDesk 自行设置的 `overflow` / `pointer-events` / `touch-action` / `user-select` inline 锁。
- Resume 时调用 `restoreDocumentInteraction()`，不依赖全页 reload。

### 2.3 低级 touch 事件

- 应用业务代码 **未发现** 用 `touchstart` + `preventDefault` 实现普通按钮；普通交互以 `onClick` / Pointer 为主。
- 样式：为 `.sd-touch-target`、按钮、链接等增加 `touch-action: manipulation`（非全局 `touch-action: none`）。

### 2.4 未发现（本轮 grep）

- 未发现 Dialog/Drawer 在关闭后仍留 `position: fixed; inset: 0` 且 `pointer-events: auto` 的独立 bug（关闭路径为 unmount）。
- EpochNotice 在 dataEpoch stale 且用户未 dismiss 时 **有意** 阻塞交互（非 resume bug）。

---

## 3. 生命周期与防御性恢复

**入口：** `src/main.tsx` → `initAppResume()`、`initTouchDebug()`（`?debugTouch=1` 或 `localStorage stardesk.debugTouch=1`）。

**`src/lib/app-resume.ts` 在 `pageshow` / `visibilitychange`（且 `document.visibilityState === 'visible'`）时：**

1. `restoreDocumentInteraction()` — 清理 inline 锁  
2. `dismissAllTransientUi()` — 关闭注册的短暂 UI（移动 nav、搜索、快速新增、专注面板、任务表单/详情抽屉等）  
3. 可选 `epochResumeRefresher` — 刷新 stale hints（不重置全部业务状态）  
4. `pageshow.persisted === true` 时额外 **双 rAF** 再跑一轮恢复（BFCache 路径）  
5. Debug：`findSuspiciousOverlays()`、`elementFromPoint` 辅助（`touch-debug.ts`）

**原则：** 不 `location.reload()`；不每次 resume 清空用户正在编辑的正常内容（仅 dismiss **短暂** overlay 与锁）。

---

## 4. 自动化

| 类型 | 文件 | 作用 |
|------|------|------|
| Vitest | `src/lib/app-resume.test.ts` | pageshow persisted 清理锁 + dismiss；transient 注册 |
| Playwright WebKit | `e2e/10-ipad-resume-touch.spec.ts` | 抽屉/搜索/任务抽屉 → simulate resume → 仍可点击 |
| 配置 | `playwright.config.ts` | `webkit-ipad-pwa` 含 `08` + `10` |

**WebKit 结果（本地 2026-09-24）：** `npx playwright test e2e/10-ipad-resume-touch.spec.ts --project=webkit-ipad-pwa` → **3/3 通过**。`npm run build:pages` 通过。

**限制（必须写清）：** Playwright **不能**证明真实 iPadOS PWA suspend 后 WebKit 无原生问题；通过只说明 **应用侧 lifecycle cleanup 与 overlay dismiss** 在模拟恢复下仍有效。

---

## 5. 真机验收（必须由用户执行）

在 **GitHub Pages / 预览** 部署包含本分支修复的构建后，在 **真实 iPad、Add to Home Screen、standalone** 下完成：

- A–G：主屏幕打开、短/长后台、锁屏、横竖屏、开关 drawer/search/quick add/task/dialog 后再后台恢复，点击仍正常。

**在用户完成上述清单前，不得声称「真机 P0 已解决」。**

---

## 6. 调试

- URL：`?debugTouch=1`  
- 或：`localStorage.setItem('stardesk.debugTouch','1')` 后刷新  
- 记录：pageshow/pagehide/visibility/focus/blur/pointerdown/click；点击无响应时可查 `elementsFromPoint` 与 suspicious overlay 日志。

---

## 7. Git

- 仅推送分支 **`fix/ipad-resume-touch`**  
- **不要** merge `main`、**不要** tag `v1.1.0`、**不要**改 `v1.0.0`  
- Portfolio 模块开发已暂停，本修复不含 Portfolio 提交  

---

## 8. 门禁命令（修复提交前）

```bash
npm run typecheck
npm test
npx playwright test e2e/10-ipad-resume-touch.spec.ts --project=webkit-ipad-pwa
npm run build:pages
```

（完整 E2E 可选；本 P0 以 `10-ipad-resume-touch` + 单元测试为主。）

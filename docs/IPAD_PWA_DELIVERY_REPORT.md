# StarDesk iPad PWA 交付报告

**版本**：**v1.1.0**（`main`；原 RC 分支 `feat/ipad-pwa` 已合并）  
**基线**：`v1.0.0` @ `d752149`  
**日期**：2026-09-24  
**说明**：WebKit 自动化 ≠ 全部 iPad 实机项。实机记录见 [IPAD_ACCEPTANCE_CHECKLIST.md](./IPAD_ACCEPTANCE_CHECKLIST.md)。

---

## 1. 已自动验证

| 能力 | 证据 |
|------|------|
| **vite-plugin-pwa** `1.3.0` | `package.json`；Vitest `src/pwa/build-artifacts.test.ts` |
| Manifest + Service Worker + 图标 | `vite.config.ts`；`dist/sw.js` |
| 更新提示（prompt） | `PwaUpdateNotice` |
| iPad 布局 &lt;1024 抽屉、≥1024 侧栏 | `AppShell`；E2E `08` |
| Safe Area / 触控 / composition | `index.css`；E2E `08` / `10` |
| **后台恢复触控** | `src/lib/app-resume.ts`；Vitest；E2E `10` |
| Edge V1 回归 | **28** 用例 |
| WebKit iPad | **19** 用例（`08` + `10`） |
| Vitest | **115** 用例（22 文件） |

### v1.1.0 发布前 Gates（feat/ipad-pwa @ 合并前）

```text
npm run typecheck       → 通过
npm run build           → 通过（PWA precache 28 entries）
npm run build:pages     → 通过
npm run test            → 115 passed
npm run test:e2e        → 47 passed（Edge 28 + WebKit 19）
git diff --check        → 无冲突标记
npm run lint            → 未执行（ESLint 未安装，非 gate）
```

---

## 2. 真实 iPad 已验证（用户反馈）

- 真实 iPad 上可使用 StarDesk（GitHub Pages HTTPS）
- **添加到主屏幕** / standalone 启动
- **`fix/ipad-resume-touch`**：后台 / 重新打开后点击不灵敏 → **已恢复**
- Pages 部署后实机回归通过

未单独记录为通过的项（JSON 恢复、断网冷启动、PWA 更新提示、外接键盘等）仍在清单中标记为 **未验证**。

---

## 3. 尚未实机验证（非阻塞发布项）

- iPadOS **文件 App** 完整 JSON 恢复路径
- 断网后从主屏幕冷启动 shell
- PWA **新版本**提示与手动 reload 全流程
- Magic Keyboard 长时组合键
- 清单中其余未勾选日常项

---

## 4. 已知限制

- **local-first** IndexedDB；无跨设备同步；删除 Web App / 清数据会丢失，需 JSON 导出。
- Dexie **v5** 未变（v1.1.0 无 migration）。
- ESLint 未接入。
- Playwright 使用 WebKit viewport 模拟，不能替代 iPadOS suspend 内核行为。

---

## 5. GitHub Pages（v1.1.0 起）

| 项 | 值 |
|----|-----|
| Workflow | `.github/workflows/deploy-pages.yml` |
| 触发 | **`main` push** + `workflow_dispatch` |
| 生产 URL | https://idrgr.github.io/stardesk/#/dashboard |
| `base` | `/stardesk/` |

---

## 6. Migration

**无。** IndexedDB schema 与 V1 语义保持不变。

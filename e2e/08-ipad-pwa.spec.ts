import { test, expect } from '@playwright/test'
import {
  openApp,
  nav,
  tab,
  quickAddTask,
  expectNoHorizontalOverflow,
  openFocusPanel,
  todayLocal,
} from './helpers'

/**
 * iPad / PWA 布局与流程（Playwright WebKit + iPad 视口模拟）。
 * PWA manifest / SW 文件见 Vitest：src/pwa/build-artifacts.test.ts
 * Service Worker 在 dev 模式不注册；生产 SW 实机见 docs/IPAD_ACCEPTANCE_CHECKLIST.md
 */

const IPAD_VIEWPORTS = [
  { name: 'ipad-portrait-768', width: 768, height: 1024 },
  { name: 'ipad-landscape-1024', width: 1024, height: 768 },
  { name: 'ipad-pro-portrait', width: 1024, height: 1366 },
  { name: 'ipad-pro-landscape', width: 1366, height: 1024 },
  { name: 'ipad-mini-portrait', width: 744, height: 1133 },
  { name: 'ipad-mini-landscape', width: 1133, height: 744 },
]

test.describe('iPad 视口布局（WebKit 模拟）', () => {
  for (const vp of IPAD_VIEWPORTS) {
    test(`${vp.name}：总览无横向溢出`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await openApp(page)
      await expect(page.getByRole('heading', { name: '今日航线' }).first()).toBeVisible()
      await expectNoHorizontalOverflow(page)
    })
  }

  test('竖屏 768：抽屉导航与新增任务', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await openApp(page)
    await page.getByRole('banner').getByRole('button', { name: '打开导航' }).click()
    await page.getByRole('link', { name: '行动中心', exact: true }).click()
    await tab(page, '任务')
    await quickAddTask(page, 'iPad 竖屏任务')
    await expect(page.getByText('iPad 竖屏任务').first()).toBeVisible()
  })

  test('横屏 1024：侧栏可见', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await openApp(page)
    await expect(
      page.getByRole('complementary', { name: '侧栏' }).getByRole('link', { name: '总览', exact: true }),
    ).toBeVisible()
  })
})

test.describe('iPad 关键流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await openApp(page)
  })

  test('今日重点与 Cmd/Ctrl+K 搜索', async ({ page }) => {
    const today = await todayLocal(page)
    await quickAddTask(page, '重点候选', { plannedDate: today })
    await nav(page, '总览')
    await page.getByRole('button', { name: '设为今日重点' }).first().click()
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+KeyK`)
    await expect(page.getByRole('dialog', { name: '搜索' })).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('专注与转活动入口', async ({ page }) => {
    await openFocusPanel(page)
    await page.getByRole('button', { name: '25', exact: true }).click()
    await page.getByRole('button', { name: '开始专注' }).click()
    await page.getByRole('button', { name: '结束', exact: true }).click()
    await page.getByRole('button', { name: '转为领域记录' }).first().click()
    await expect(page.getByRole('dialog', { name: '转为领域记录' })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: '取消' }).click()
  })

  test('Markdown 笔记与周复盘', async ({ page }) => {
    await nav(page, '知识库')
    await page.getByRole('button', { name: '新增笔记' }).click()
    const noteDialog = page.getByRole('dialog').filter({ has: page.getByLabel('标题') })
    await noteDialog.getByLabel('标题').fill('iPad 笔记')
    await noteDialog.getByPlaceholder('用 Markdown 记录内容…').fill('## 标题\n\n内容')
    await noteDialog.getByRole('button', { name: '保存' }).click()
    await nav(page, '周期复盘')
    await expect(page.getByRole('heading', { name: '周期复盘' }).first()).toBeVisible()
  })

  test('备份导出入口', async ({ page }) => {
    await nav(page, '设置与数据')
    await page.getByRole('button', { name: '导出备份（JSON）' }).click()
    await expect(page.getByText(/备份文件已生成/)).toBeVisible({ timeout: 5000 })
  })

  test('安装说明在非 standalone 下可见', async ({ page }) => {
    await nav(page, '设置与数据')
    await expect(page.getByRole('heading', { name: /安装 StarDesk/ })).toBeVisible()
  })

  test('中文 composition 期间 Enter 不提交搜索', async ({ page }) => {
    await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+KeyK`)
    const input = page.getByRole('dialog', { name: '搜索' }).locator('input')
    await input.focus()
    await input.dispatchEvent('compositionstart')
    await input.press('Enter')
    await expect(page.getByRole('dialog', { name: '搜索' })).toBeVisible()
    await input.dispatchEvent('compositionend')
    await page.keyboard.press('Escape')
  })
})

test.describe('Safe Area 与主题', () => {
  test('standalone 样式 token 存在', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await openApp(page)
    const padding = await page.evaluate(() => {
      const el = document.querySelector('.sd-app-shell')
      return el ? getComputedStyle(el).paddingBottom : ''
    })
    expect(padding).toBeTruthy()
  })

  test('浅色主题切换', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await openApp(page)
    await page.getByRole('banner').getByRole('button', { name: /切换主题/ }).click()
    await expect(page.locator('html[data-theme="light"]')).toBeVisible({ timeout: 5000 })
  })
})

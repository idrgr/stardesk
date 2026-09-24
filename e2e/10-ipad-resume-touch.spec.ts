import { test, expect } from '@playwright/test'
import { openApp, nav, isMobileShell, quickAddTask } from './helpers'

/**
 * 模拟 visibility / pageshow 恢复路径，验证短暂 overlay 会被清理且按钮仍可点。
 * 不能替代真实 iPadOS suspend/resume 验收。
 */

test.describe('PWA resume 触控恢复（WebKit 模拟）', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 })
    await openApp(page)
  })

  async function simulateResume(page: import('@playwright/test').Page): Promise<void> {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    })
  }

  test('打开抽屉 → resume → 仍可打开快速新增', async ({ page }) => {
    if (!(await isMobileShell(page))) {
      test.skip()
    }
    await page.getByRole('banner').getByRole('button', { name: '打开导航' }).click()
    await expect(page.locator('[data-sd-overlay="mobile-nav"]')).toBeVisible()
    await simulateResume(page)
    await expect(page.locator('[data-sd-overlay="mobile-nav"]')).toHaveCount(0)
    await page.getByRole('banner').getByRole('button', { name: '快速新增' }).click()
    await expect(page.getByRole('dialog', { name: '新增任务' })).toBeVisible()
    await page.getByRole('button', { name: '取消' }).click()
  })

  test('打开搜索 → resume → 仍可点击侧栏导航', async ({ page }) => {
    if (await isMobileShell(page)) {
      await page.getByRole('banner').getByRole('button', { name: '搜索', exact: true }).click()
    } else {
      await page.keyboard.press('Control+KeyK')
    }
    await expect(page.getByRole('dialog', { name: '搜索' })).toBeVisible()
    await simulateResume(page)
    await expect(page.locator('[data-sd-overlay="search"]')).toHaveCount(0)
    if (await isMobileShell(page)) {
      await page.getByRole('banner').getByRole('button', { name: '打开导航' }).click()
      await page.getByRole('link', { name: '行动中心', exact: true }).click()
    } else {
      await nav(page, '行动中心')
    }
    await expect(page.getByRole('button', { name: '任务', exact: true }).first()).toBeVisible()
  })

  test('行动中心任务详情 → resume → 仍可新增任务', async ({ page }) => {
    await nav(page, '行动中心')
    await quickAddTask(page, 'resume 测试任务')
    await page.getByText('resume 测试任务').first().click()
    await expect(page.locator('[data-sd-overlay="drawer"]')).toBeVisible()
    await simulateResume(page)
    await expect(page.locator('[data-sd-overlay="drawer"]')).toHaveCount(0)
    await page.getByRole('banner').getByRole('button', { name: '快速新增' }).click()
    await expect(page.getByRole('dialog', { name: '新增任务' })).toBeVisible()
  })
})

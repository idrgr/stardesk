import { test, expect } from '@playwright/test'
import { openApp, quickAddTask, nav, tab, todayLocal, expectNoHorizontalOverflow, waitForShell } from './helpers'

/**
 * 断言首页指标卡的数值。
 * 使用 web-first 断言自动重试：liveQuery 首次渲染时数据尚未载入，
 * 直接用 innerText() 读会拿到初始空值。
 */
async function expectMetric(page: import('@playwright/test').Page, testId: string, value: string) {
  await expect(page.getByTestId(`${testId}-value`)).toHaveText(value)
}

test.describe('核心闭环：目标 → 项目 → 任务 → 今日执行', () => {
  test('空白工作台创建目标/项目/任务，设为今日重点并完成，首页与领域同步', async ({ page }) => {
    await openApp(page)
    const today = await todayLocal(page)

    // --- 目标 ---
    await nav(page, '行动中心')
    await tab(page, '目标')
    await page.getByRole('button', { name: '新增目标' }).first().click()
    let dialog = page.getByRole('dialog', { name: '新增目标' })
    await dialog.getByLabel('标题').fill('提升专业能力')
    await dialog.getByLabel('所属领域').selectOption({ label: '个人提升' })
    await dialog.getByLabel('状态').selectOption({ label: '进行中' })
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('提升专业能力').first()).toBeVisible()

    // --- 项目（关联该目标） ---
    await tab(page, '项目')
    await page.getByRole('button', { name: '新增项目' }).first().click()
    dialog = page.getByRole('dialog', { name: '新增项目' })
    await dialog.getByLabel('名称').fill('读书计划')
    await dialog.getByLabel('所属领域').selectOption({ label: '个人提升' })
    await dialog.getByLabel('关联目标').selectOption({ label: '提升专业能力' })
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('读书计划').first()).toBeVisible()

    // --- 任务（计划日期=今天，归入个人提升） ---
    await nav(page, '总览')
    await quickAddTask(page, '读完第一章', { plannedDate: today, module: '个人提升' })

    // 任务已落库
    await nav(page, '行动中心')
    await tab(page, '任务')
    await expect(page.getByText('读完第一章').first()).toBeVisible()

    // --- 首页：指标 0/1 ---
    await nav(page, '总览')
    await expect(page.getByText('读完第一章').first()).toBeVisible()
    await expectMetric(page, 'metric-today-plan', '0 / 1')

    // --- 设为今日重点 ---
    await page.getByText('读完第一章').first().hover()
    await page.getByRole('button', { name: '设为今日重点' }).first().click()
    await expect(page.getByText('今日重点')).toBeVisible()

    // --- 完成：已完成任务仍保留在当日计划分母中（1 / 1） ---
    await page.getByRole('checkbox', { name: '标记为完成' }).first().click()
    await expect(page.getByRole('checkbox', { name: '标记为未完成' }).first()).toBeVisible()
    await expectMetric(page, 'metric-today-plan', '1 / 1')

    // --- 领域页同步 ---
    await nav(page, '个人提升')
    await expect(page.getByText('读完第一章').first()).toBeVisible()

    await expectNoHorizontalOverflow(page)
  })

  test('刷新后数据、主题与导航状态保留', async ({ page }) => {
    await openApp(page)
    await quickAddTask(page, '持久化任务')

    // 切换主题到浅色（写入数据库后由 effect 应用，需可重试断言）
    await page.getByRole('button', { name: /切换主题/ }).click()
    const themeOf = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    await expect.poll(themeOf).toBe('light')

    await page.reload()
    await waitForShell(page)
    await expect(page.getByRole('heading', { name: '今日航线' })).toBeVisible()

    // 数据保留
    await nav(page, '行动中心')
    await tab(page, '任务')
    await expect(page.getByText('持久化任务').first()).toBeVisible()

    // 主题保留（含 localStorage 预加载）
    await expect.poll(themeOf).toBe('light')
    expect(await page.evaluate(() => localStorage.getItem('stardesk.theme'))).toBe('light')
  })

  test('同一任务在首页、项目页与搜索结果中保持一致更新', async ({ page }) => {
    await openApp(page)
    const today = await todayLocal(page)

    await nav(page, '行动中心')
    await tab(page, '项目')
    await page.getByRole('button', { name: '新增项目' }).first().click()
    const projectDialog = page.getByRole('dialog', { name: '新增项目' })
    await projectDialog.getByLabel('名称').fill('一致性项目')
    await projectDialog.getByLabel('所属领域').selectOption({ label: '个人提升' })
    await projectDialog.getByRole('button', { name: '保存' }).click()
    await expect(projectDialog).toBeHidden()

    await quickAddTask(page, '一致性任务', { plannedDate: today, module: '个人提升' })

    // 在任务页打开详情 → 编辑
    await nav(page, '行动中心')
    await tab(page, '任务')
    await page.getByText('一致性任务').first().click()
    const drawer = page.getByRole('dialog', { name: '任务详情' })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: '编辑' }).click()
    const editDialog = page.getByRole('dialog', { name: '编辑任务' })
    await editDialog.getByLabel('标题').fill('一致性任务（已更新）')
    await editDialog.getByLabel('所属项目').selectOption({ label: '一致性项目' })
    await editDialog.getByRole('button', { name: '保存' }).click()
    await expect(editDialog).toBeHidden()

    // 首页一致
    await nav(page, '总览')
    await expect(page.getByText('一致性任务（已更新）').first()).toBeVisible()

    // 搜索一致
    await page.keyboard.press('Control+K')
    const search = page.getByRole('dialog', { name: '搜索' })
    await expect(search).toBeVisible()
    await search.getByRole('textbox').fill('一致性任务')
    await expect(search.getByText('一致性任务（已更新）').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(search).toBeHidden()

    // 领域页一致
    await nav(page, '个人提升')
    await expect(page.getByText('一致性任务（已更新）').first()).toBeVisible()
  })
})

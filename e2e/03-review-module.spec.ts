import { test, expect } from '@playwright/test'
import { openApp, nav, readStore, quickAddTask, tab } from './helpers'

test.describe('周复盘与行动转换', () => {
  test('下一周期行动转换为任务，重复点击不重复创建', async ({ page }) => {
    await openApp(page)

    await nav(page, '周期复盘')
    await expect(page.getByRole('heading', { name: '周期复盘' })).toBeVisible()

    // 添加一条下一周期行动
    await page.getByRole('button', { name: '添加' }).click()
    await page.getByLabel('行动标题').fill('每天练习 30 分钟')
    await page.getByLabel('领域').selectOption({ label: '个人提升' })

    // 转换为任务
    await page.getByRole('button', { name: '转换为任务' }).click()
    await expect(page.getByText('已创建 1 项任务')).toBeVisible()

    let tasks = await readStore(page, 'tasks')
    expect(tasks.filter((t) => t.title === '每天练习 30 分钟')).toHaveLength(1)

    // 重复点击：不重复创建
    await page.getByRole('button', { name: '转换为任务' }).click()
    await expect(page.getByText('这些行动已转换过，未重复创建')).toBeVisible()
    tasks = await readStore(page, 'tasks')
    expect(tasks.filter((t) => t.title === '每天练习 30 分钟')).toHaveLength(1)

    // 复盘记录了已转换的行动，且任务进入行动中心
    const reviews = await readStore(page, 'reviews')
    expect(reviews).toHaveLength(1)
    expect(reviews[0].convertedTaskIds).toContain('每天练习 30 分钟')

    await nav(page, '行动中心')
    await tab(page, '任务')
    await expect(page.getByText('每天练习 30 分钟').first()).toBeVisible()
  })

  test('完成复盘会保存统计快照，之后仍显示快照', async ({ page }) => {
    await openApp(page)
    await quickAddTask(page, '本周完成的任务')

    await nav(page, '行动中心')
    await tab(page, '任务')
    await page.getByRole('checkbox', { name: '标记为完成' }).first().click()
    await expect(page.getByRole('checkbox', { name: '标记为未完成' }).first()).toBeVisible()

    await nav(page, '周期复盘')
    await page.getByRole('button', { name: '标记完成' }).click()
    await expect(page.getByText('已完成复盘，显示完成时的统计快照')).toBeVisible()

    const reviews = await readStore(page, 'reviews')
    expect(reviews).toHaveLength(1)
    expect(reviews[0].status).toBe('done')
    expect(reviews[0].statsSnapshot).toBeTruthy()
    expect(reviews[0].snapshotAt).toBeTruthy()
  })
})

test.describe('普通自定义模块', () => {
  test('创建旅行计划模块、加内容、改名、停用、恢复，数据完整', async ({ page }) => {
    await openApp(page)

    // 创建模块
    await nav(page, '模块中心')
    await page.getByRole('button', { name: '新建模块' }).click()
    const dialog = page.getByRole('dialog', { name: '新建模块' })
    await dialog.getByLabel('名称').fill('旅行计划')
    await dialog.getByLabel('描述').fill('整理旅行准备事项')
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(dialog).toBeHidden()

    // 侧栏出现该模块（无需改代码即可使用）
    await nav(page, '旅行计划')
    await expect(page.getByRole('heading', { name: '旅行计划' }).or(page.getByText('旅行计划').first())).toBeVisible()

    // 往模块里加内容
    await nav(page, '总览')
    await quickAddTask(page, '预订机票', { module: '旅行计划' })
    await nav(page, '旅行计划')
    await expect(page.getByText('预订机票').first()).toBeVisible()

    // 改名：侧栏与页面同步，数据不丢
    await nav(page, '模块中心')
    await page.getByRole('button', { name: '编辑 旅行计划' }).click()
    const editDialog = page.getByRole('dialog', { name: '编辑模块' })
    await editDialog.getByLabel('名称').fill('环球旅行')
    await editDialog.getByRole('button', { name: '保存' }).click()
    await expect(editDialog).toBeHidden()
    await nav(page, '环球旅行')
    await expect(page.getByText('预订机票').first()).toBeVisible()

    let tasks = await readStore(page, 'tasks')
    expect(tasks.find((t) => t.title === '预订机票')).toBeTruthy()

    await nav(page, '环球旅行')
    await expect(page.getByText('预订机票').first()).toBeVisible()

    // 停用：导航入口消失，但数据保留、行动中心仍可筛选到
    await nav(page, '模块中心')
    await page.getByRole('button', { name: '停用 环球旅行' }).click()
    await expect(page.getByText('已停用').first()).toBeVisible()
    await expect(page.getByRole('link', { name: '环球旅行', exact: true })).toHaveCount(0)
    tasks = await readStore(page, 'tasks')
    expect(tasks.find((t) => t.title === '预订机票')).toBeTruthy()

    // 恢复启用
    await page.getByRole('button', { name: '启用 环球旅行' }).click()
    await nav(page, '环球旅行')
    await expect(page.getByText('预订机票').first()).toBeVisible()

    // 归档 → 进入已归档列表；恢复 → 回到可用
    await nav(page, '模块中心')
    await page.getByRole('button', { name: '归档 环球旅行' }).click()
    await expect(page.getByRole('link', { name: '环球旅行', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '已归档' })).toBeVisible()
    await page.getByRole('button', { name: '恢复 环球旅行' }).click()
    await nav(page, '环球旅行')

    // 全流程数据完整
    tasks = await readStore(page, 'tasks')
    expect(tasks.find((t) => t.title === '预订机票')).toBeTruthy()
  })
})

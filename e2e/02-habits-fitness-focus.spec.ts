import { test, expect } from '@playwright/test'
import { openApp, nav, tab, readStore, openFocusPanel, quickAddTask, todayLocal } from './helpers'

test.describe('习惯打卡唯一性', () => {
  test('同日重复打卡只保留一条有效记录，取消后状态恢复', async ({ page }) => {
    await openApp(page)

    await nav(page, '行动中心')
    await tab(page, '习惯')
    await page.getByRole('button', { name: '新增习惯' }).first().click()
    const dialog = page.getByRole('dialog', { name: '新增习惯' })
    await dialog.getByLabel('名称').fill('每天阅读')
    await dialog.getByLabel('所属领域').selectOption({ label: '个人提升' })
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(dialog).toBeHidden()

    const checkButton = page.getByRole('button', { name: '打卡' }).first()
    await expect(checkButton).toBeVisible()

    // 打卡
    await checkButton.click()
    await expect(page.getByRole('button', { name: '取消打卡' }).first()).toBeVisible()

    let rows = await readStore(page, 'habitCheckins')
    expect(rows).toHaveLength(1)

    // 同日再次点击 = 取消打卡（不是插入第二条）
    await page.getByRole('button', { name: '取消打卡' }).first().click()
    await expect(page.getByRole('button', { name: '打卡' }).first()).toBeVisible()
    rows = await readStore(page, 'habitCheckins')
    expect(rows).toHaveLength(0)

    // 再次打卡仍只有一条，且日期唯一
    await page.getByRole('button', { name: '打卡' }).first().click()
    await expect(page.getByRole('button', { name: '取消打卡' }).first()).toBeVisible()
    rows = await readStore(page, 'habitCheckins')
    expect(rows).toHaveLength(1)
    const dates = rows.map((r) => r.localDate)
    expect(new Set(dates).size).toBe(1)
  })
})

test.describe('运动记录统计', () => {
  test('记录一次训练后统计正确；只完成任务不产生虚构时长', async ({ page }) => {
    await openApp(page)

    await nav(page, '运动健身')
    // 本周训练次数/时长初始为 0
    await expect(page.getByText('本周训练次数').locator('..').getByText('0')).toBeVisible()

    // 记录一次 35 分钟跑步
    await page.getByRole('button', { name: '记录训练' }).first().click()
    const dialog = page.getByRole('dialog', { name: '新增活动记录' })
    await dialog.getByLabel('类型', { exact: true }).selectOption({ label: '运动' })
    await dialog.getByLabel('标题', { exact: true }).fill('晨跑')
    await dialog.getByLabel('投入时长（分钟）').fill('35')
    await dialog.getByLabel('运动类型').selectOption({ label: '跑步' })
    await dialog.getByLabel('距离（km）').fill('5')
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(dialog).toBeHidden()

    // 统计更新：1 次 / 35 分钟
    await expect(page.getByText('本周训练次数').locator('..').getByText('1')).toBeVisible()
    await expect(page.getByText('本周训练时长').locator('..').getByText('35 分钟')).toBeVisible()
    await expect(page.getByText('晨跑').first()).toBeVisible()

    // 记录落库并带运动细节
    const activities = await readStore(page, 'activityLogs')
    const workout = activities.find((a) => a.title === '晨跑')
    expect(workout).toBeTruthy()
    expect((workout?.details as { workout?: { distanceKm?: number } })?.workout?.distanceKm).toBe(5)

    // 只勾选完成一个训练任务：不增加训练次数，也不产生时长
    const today = await todayLocal(page)
    await quickAddTask(page, '力量训练', { plannedDate: today, module: '运动健身' })
    await nav(page, '运动健身')
    await expect(page.getByText('力量训练').first()).toBeVisible()

    const before = (await readStore(page, 'activityLogs')).length
    await page.getByRole('button', { name: '完成', exact: true }).first().click()
    await expect(page.getByRole('button', { name: '取消完成' }).first()).toBeVisible()

    const after = await readStore(page, 'activityLogs')
    expect(after.length, '仅勾选完成不应产生活动记录').toBe(before)
    await expect(page.getByText('本周训练次数').locator('..').getByText('1')).toBeVisible()
    await expect(page.getByText('本周训练时长').locator('..').getByText('35 分钟')).toBeVisible()
  })
})

test.describe('专注结束与转领域记录', () => {
  test('专注可转为领域记录，重复转换不新增第二条，且不自动完成关联任务', async ({ page }) => {
    await openApp(page)

    // 建一个关联任务
    await quickAddTask(page, '专注任务')

    // 开始专注（自定义 1 分钟，随后手动结束）
    await openFocusPanel(page)
    await page.getByLabel('自定义分钟').fill('1')
    await page.getByLabel('关联任务').selectOption({ label: '专注任务' })
    await page.getByRole('button', { name: '开始专注' }).click()
    await expect(page.getByRole('button', { name: '暂停' })).toBeVisible()

    // 结束专注
    await page.getByRole('button', { name: '结束' }).click()
    await expect(page.getByText('本次专注已记录')).toBeVisible()

    // 转为领域记录
    await page.getByRole('button', { name: '转为领域记录' }).first().click()
    const convert = page.getByRole('dialog', { name: '转为领域记录' })
    await expect(convert).toBeVisible()
    await convert.getByLabel('所属领域').selectOption({ label: '个人提升' })
    await convert.getByLabel('活动类型').selectOption({ label: '学习' })
    await convert.getByLabel('标题').fill('专注学习')
    await convert.getByLabel('时长（分钟）').fill('25')
    await convert.getByRole('button', { name: '生成记录' }).click()
    await expect(convert).toBeHidden()

    // 只生成一条，并保留来源会话
    const sessions = await readStore(page, 'focusSessions')
    const done = sessions.find((s) => s.status === 'done')
    expect(done).toBeTruthy()

    let activities = await readStore(page, 'activityLogs')
    const linked = activities.filter((a) => a.sourceFocusSessionId === done?.id)
    expect(linked).toHaveLength(1)
    expect(linked[0].durationMinutes).toBe(25)

    // 重复提交被阻断：转换入口变为禁用态，无法再次提交
    const convertButton = page.getByRole('button', { name: '已转为领域记录' }).first()
    await expect(convertButton).toBeVisible()
    await expect(convertButton).toBeDisabled()

    // 最近专注列表同样标记为已转记录，不提供再次转换
    await expect(page.getByText('已转记录').first()).toBeVisible()

    // 数据层：该会话仍然只有一条活动记录
    activities = await readStore(page, 'activityLogs')
    expect(activities.filter((a) => a.sourceFocusSessionId === done?.id)).toHaveLength(1)

    // 关联任务没有被自动完成
    const tasks = await readStore(page, 'tasks')
    expect(tasks.find((t) => t.title === '专注任务')?.status).toBe('todo')
  })
})

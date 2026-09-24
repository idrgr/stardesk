import { test, expect, type Page } from '@playwright/test'
import { openApp, nav, tab, readStore, quickAddTask, waitForShell } from './helpers'

/** 在同一浏览器上下文里新开一个标签页（共享 IndexedDB / localStorage）。 */
async function openSecondTab(page: Page): Promise<Page> {
  const second = await page.context().newPage()
  await second.goto('/')
  await waitForShell(second)
  return second
}

test.describe('多标签页冲突', () => {
  test('陈旧 revision 的编辑被发现，不静默覆盖对方修改', async ({ page }) => {
    await openApp(page)
    await quickAddTask(page, '并发任务')

    // 打开第二个标签页
    const other = await openSecondTab(page)
    try {
      // 两个标签页都先打开编辑表单（持有同一个 revision）
      await nav(page, '行动中心')
      await tab(page, '任务')
      await page.getByText('并发任务').first().click()
      await page.getByRole('dialog', { name: '任务详情' }).getByRole('button', { name: '编辑' }).click()

      await nav(other, '行动中心')
      await tab(other, '任务')
      await other.getByText('并发任务').first().click()
      await other.getByRole('dialog', { name: '任务详情' }).getByRole('button', { name: '编辑' }).click()

      // 第一个标签页先保存
      const firstDialog = page.getByRole('dialog', { name: '编辑任务' })
      await firstDialog.getByLabel('标题').fill('并发任务（A 改）')
      await firstDialog.getByRole('button', { name: '保存' }).click()
      await expect(firstDialog).toBeHidden()

      // 第二个标签页用陈旧版本保存：应被拒绝并提示，而不是静默覆盖
      const secondDialog = other.getByRole('dialog', { name: '编辑任务' })
      await secondDialog.getByLabel('标题').fill('并发任务（B 改）')
      await secondDialog.getByRole('button', { name: '保存' }).click()

      await expect(other.getByText('该任务已被其他页面修改，请关闭后重新打开再编辑。')).toBeVisible()
      // 输入被保留（没有被清空）
      await expect(secondDialog.getByLabel('标题')).toHaveValue('并发任务（B 改）')
      // 数据库里仍是 A 的修改
      const tasks = await readStore(page, 'tasks')
      expect(tasks.find((t) => t.title.startsWith('并发任务'))?.title).toBe('并发任务（A 改）')
    } finally {
      await other.close()
    }
  })

  test('完整恢复替换数据后，其他标签页发现失效并阻止旧编辑写入', async ({ page }) => {
    await openApp(page)
    await quickAddTask(page, '恢复前任务')

    const other = await openSecondTab(page)
    try {
      // 第二个标签页开始一个专注会话（旧的运行中状态）
      await other.getByRole('banner').getByRole('button', { name: '专注' }).click()
      await other.getByLabel('自定义分钟').fill('5')
      await other.getByRole('button', { name: '开始专注' }).click()
      await expect(other.getByRole('button', { name: '暂停' })).toBeVisible()

      // 第一个标签页执行完整替换恢复
      await nav(page, '设置与数据')
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: '导出备份（JSON）' }).click()
      const download = await downloadPromise
      const file = test.info().outputPath('backup.json')
      await download.saveAs(file)

      await page.locator('input[type="file"]').setInputFiles(file)
      await page.getByRole('button', { name: '确认替换' }).click()
      await expect(page.getByText('已恢复备份')).toBeVisible()

      // 第二个标签页必须发现数据空间已被替换
      await expect(other.getByText('数据已在其他标签页被完整替换，本页面的保存操作已暂停。请重新加载后再继续编辑。')).toBeVisible({ timeout: 15000 })
      await expect(other.getByRole('alertdialog')).toBeVisible()
      await expect(other.getByText('数据已被替换')).toBeVisible()

      // 旧的专注面板已被关闭：旧会话不再继续计时/操作
      await expect(other.getByRole('dialog', { name: '专注' })).toHaveCount(0)

      await other.getByRole('button', { name: '暂时关闭' }).click()
      const before = await readStore(page, 'tasks')

      // 旧标签页里的写入被数据层拒绝：通过界面新增任务不会写入
      await nav(other, '行动中心')
      await tab(other, '任务')
      await other.getByRole('banner').getByRole('button', { name: '快速新增' }).click()
      const staleDialog = other.getByRole('dialog', { name: '新增任务' })
      await staleDialog.getByLabel('标题').fill('陈旧标签页任务')
      await staleDialog.getByRole('button', { name: '保存' }).click()
      await expect(other.getByText(/完整恢复替换|保存失败/)).toBeVisible()
      // 输入被保留，未被清空
      await expect(staleDialog.getByLabel('标题')).toHaveValue('陈旧标签页任务')
      // 数据库没有被旧标签页改动
      const after = await readStore(page, 'tasks')
      expect(after.length).toBe(before.length)
      expect(after.some((t) => t.title === '陈旧标签页任务')).toBe(false)

      // 重新加载后失效状态应解除（整页重载，而非 SPA 内跳转）
      await other.reload()
      await waitForShell(other)
      await expect(other.getByText('数据已在其他标签页被完整替换')).toHaveCount(0)
      await nav(other, '总览')
      await expect(other.getByRole('heading', { name: '今日航线' })).toBeVisible()

      // 恢复后的标签页可以正常写入
      await other.getByRole('banner').getByRole('button', { name: '快速新增' }).click()
      const freshDialog = other.getByRole('dialog', { name: '新增任务' })
      await freshDialog.getByLabel('标题').fill('重新加载后可写入')
      await freshDialog.getByRole('button', { name: '保存' }).click()
      await expect(freshDialog).toBeHidden()

      const finalTasks = await readStore(page, 'tasks')
      expect(finalTasks.some((t) => t.title === '重新加载后可写入')).toBe(true)
    } finally {
      await other.close()
    }
  })
})

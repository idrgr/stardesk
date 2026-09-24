import { test, expect, type Page } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openApp, nav, tab, readStore, quickAddTask } from './helpers'

const workDir = mkdtempSync(join(tmpdir(), 'stardesk-e2e-'))

/** 通过设置页导出备份，返回下载到本地的文件路径。 */
async function exportBackup(page: Page): Promise<string> {
  await nav(page, '设置与数据')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出备份（JSON）' }).click()
  const download = await downloadPromise
  const target = join(workDir, download.suggestedFilename())
  await download.saveAs(target)
  await expect(page.getByText('备份文件已生成')).toBeVisible()
  return target
}

/** 上传备份文件（走真实的文件校验 + 预览 + 替换流程）。 */
async function uploadBackup(page: Page, filePath: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(filePath)
}

test.describe('备份与恢复', () => {
  test('导出后可恢复到隔离的新数据空间，实体与关系一致', async ({ page, browser }) => {
    await openApp(page)

    // 造一点有结构的数据：目标 → 项目 → 任务
    await nav(page, '行动中心')
    await tab(page, '目标')
    await page.getByRole('button', { name: '新增目标' }).first().click()
    const goalDialog = page.getByRole('dialog', { name: '新增目标' })
    await goalDialog.getByLabel('标题').fill('备份目标')
    await goalDialog.getByLabel('所属领域').selectOption({ label: '个人提升' })
    await goalDialog.getByRole('button', { name: '保存' }).click()
    await expect(goalDialog).toBeHidden()

    await nav(page, '总览')
    await quickAddTask(page, '备份任务', { module: '个人提升' })

    const srcTasks = await readStore(page, 'tasks')
    const srcGoals = await readStore(page, 'goals')

    const file = await exportBackup(page)

    // 备份文件内容自检：格式、版本、计数
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    expect(parsed.appId).toBe('stardesk')
    expect(parsed.exportFormatVersion).toBe(1)
    expect(parsed.sourceSpace).toBe('personal')
    expect(parsed.recordCounts.tasks).toBe(srcTasks.length)
    expect(parsed.recordCounts.goals).toBe(srcGoals.length)

    // 在全新的浏览器上下文（隔离的 IndexedDB）中恢复
    const freshContext = await browser.newContext()
    const freshPage = await freshContext.newPage()
    try {
      await openApp(freshPage)
      expect((await readStore(freshPage, 'tasks')).length).toBe(0)

      await nav(freshPage, '设置与数据')
      await uploadBackup(freshPage, file)

      // 预览显示来源与计数
      await expect(freshPage.getByText('确认恢复备份？将完整替换当前数据。')).toBeVisible()
      await freshPage.getByRole('button', { name: '确认替换' }).click()
      await expect(freshPage.getByText('已恢复备份')).toBeVisible()

      // 数据与关系一致
      const restoredTasks = await readStore(freshPage, 'tasks')
      const restoredGoals = await readStore(freshPage, 'goals')
      expect(restoredTasks.length).toBe(srcTasks.length)
      expect(restoredGoals.length).toBe(srcGoals.length)

      await nav(freshPage, '行动中心')
      await tab(freshPage, '任务')
      await expect(freshPage.getByText('备份任务').first()).toBeVisible()

      await tab(freshPage, '目标')
      await expect(freshPage.getByText('备份目标').first()).toBeVisible()
    } finally {
      await freshContext.close()
    }
  })

  test('损坏 / 版本不符 / 重复 ID 的备份被拒绝，原数据不变', async ({ page }) => {
    await openApp(page)
    await quickAddTask(page, '原有任务')
    await nav(page, '设置与数据')

    const before = (await readStore(page, 'tasks')).length

    // 1) 非法 JSON
    const bad1 = join(workDir, 'bad-json.json')
    writeFileSync(bad1, '{ this is not json')
    await uploadBackup(page, bad1)
    await expect(page.locator('p.text-danger')).toBeVisible()
    expect((await readStore(page, 'tasks')).length).toBe(before)

    // 先导出一份结构合法的备份作为后续用例的基底
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出备份（JSON）' }).click()
    const download = await downloadPromise
    const good = join(workDir, 'good.json')
    await download.saveAs(good)
    const base = JSON.parse(readFileSync(good, 'utf8')) as {
      exportFormatVersion: number
      data: { tasks: Record<string, unknown>[] }
    }

    // 2) 未知格式版本
    const bad2 = join(workDir, 'bad-version.json')
    writeFileSync(bad2, JSON.stringify({ ...base, exportFormatVersion: 99 }))
    await uploadBackup(page, bad2)
    await expect(page.locator('p.text-danger')).toContainText('不支持的备份格式版本')
    expect((await readStore(page, 'tasks')).length).toBe(before)

    // 3) 重复 ID
    const bad3 = join(workDir, 'bad-dup.json')
    writeFileSync(
      bad3,
      JSON.stringify({ ...base, data: { ...base.data, tasks: [...base.data.tasks, base.data.tasks[0]] } }),
    )
    await uploadBackup(page, bad3)
    await expect(page.locator('p.text-danger')).toContainText('重复 ID')
    expect((await readStore(page, 'tasks')).length).toBe(before)

    // 4) 悬空引用
    const bad4 = join(workDir, 'bad-ref.json')
    writeFileSync(
      bad4,
      JSON.stringify({
        ...base,
        data: { ...base.data, tasks: base.data.tasks.map((t) => ({ ...t, projectId: 'missing-project-id' })) },
      }),
    )
    await uploadBackup(page, bad4)
    await expect(page.locator('p.text-danger')).toContainText('引用不存在的项目')

    // 原数据始终未变
    expect((await readStore(page, 'tasks')).length).toBe(before)
    await nav(page, '行动中心')
    await tab(page, '任务')
    await expect(page.getByText('原有任务').first()).toBeVisible()
  })
})

test.describe('软删除与回收站', () => {
  test('删除任务进入回收站，可恢复且关联内容正确返回', async ({ page }) => {
    await openApp(page)

    await quickAddTask(page, '待删除任务')
    await nav(page, '行动中心')
    await tab(page, '任务')
    await expect(page.getByText('待删除任务').first()).toBeVisible()

    // 删除（软删除）：用带任务名的可访问名称精确定位，避免与标题按钮混淆
    await page.getByRole('button', { name: '删除任务：待删除任务', exact: true }).click()
    await expect(page.getByText('已移入回收站')).toBeVisible()
    await expect(page.getByText('待删除任务')).toHaveCount(0)

    // 软删除的任务默认查询不可见，但记录仍在库中（deletedAt 非空）
    const afterDelete = await readStore(page, 'tasks')
    const trashed = afterDelete.find((t) => t.title === '待删除任务')
    expect(trashed).toBeTruthy()
    expect(trashed?.deletedAt).toBeTruthy()

    // 回收站恢复
    await nav(page, '设置与数据')
    const trashRow = page.locator('div').filter({ hasText: '待删除任务' }).last()
    await expect(trashRow).toBeVisible()
    await trashRow.getByRole('button', { name: '恢复' }).click()
    await expect(page.getByText('已恢复')).toBeVisible()

    // 任务回到行动中心
    await nav(page, '行动中心')
    await tab(page, '任务')
    await expect(page.getByText('待删除任务').first()).toBeVisible()

    const restored = await readStore(page, 'tasks')
    expect(restored.find((t) => t.title === '待删除任务')?.deletedAt).toBeNull()
  })
})

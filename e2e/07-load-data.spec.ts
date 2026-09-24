import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { openApp, nav, tab, todayLocal, waitForShell } from './helpers'

const REPORT_DIR = 'e2e-evidence'

interface SeedResult {
  tasks: number
  activities: number
  habitCheckins: number
  elapsedMs: number
}

/** 在浏览器 IndexedDB 中批量写入代表性数据（不经过 UI，用于负载交互观察）。 */
async function seedBulkData(
  page: import('@playwright/test').Page,
  counts: { tasks: number; activities: number; checkins: number },
): Promise<SeedResult> {
  return page.evaluate(async (counts) => {
    const start = performance.now()
    const openDb = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('stardesk')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => resolve(req.result)
      })

    const db = await openDb()
    const moduleId = await new Promise<string>((resolve, reject) => {
      const tx = db.transaction('modules', 'readonly')
      const req = tx.objectStore('modules').getAll()
      req.onsuccess = () => {
        const rows = req.result as { id: string; definitionKey?: string }[]
        const growth = rows.find((m) => m.definitionKey === 'growth')
        const id = growth?.id ?? rows[0]?.id
        if (!id) reject(new Error('modules 表为空，请先完成工作台初始化'))
        else resolve(id)
      }
      req.onerror = () => reject(req.error ?? new Error('读取 modules 失败'))
    })

    const now = new Date().toISOString()
    const today = (() => {
      const d = new Date()
      const p = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    })()

    const base = () => ({
      createdAt: now,
      updatedAt: now,
      revision: 1,
      deletedAt: null,
      deleteBatchId: null,
    })

    const putAll = (store: string, rows: unknown[]) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        const os = tx.objectStore(store)
        for (const row of rows) os.put(row)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })

    const tasks = Array.from({ length: counts.tasks }, (_, i) => ({
      ...base(),
      id: crypto.randomUUID(),
      moduleId,
      goalId: null,
      projectId: null,
      parentTaskId: null,
      title: `负载任务 #${i + 1}`,
      description: '',
      status: i % 5 === 0 ? 'done' : 'todo',
      priority: 'medium',
      plannedDate: i % 3 === 0 ? today : null,
      scheduledTime: null,
      dueDate: null,
      estimatedMinutes: null,
      tags: i % 10 === 0 ? ['负载'] : [],
      completedAt: i % 5 === 0 ? now : null,
      completedLocalDate: i % 5 === 0 ? today : null,
      archivedAt: null,
    }))

    const activities = Array.from({ length: counts.activities }, (_, i) => ({
      ...base(),
      id: crypto.randomUUID(),
      moduleId: moduleId ?? 'missing',
      projectId: null,
      taskId: null,
      kind: i % 3 === 0 ? 'workout' : i % 3 === 1 ? 'learning' : 'hobby',
      localDate: today,
      title: `负载活动 #${i + 1}`,
      durationMinutes: 15 + (i % 45),
      note: '',
      sourceFocusSessionId: null,
      details: {},
    }))

    let habitId: string | null = null
    if (counts.checkins > 0) {
      habitId = crypto.randomUUID()
      await putAll('habits', [
        {
          ...base(),
          id: habitId,
          moduleId: moduleId ?? 'missing',
          goalId: null,
          title: '负载测试习惯',
          description: '',
          enabled: true,
          startDate: today,
          endDate: null,
          scheduleVersions: [{ effectiveFrom: today, frequency: { cadence: 'daily', daysOfWeek: [] } }],
          pauseIntervals: [],
          archivedAt: null,
        },
      ])
    }

    const checkins =
      habitId && counts.checkins > 0
        ? Array.from({ length: counts.checkins }, (_, i) => ({
            id: crypto.randomUUID(),
            habitId,
            localDate: today,
            note: '',
            createdAt: now,
          }))
        : []

    await putAll('tasks', tasks)
    await putAll('activityLogs', activities)
    if (checkins.length) await putAll('habitCheckins', checkins)
    db.close()

    return {
      tasks: tasks.length,
      activities: activities.length,
      habitCheckins: checkins.length,
      elapsedMs: Math.round(performance.now() - start),
    }
  }, counts)
}

test.describe('约 1000 条数据的真实浏览器交互', () => {
  test('首页、行动中心、搜索、领域页与趋势图在大量数据下可交互', async ({ page }, testInfo) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page)

    const seed = await seedBulkData(page, { tasks: 750, activities: 250, checkins: 0 })
    expect(seed.tasks + seed.activities + seed.habitCheckins).toBeGreaterThanOrEqual(990)

    // 直接写入 IndexedDB 后需整页重载，React/Dexie 才会重新读取。
    await page.reload()
    await waitForShell(page)

    const observations: Record<string, unknown> = {
      environment: {
        userAgent: testInfo.project.name,
        viewport: '1440x900',
        note: 'Windows + Microsoft Edge (Playwright channel: msedge)',
      },
      seed,
      timingsMs: {} as Record<string, number>,
      notes: [] as string[],
    }

    const timeNav = async (label: string, fn: () => Promise<void>) => {
      const t0 = Date.now()
      await fn()
      const ms = Date.now() - t0
      ;(observations.timingsMs as Record<string, number>)[label] = ms
    }

    await timeNav('dashboard', async () => {
      await nav(page, '总览')
      await expect(page.getByRole('heading', { name: '今日航线' })).toBeVisible({ timeout: 60_000 })
      await expect(page.getByRole('heading', { name: '投入趋势' })).toBeVisible({ timeout: 60_000 })
    })

    await timeNav('actions-filter', async () => {
      await nav(page, '行动中心')
      await tab(page, '任务')
      await page.getByPlaceholder('搜索任务…').fill('负载任务 #1')
      await expect(page.getByText('负载任务 #1').first()).toBeVisible({ timeout: 30_000 })
      await page.getByRole('button', { name: '已完成' }).click()
      await expect(page.getByText('负载任务 #5').first()).toBeVisible({ timeout: 30_000 })
    })

    await timeNav('search', async () => {
      await page.keyboard.press('Control+K')
      const palette = page.getByRole('dialog', { name: '搜索' })
      await expect(palette).toBeVisible()
      await palette.getByRole('textbox').fill('负载任务 #10')
      await expect(palette.getByText('负载任务 #10').first()).toBeVisible({ timeout: 30_000 })
      await page.keyboard.press('Escape')
    })

    await timeNav('domain', async () => {
      await nav(page, '个人提升')
      await expect(page.getByRole('heading', { name: '个人提升' })).toBeVisible({ timeout: 30_000 })
    })

    const today = await todayLocal(page)
    const planMetric = page.getByTestId('metric-today-plan-value')
    if (await planMetric.isVisible()) {
      const text = await planMetric.innerText()
      ;(observations.notes as string[]).push(`首页今日计划指标：${text}（本地日期 ${today}）`)
    }

    mkdirSync(REPORT_DIR, { recursive: true })
    await page.screenshot({ path: `${REPORT_DIR}/load-1440-dashboard.png`, fullPage: false })
    writeFileSync(`${REPORT_DIR}/load-data-report.json`, JSON.stringify(observations, null, 2), 'utf8')

    testInfo.annotations.push({
      type: 'load-observation',
      description: JSON.stringify(observations.timingsMs),
    })

    // 不设定虚构性能分数；仅断言关键页面在合理超时内可达。
    for (const [key, ms] of Object.entries(observations.timingsMs as Record<string, number>)) {
      expect(ms, `${key} 交互超时`).toBeLessThan(90_000)
    }
  })
})

import { expect, type Page } from '@playwright/test'

const BOOT_TIMEOUT = 30000

/** 视口宽度 <768px 时桌面侧栏隐藏，需通过顶栏打开移动抽屉。 */
export async function isMobileShell(page: Page): Promise<boolean> {
  return page.evaluate(() => window.matchMedia('(max-width: 767px)').matches)
}

/** 工作台就绪：顶栏「快速新增」可见（含仅图标的窄屏顶栏）。 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: '快速新增' }).first()).toBeVisible({
    timeout: BOOT_TIMEOUT,
  })
}

/**
 * 打开应用并确保已进入工作台。
 *
 * 注意：不能在 goto 之后用一次性的 isVisible() 判断引导页——React 尚未挂载时
 * 会返回 false 并跳过点击，页面将一直停在引导页。这里改为确定性等待：
 * 「引导页按钮」或「应用外壳」任一出现后再分支。
 * 最后等待懒加载的总览页渲染完成，避免后续交互落在 Suspense 切换上。
 */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/')

  const blank = page.getByRole('button', { name: '创建我的空白工作台' })
  const ready = page.getByRole('heading', { name: '今日航线' })

  await expect(blank.or(ready).first()).toBeVisible({ timeout: BOOT_TIMEOUT })

  if (await blank.isVisible()) {
    await blank.click()
  }

  await waitForAppReady(page)
}

/** 等待应用外壳就绪（与 openApp 一致，兼容刷新后等待）。 */
export async function waitForShell(page: Page): Promise<void> {
  await waitForAppReady(page)
}

/** 在桌面或移动抽屉中打开侧栏导航链接。 */
export async function nav(page: Page, label: string): Promise<void> {
  const link = page.getByRole('link', { name: label, exact: true }).first()
  if (await isMobileShell(page)) {
    const drawerOpen = await page
      .locator('.fixed.inset-0.z-40.md\\:hidden')
      .getByRole('link', { name: label, exact: true })
      .first()
      .isVisible()
      .catch(() => false)
    if (!(await link.isVisible()) && !drawerOpen) {
      await page.getByRole('banner').getByRole('button', { name: '打开导航' }).click()
    }
  }
  await link.click()
}

/** 通过顶栏「快速新增」创建一个任务。 */
export async function quickAddTask(
  page: Page,
  title: string,
  options: { plannedDate?: string; priority?: '高' | '中' | '低'; module?: string } = {},
): Promise<void> {
  await page.getByRole('banner').getByRole('button', { name: '快速新增' }).click()
  const dialog = page.getByRole('dialog', { name: '新增任务' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('标题').fill(title)
  if (options.priority) {
    await dialog.getByRole('button', { name: options.priority, exact: true }).click()
  }
  if (options.plannedDate) {
    await dialog.getByLabel('计划日期').fill(options.plannedDate)
  }
  if (options.module) {
    await dialog.getByLabel('所属领域').selectOption({ label: options.module })
  }
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()
}

/**
 * 点击页签（行动中心/知识库等）。
 * 必须用 exact：否则「任务」会同时匹配「新增任务」「编辑任务」「删除任务」。
 */
export async function tab(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).first().click()
}

/** 今天的本地日期 YYYY-MM-DD（使用浏览器本地时区）。 */
export async function todayLocal(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  })
}

/** 断言页面没有横向溢出（页面整体不得横向滚动）。 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement
    return el.scrollWidth - el.clientWidth
  })
  expect(overflow, '页面出现横向溢出').toBeLessThanOrEqual(1)
}

/**
 * 直接读取 IndexedDB 中某个表的全部记录。
 * 用于验证界面无法表达的数据层事实（唯一约束、来源 ID 去重等）。
 */
export async function readStore(page: Page, store: string): Promise<Record<string, unknown>[]> {
  return (await page.evaluate(
    (name) =>
      new Promise<unknown[]>((resolve, reject) => {
        const req = indexedDB.open('stardesk')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains(name)) {
            db.close()
            resolve([])
            return
          }
          const tx = db.transaction(name, 'readonly').objectStore(name).getAll()
          tx.onsuccess = () => {
            const rows = tx.result as unknown[]
            db.close()
            resolve(rows)
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        req.onerror = () => reject(req.error)
      }),
    store,
  )) as Record<string, unknown>[]
}

/** 打开顶栏的专注面板。 */
export async function openFocusPanel(page: Page): Promise<void> {
  await page.getByRole('banner').getByRole('button', { name: '专注' }).click()
  await expect(page.getByRole('dialog', { name: '专注' })).toBeVisible()
}

import { test, expect, type Page } from '@playwright/test'
import { openApp, nav, tab, quickAddTask, expectNoHorizontalOverflow } from './helpers'

const VIEWPORTS = [
  { name: '360', width: 360, height: 740 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
]

const PAGES: { name: string; go: (p: Page) => Promise<void>; anchor: string }[] = [
  { name: 'dashboard', go: async (p) => nav(p, '总览'), anchor: '今日航线' },
  { name: 'actions', go: async (p) => { await nav(p, '行动中心'); await tab(p, '任务') }, anchor: '行动中心' },
  { name: 'knowledge', go: async (p) => nav(p, '知识库'), anchor: '知识库' },
  { name: 'reviews', go: async (p) => nav(p, '周期复盘'), anchor: '周期复盘' },
  { name: 'module-center', go: async (p) => nav(p, '模块中心'), anchor: '模块中心' },
  { name: 'settings', go: async (p) => nav(p, '设置与数据'), anchor: '设置与数据' },
  { name: 'domain-growth', go: async (p) => nav(p, '个人提升'), anchor: '个人提升' },
]

/** 页面上不应出现比视口更宽的元素（表格可横向滚动的容器除外）。 */
async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const bad: string[] = []
    document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
      const style = getComputedStyle(el)
      if (style.position === 'fixed' || style.pointerEvents === 'none') return
      const rect = el.getBoundingClientRect()
      if (rect.width > vw + 1 && rect.height > 0) {
        bad.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)} w=${Math.round(rect.width)}`)
      }
    })
    return bad.slice(0, 5)
  })
}

test.describe('多断点视觉检查', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}px：关键页面无横向溢出并留存截图`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await openApp(page)

      // 造一点数据，避免只检查空状态
      await quickAddTask(page, '断电检查任务')
      await nav(page, '行动中心')
      await tab(page, '习惯')
      await page.getByRole('button', { name: '新增习惯' }).first().click()
      const habitDialog = page.getByRole('dialog', { name: '新增习惯' })
      await habitDialog.getByLabel('名称').fill('断点习惯')
      await habitDialog.getByLabel('所属领域').selectOption({ label: '个人提升' })
      await habitDialog.getByRole('button', { name: '保存' }).click()
      await expect(habitDialog).toBeHidden()

      for (const p of PAGES) {
        await p.go(page)
        await expect(page.getByRole('heading', { name: p.anchor }).first()).toBeVisible({ timeout: 15000 })
        await expectNoHorizontalOverflow(page)
        const overflow = await overflowingElements(page)
        expect(overflow, `${p.name} 在 ${vp.name}px 存在超出视口的元素`).toEqual([])
        await page.screenshot({
          path: `e2e-evidence/${vp.name}-${p.name}.png`,
          fullPage: false,
        })
      }
    })
  }
})

test.describe('弹窗与抽屉不超出屏幕', () => {
  for (const vp of [
    { name: '360', width: 360, height: 740 },
    { name: '768', width: 768, height: 1024 },
  ]) {
    test(`${vp.name}px：任务表单与详情抽屉在视口内`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await openApp(page)
      await quickAddTask(page, '窄屏任务')

      await nav(page, '行动中心')
      await tab(page, '任务')
      await page.getByText('窄屏任务').first().click()

      const drawer = page.getByRole('dialog', { name: '任务详情' })
      await expect(drawer).toBeVisible()
      const box = await drawer.boundingBox()
      expect(box).toBeTruthy()
      expect(box!.x).toBeGreaterThanOrEqual(-1)
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1)

      // 打开编辑表单（弹窗）
      await drawer.getByRole('button', { name: '编辑' }).click()
      const dialog = page.getByRole('dialog', { name: '编辑任务' })
      await expect(dialog).toBeVisible()
      const dbox = await dialog.boundingBox()
      expect(dbox!.width).toBeLessThanOrEqual(vp.width + 1)

      await page.screenshot({ path: `e2e-evidence/${vp.name}-task-dialog.png` })
    })
  }
})

test.describe('主题与可访问性', () => {
  test('深色与浅色主题均可阅读，且关键文字对比度达标', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page)
    await quickAddTask(page, '主题检查任务')

    const contrast = async () =>
      page.evaluate(() => {
        const parse = (c: string) => c.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const bgOf = (el: Element): string => {
          let node: Element | null = el
          while (node) {
            const bg = getComputedStyle(node).backgroundColor
            if (bg && !bg.includes('rgba(0, 0, 0, 0)')) return bg
            node = node.parentElement
          }
          return getComputedStyle(document.body).backgroundColor
        }
        const results: { text: string; ratio: number }[] = []
        document.querySelectorAll<HTMLElement>('main p, main h1, main h2, main span').forEach((el) => {
          const text = el.textContent?.trim() ?? ''
          if (text.length < 2) return
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none') return
          const l1 = lum(parse(cs.color))
          const l2 = lum(parse(bgOf(el)))
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
          results.push({ text: text.slice(0, 20), ratio: Math.round(ratio * 100) / 100 })
        })
        return results
      })

    const dark = await contrast()
    await page.screenshot({ path: 'e2e-evidence/1440-dashboard-dark.png' })

    await page.getByRole('button', { name: /切换主题/ }).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')
    const light = await contrast()
    await page.screenshot({ path: 'e2e-evidence/1440-dashboard-light.png' })

    // 正文文字以 4.5:1 为目标；此处记录实际最差值，允许极少量的装饰性文字低于阈值。
    for (const [theme, list] of [['dark', dark], ['light', light]] as const) {
      const low = list.filter((r) => r.ratio < 4.5)
      // 允许不超过 10% 的文本低于 4.5（装饰性/次要文字），其余必须达标。
      expect(
        low.length / Math.max(1, list.length),
        `${theme} 主题下有 ${low.length}/${list.length} 处文本对比度低于 4.5:1：${JSON.stringify(low.slice(0, 5))}`,
      ).toBeLessThanOrEqual(0.1)
    }

    // 切回深色，避免影响后续测试
    await page.getByRole('button', { name: /切换主题/ }).click()
    await page.getByRole('button', { name: /切换主题/ }).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
  })

  test('图标按钮有可访问名称，输入控件有 label', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page)
    await quickAddTask(page, 'a11y 任务')

    for (const p of PAGES) {
      await p.go(page)
      await expect(page.getByRole('heading', { name: p.anchor }).first()).toBeVisible({ timeout: 15000 })

      const issues = await page.evaluate(() => {
        const problems: string[] = []
        document.querySelectorAll<HTMLElement>('main button').forEach((b) => {
          const name = (b.getAttribute('aria-label') || b.textContent || '').trim()
          if (!name) problems.push(`button 无可访问名称: ${b.className.slice(0, 50)}`)
        })
        document.querySelectorAll<HTMLElement>('main input, main select, main textarea').forEach((i) => {
          const id = i.getAttribute('id')
          const hasLabel =
            !!i.getAttribute('aria-label') ||
            !!i.getAttribute('aria-labelledby') ||
            (!!id && !!document.querySelector(`label[for="${id}"]`)) ||
            !!i.closest('label')
          if (!hasLabel) {
            problems.push(`输入控件无 label: ${i.tagName.toLowerCase()}[${i.getAttribute('type') ?? ''}] ${i.getAttribute('placeholder') ?? ''}`)
          }
        })
        const h1s = document.querySelectorAll('main h1')
        if (h1s.length > 1) problems.push(`页面有 ${h1s.length} 个 h1`)
        return problems
      })
      expect(issues, `${p.name} 页面存在可访问性问题`).toEqual([])
    }
  })

  test('键盘：Esc 关闭弹窗并把焦点还给触发元素', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page)

    const trigger = page.getByRole('banner').getByRole('button', { name: '快速新增' })
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: '新增任务' })
    await expect(dialog).toBeVisible()

    // 焦点落在弹窗内
    expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    // 键盘可达：Tab 能移动到侧栏导航
    await page.keyboard.press('Tab')
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedTag)
  })

  test('搜索面板支持上下键与 Esc，且不抢占输入框快捷键', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page)
    await quickAddTask(page, '键盘搜索任务')
    await nav(page, '行动中心')
    await tab(page, '任务')

    // 在搜索输入框内按 Ctrl+K 不应打开全局搜索面板
    const searchInput = page.getByPlaceholder('搜索任务…')
    await searchInput.click()
    await page.keyboard.press('Control+K')
    await expect(page.getByRole('dialog', { name: '搜索' })).toHaveCount(0)

    // 在空白处按 Ctrl+K 打开
    await page.locator('h1').click()
    await page.keyboard.press('Control+K')
    const palette = page.getByRole('dialog', { name: '搜索' })
    await expect(palette).toBeVisible()
    await palette.getByRole('textbox').fill('键盘搜索任务')
    await expect(palette.getByText('键盘搜索任务').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(palette).toBeHidden()
  })
})

test.describe('减少动效偏好', () => {
  test('prefers-reduced-motion 下不出现长动画', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page)

    const durations = await page.evaluate(() => {
      const el = document.querySelector('main *') as HTMLElement | null
      if (!el) return null
      const cs = getComputedStyle(el)
      return { transition: cs.transitionDuration, animation: cs.animationDuration }
    })
    expect(durations).toBeTruthy()
    // 全局样式在 reduce 下把过渡压缩到近 0
    const parse = (v: string) => Math.max(...v.split(',').map((s) => parseFloat(s) || 0))
    expect(parse(durations!.transition)).toBeLessThanOrEqual(0.01)
    expect(parse(durations!.animation)).toBeLessThanOrEqual(0.01)

    await page.screenshot({ path: 'e2e-evidence/1440-reduced-motion.png' })
  })
})

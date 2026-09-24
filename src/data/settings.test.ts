import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import { ensureSettings, updateSettings, getSettings } from './repositories/settings'
import { newId } from '@/lib/id'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('设置初始化与写入', () => {
  it('ensureSettings 不会覆盖已存在的设置', async () => {
    await updateSettings(db, { onboardingCompleted: true, nickname: '小明' })
    await ensureSettings(db)
    const s = await getSettings(db)
    expect(s?.onboardingCompleted).toBe(true)
    expect(s?.nickname).toBe('小明')
  })

  it('bootstrap 初始化与用户设置并发时，用户选择不被默认值覆盖', async () => {
    // 首次启动：引导页植入默认设置与用户点击「创建空白工作台」几乎同时发生。
    await Promise.all([
      ensureSettings(db),
      updateSettings(db, { onboardingCompleted: true }),
    ])
    const s = await getSettings(db)
    expect(s?.onboardingCompleted).toBe(true)
  })

  it('重复调用 ensureSettings 幂等', async () => {
    await Promise.all([ensureSettings(db), ensureSettings(db), ensureSettings(db)])
    const all = await db.settings.toArray()
    expect(all).toHaveLength(1)
  })
})

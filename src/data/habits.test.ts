import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import {
  createHabit,
  checkin,
  uncheckin,
  toggleCheckin,
  pauseHabit,
  resumeHabit,
  updateHabit,
  listCheckinsForHabit,
} from './repositories/habits'
import { isScheduledOn } from '@/domain/habits'
import { newId } from '@/lib/id'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})
afterEach(async () => {
  await db.delete()
})

const TODAY = '2026-09-24'

describe('习惯仓储', () => {
  it('创建习惯并生成初始频率版本', async () => {
    const h = await createHabit(db, {
      title: ' 每天读书 ',
      moduleId: 'm1',
      startDate: '2026-09-01',
      frequency: { cadence: 'daily', daysOfWeek: [] },
    })
    expect(h.title).toBe('每天读书')
    expect(h.scheduleVersions).toHaveLength(1)
    expect(isScheduledOn(h, TODAY)).toBe(true)
  })

  it('打卡唯一：同一习惯同一日期重复打卡只有一条', async () => {
    const h = await createHabit(db, {
      title: 'H',
      moduleId: 'm1',
      startDate: '2026-09-01',
      frequency: { cadence: 'daily', daysOfWeek: [] },
    })
    const r1 = await checkin(db, h.id, TODAY, TODAY)
    expect(r1).toBeTruthy()
    const r2 = await checkin(db, h.id, TODAY, TODAY)
    expect(r2).toBeNull() // 已打卡，无变化

    const records = await listCheckinsForHabit(db, h.id)
    expect(records).toHaveLength(1)
  })

  it('拒绝未来打卡', async () => {
    const h = await createHabit(db, {
      title: 'H',
      moduleId: 'm1',
      startDate: '2026-09-01',
      frequency: { cadence: 'daily', daysOfWeek: [] },
    })
    await expect(checkin(db, h.id, '2026-09-25', TODAY)).rejects.toThrow()
  })

  it('toggle 打卡/取消', async () => {
    const h = await createHabit(db, {
      title: 'H',
      moduleId: 'm1',
      startDate: '2026-09-01',
      frequency: { cadence: 'daily', daysOfWeek: [] },
    })
    expect(await toggleCheckin(db, h.id, TODAY, TODAY)).toBe(true)
    expect(await listCheckinsForHabit(db, h.id)).toHaveLength(1)
    expect(await toggleCheckin(db, h.id, TODAY, TODAY)).toBe(false)
    expect(await listCheckinsForHabit(db, h.id)).toHaveLength(0)
  })

  it('暂停与恢复', async () => {
    const h = await createHabit(db, {
      title: 'H',
      moduleId: 'm1',
      startDate: '2026-09-01',
      frequency: { cadence: 'daily', daysOfWeek: [] },
    })
    const paused = await pauseHabit(db, h.id, '2026-09-10')
    expect(isScheduledOn(paused, '2026-09-12')).toBe(false)

    const resumed = await resumeHabit(db, h.id, '2026-09-15')
    expect(isScheduledOn(resumed, '2026-09-16')).toBe(true)
    expect(isScheduledOn(resumed, '2026-09-12')).toBe(false) // 历史暂停保留
  })

  it('修改频率只影响未来，保留历史', async () => {
    const h = await createHabit(db, {
      title: 'H',
      moduleId: 'm1',
      startDate: '2026-09-01',
      frequency: { cadence: 'daily', daysOfWeek: [] },
    })
    const updated = await updateHabit(
      db,
      h.id,
      { frequency: { cadence: 'weekly', daysOfWeek: [1] } },
      '2026-09-20',
    )
    expect(updated.scheduleVersions).toHaveLength(2)
    expect(isScheduledOn(updated, '2026-09-15')).toBe(true) // 历史仍每日
    expect(isScheduledOn(updated, '2026-09-21')).toBe(true) // 未来周一
    expect(isScheduledOn(updated, '2026-09-22')).toBe(false) // 未来周二
  })

  it('取消打卡后记录删除', async () => {
    const h = await createHabit(db, {
      title: 'H',
      moduleId: 'm1',
      startDate: '2026-09-01',
      frequency: { cadence: 'daily', daysOfWeek: [] },
    })
    await checkin(db, h.id, TODAY, TODAY)
    await uncheckin(db, h.id, TODAY)
    expect(await listCheckinsForHabit(db, h.id)).toHaveLength(0)
  })
})

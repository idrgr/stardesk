import { describe, it, expect } from 'vitest'
import {
  computeStreak,
  computeWeekStats,
  effectiveFrequency,
  isScheduledOn,
  scheduledDatesInRange,
} from './habits'
import type { Habit } from './entities'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    revision: 1,
    deletedAt: null,
    deleteBatchId: null,
    moduleId: 'm1',
    goalId: null,
    title: '运动',
    description: '',
    enabled: true,
    startDate: '2026-09-01',
    endDate: null,
    scheduleVersions: [
      { effectiveFrom: '2026-09-01', frequency: { cadence: 'daily', daysOfWeek: [] } },
    ],
    pauseIntervals: [],
    archivedAt: null,
    ...overrides,
  }
}

describe('domain/habits 计划口径', () => {
  it('每日习惯从开始日起每天应执行', () => {
    const h = makeHabit()
    expect(isScheduledOn(h, '2026-09-01')).toBe(true)
    expect(isScheduledOn(h, '2026-09-15')).toBe(true)
    expect(isScheduledOn(h, '2026-08-31')).toBe(false) // 早于开始日
  })

  it('每周习惯只在指定星期执行', () => {
    const h = makeHabit({
      scheduleVersions: [
        { effectiveFrom: '2026-09-01', frequency: { cadence: 'weekly', daysOfWeek: [1] } },
      ],
    })
    expect(isScheduledOn(h, '2026-09-07')).toBe(true) // 周一
    expect(isScheduledOn(h, '2026-09-08')).toBe(false) // 周二
  })

  it('暂停区间内不应执行，恢复后执行', () => {
    const h = makeHabit({ pauseIntervals: [{ start: '2026-09-05', end: '2026-09-07' }] })
    expect(isScheduledOn(h, '2026-09-05')).toBe(false)
    expect(isScheduledOn(h, '2026-09-07')).toBe(false)
    expect(isScheduledOn(h, '2026-09-08')).toBe(true)
  })

  it('结束日期之后不再执行', () => {
    const h = makeHabit({ endDate: '2026-09-10' })
    expect(isScheduledOn(h, '2026-09-10')).toBe(true)
    expect(isScheduledOn(h, '2026-09-11')).toBe(false)
  })

  it('频率版本切换：修改未来频率不重写过去', () => {
    const h = makeHabit({
      scheduleVersions: [
        { effectiveFrom: '2026-09-01', frequency: { cadence: 'daily', daysOfWeek: [] } },
        { effectiveFrom: '2026-09-10', frequency: { cadence: 'weekly', daysOfWeek: [1] } },
      ],
    })
    expect(effectiveFrequency(h, '2026-09-05')?.cadence).toBe('daily')
    expect(effectiveFrequency(h, '2026-09-14')?.cadence).toBe('weekly')
    expect(isScheduledOn(h, '2026-09-05')).toBe(true) // 历史仍每日
    expect(isScheduledOn(h, '2026-09-12')).toBe(false) // 未来周六不执行
  })

  it('scheduledDatesInRange 列出区间内应执行日期', () => {
    const h = makeHabit({
      scheduleVersions: [
        { effectiveFrom: '2026-09-07', frequency: { cadence: 'weekly', daysOfWeek: [1, 3] } },
      ],
    })
    expect(scheduledDatesInRange(h, '2026-09-07', '2026-09-10')).toEqual([
      '2026-09-07', // 周一
      '2026-09-09', // 周三
    ])
  })
})

describe('domain/habits 连续次数', () => {
  it('每日连续打卡，今天未打卡则从昨天起算', () => {
    const h = makeHabit()
    const checkins = new Set(['2026-09-07', '2026-09-08', '2026-09-09'])
    expect(computeStreak(h, checkins, '2026-09-10')).toBe(3)
  })

  it('休息日不打断连续', () => {
    const h = makeHabit({
      scheduleVersions: [
        { effectiveFrom: '2026-09-01', frequency: { cadence: 'weekly', daysOfWeek: [1, 3, 5] } },
      ],
    })
    const checkins = new Set(['2026-09-07', '2026-09-09', '2026-09-11'])
    expect(computeStreak(h, checkins, '2026-09-11')).toBe(3)
  })

  it('今天未结束且未打卡，不判定历史中断', () => {
    const h = makeHabit()
    const checkins = new Set(['2026-09-07', '2026-09-08'])
    // 今天 09-09 尚未打卡，应从昨天 09-08 起算，不断链。
    expect(computeStreak(h, checkins, '2026-09-09')).toBe(2)
  })
})

describe('domain/habits 本周达成率', () => {
  it('分母仅统计本周截至今天的应打卡机会', () => {
    const h = makeHabit() // daily
    const checkins = new Set(['2026-09-07', '2026-09-08'])
    const stats = computeWeekStats(h, checkins, '2026-09-07', '2026-09-10', '2026-09-13')
    expect(stats.opportunities).toBe(4) // 周一~周四
    expect(stats.completed).toBe(2)
    expect(stats.rate).toBe(0.5)
  })

  it('无应打卡机会返回 null（不除零）', () => {
    const h = makeHabit({
      scheduleVersions: [
        { effectiveFrom: '2026-09-14', frequency: { cadence: 'daily', daysOfWeek: [] } },
      ],
    })
    const stats = computeWeekStats(h, new Set(), '2026-09-07', '2026-09-10', '2026-09-13')
    expect(stats.opportunities).toBe(0)
    expect(stats.rate).toBeNull()
  })
})

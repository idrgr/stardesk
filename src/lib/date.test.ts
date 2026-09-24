import { describe, it, expect } from 'vitest'
import {
  addDaysToDate,
  compareDates,
  diffInDays,
  endOfMonthDate,
  endOfWeekDate,
  formatDuration,
  isValidLocalDate,
  monthRange,
  startOfMonthDate,
  startOfWeekDate,
  todayInTimeZone,
  weekdayOf,
  weekRange,
} from './date'

describe('lib/date 日历运算', () => {
  it('跨年、跨月加减天', () => {
    expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToDate('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDaysToDate('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('星期几（2026-09-24 为周四）', () => {
    expect(weekdayOf('2026-09-24')).toBe(4)
    expect(weekdayOf('2026-01-01')).toBe(4)
  })

  it('周边界（周一开始）', () => {
    expect(startOfWeekDate('2026-09-24', 1)).toBe('2026-09-21')
    expect(endOfWeekDate('2026-09-24', 1)).toBe('2026-09-27')
  })

  it('周边界（周日开始）', () => {
    expect(startOfWeekDate('2026-09-24', 0)).toBe('2026-09-20')
    expect(endOfWeekDate('2026-09-24', 0)).toBe('2026-09-26')
  })

  it('月边界与闰年', () => {
    expect(startOfMonthDate('2026-09-15')).toBe('2026-09-01')
    expect(endOfMonthDate('2026-09-15')).toBe('2026-09-30')
    expect(endOfMonthDate('2026-02-01')).toBe('2026-02-28')
    expect(endOfMonthDate('2024-02-10')).toBe('2024-02-29')
  })

  it('weekRange / monthRange 使用传入时区', () => {
    const wr = weekRange('Asia/Shanghai', 1)
    expect(wr.start <= wr.end).toBe(true)
    expect(diffInDays(wr.end, wr.start)).toBe(6)
    const mr = monthRange('Asia/Shanghai')
    expect(mr.start.endsWith('-01')).toBe(true)
  })

  it('相差天数与比较', () => {
    expect(diffInDays('2026-09-24', '2026-09-21')).toBe(3)
    expect(compareDates('2026-09-24', '2026-09-21')).toBe(1)
    expect(compareDates('2026-09-21', '2026-09-24')).toBe(-1)
  })

  it('日期合法性校验', () => {
    expect(isValidLocalDate('2026-02-29')).toBe(false)
    expect(isValidLocalDate('2024-02-29')).toBe(true)
    expect(isValidLocalDate('2026-13-01')).toBe(false)
    expect(isValidLocalDate('2026-09-24')).toBe(true)
  })

  it('todayInTimeZone 返回合法本地日期', () => {
    const tz = 'Asia/Shanghai'
    const today = todayInTimeZone(tz)
    expect(isValidLocalDate(today)).toBe(true)
    // 无效时区应回退到设备本地日期
    expect(isValidLocalDate(todayInTimeZone('Not/AZone'))).toBe(true)
  })

  it('formatDuration 时长格式化', () => {
    expect(formatDuration(90)).toBe('1 小时 30 分')
    expect(formatDuration(45)).toBe('45 分钟')
    expect(formatDuration(120)).toBe('2 小时')
    expect(formatDuration(-5)).toBe('0 分钟')
  })
})

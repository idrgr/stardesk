/**
 * 习惯相关业务规则（纯函数）。
 *
 * 口径（见需求 6.5）：
 * - 历史计划由「带生效日期的频率版本」+「暂停区间」计算，修改未来频率不重写过去。
 * - 同一习惯同一本地日期唯一打卡（数据库层保证）。
 * - 连续次数按连续应执行日期计算，休息日不打断。
 * - 今天尚未结束且未打卡时，不提前判定历史连续记录中断。
 */

import type { Habit, HabitFrequency, HabitScheduleVersion } from './entities'
import { addDaysToDate, weekdayOf } from '@/lib/date'

/** 某日期上生效的频率版本（effectiveFrom 最大的且 <= 该日期）。 */
export function effectiveFrequency(
  habit: Habit,
  localDate: string,
): HabitFrequency | undefined {
  const versions = [...habit.scheduleVersions].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? 1 : -1,
  )
  return versions.find((v) => v.effectiveFrom <= localDate)?.frequency
}

/** 某日期是否落在暂停区间内。 */
export function isPausedOn(habit: Habit, localDate: string): boolean {
  return habit.pauseIntervals.some(
    (p) => localDate >= p.start && (p.end == null || localDate <= p.end),
  )
}

/** 某日期是否为应执行日（考虑起止日期、暂停、频率版本）。 */
export function isScheduledOn(habit: Habit, localDate: string): boolean {
  if (!habit.enabled || habit.archivedAt) return false
  if (localDate < habit.startDate) return false
  if (habit.endDate && localDate > habit.endDate) return false
  if (isPausedOn(habit, localDate)) return false
  const freq = effectiveFrequency(habit, localDate)
  if (!freq) return false
  if (freq.cadence === 'daily') return true
  return freq.daysOfWeek.includes(weekdayOf(localDate))
}

/** [start, end] 区间内的所有应执行日期（升序）。 */
export function scheduledDatesInRange(
  habit: Habit,
  start: string,
  end: string,
): string[] {
  const out: string[] = []
  let d = start
  let guard = 0
  while (d <= end && guard < 400) {
    if (isScheduledOn(habit, d)) out.push(d)
    d = addDaysToDate(d, 1)
    guard++
  }
  return out
}

/**
 * 连续次数：从今天（若已打卡）或昨天（若今天尚未打卡）起，往前连续应执行且已打卡的天数；
 * 休息日跳过但不打断。
 */
export function computeStreak(
  habit: Habit,
  checkinDates: Set<string>,
  today: string,
): number {
  let streak = 0
  let cursor = checkinDates.has(today) ? today : addDaysToDate(today, -1)
  for (let i = 0; i < 366; i++) {
    if (cursor < habit.startDate) break
    if (isScheduledOn(habit, cursor)) {
      if (checkinDates.has(cursor)) streak++
      else break
    }
    cursor = addDaysToDate(cursor, -1)
  }
  return streak
}

export interface HabitWeekStats {
  /** 本周截至今天已到来的应打卡机会数（分母）；0 表示本周暂无安排。 */
  opportunities: number
  completed: number
  /** 0-1；无机会时为 null。 */
  rate: number | null
}

/** 本周达成率：分母仅统计本周截至今天已经到来的应打卡机会。 */
export function computeWeekStats(
  habit: Habit,
  checkinDates: Set<string>,
  weekStart: string,
  today: string,
  weekEnd: string,
): HabitWeekStats {
  const end = today < weekEnd ? today : weekEnd
  const dates = scheduledDatesInRange(habit, weekStart, end)
  const opportunities = dates.length
  const completed = dates.filter((d) => checkinDates.has(d)).length
  return {
    opportunities,
    completed,
    rate: opportunities === 0 ? null : completed / opportunities,
  }
}

/** 生成习惯的初始频率版本（创建时使用）。 */
export function initialScheduleVersion(
  startDate: string,
  frequency: HabitFrequency,
): HabitScheduleVersion {
  return { effectiveFrom: startDate, frequency }
}

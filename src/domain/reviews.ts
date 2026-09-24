/**
 * 周期复盘业务规则（纯函数）。
 */

import type { ActivityLog, Habit, HabitCheckin, Task, ReviewStats } from './entities'
import { isScheduledOn } from './habits'
import { addDaysToDate } from '@/lib/date'

export const DEFAULT_REVIEW_QUESTIONS = [
  '这段时间最值得保留的进展是什么？',
  '哪些事情没有按预期推进，原因是什么？',
  '哪些投入让我更有能量？',
  '下一周期最重要的一到三件事是什么？',
]

export type { ReviewStats }

function sumMinutes(activities: ActivityLog[], kind: ActivityLog['kind']): number {
  return activities
    .filter((a) => a.kind === kind)
    .reduce((sum, a) => sum + (a.durationMinutes ?? 0), 0)
}

/**
 * 计算某周期的统计快照。区间 [start, end]（含），按应用时区语义传入纯日期。
 * 任务完成数按 completedLocalDate 落在区间内统计。
 */
export function computeReviewStats(input: {
  tasks: Task[]
  activities: ActivityLog[]
  habits: Habit[]
  checkins: HabitCheckin[]
  start: string
  end: string
}): ReviewStats {
  const { tasks, activities, habits, checkins, start, end } = input

  const tasksCompleted = tasks.filter(
    (t) => t.status === 'done' && t.completedLocalDate && t.completedLocalDate >= start && t.completedLocalDate <= end,
  ).length

  const inRange = activities.filter((a) => a.localDate >= start && a.localDate <= end)

  // 习惯达成：区间内应执行且已打卡。
  const checked = new Map<string, Set<string>>()
  for (const c of checkins) {
    let set = checked.get(c.habitId)
    if (!set) {
      set = new Set()
      checked.set(c.habitId, set)
    }
    set.add(c.localDate)
  }
  let habitOpportunities = 0
  let habitCompleted = 0
  for (const h of habits) {
    let d = start
    let guard = 0
    while (d <= end && guard < 400) {
      if (isScheduledOn(h, d)) {
        habitOpportunities++
        if (checked.get(h.id)?.has(d)) habitCompleted++
      }
      d = addDaysToDate(d, 1)
      guard++
    }
  }

  return {
    tasksCompleted,
    learningMinutes: sumMinutes(inRange, 'learning'),
    hobbyMinutes: sumMinutes(inRange, 'hobby'),
    workoutMinutes: sumMinutes(inRange, 'workout'),
    habitOpportunities,
    habitCompleted,
  }
}

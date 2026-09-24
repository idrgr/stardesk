/**
 * 约 1000 条代表性数据，仅供开发态 / Playwright 负载观察。
 * 幂等：同一数据库只注入一次。不走演示空间种子，避免污染个人演示数据语义。
 */

import type { StarDeskDB } from '@/data/db/db'
import { newBase } from '@/data/repositories/base'
import { ensureBuiltinModules } from '@/data/repositories/modules'
import { addDaysToDate, todayInTimeZone } from '@/lib/date'
import type { ActivityKind, TaskPriority, TaskStatus } from '@/domain/enums'

const META_KEY = 'largeSeed'

export interface LargeSeedCounts {
  goals: number
  tasks: number
  activities: number
  notes: number
  habits: number
  total: number
}

const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled']
const KINDS: ActivityKind[] = ['learning', 'hobby', 'workout', 'generic']

export async function seedLargeDataset(db: StarDeskDB, timeZone = 'Asia/Shanghai'): Promise<LargeSeedCounts> {
  const existing = await db.meta.get(META_KEY)
  if (existing) {
    return JSON.parse(existing.value) as LargeSeedCounts
  }

  const today = todayInTimeZone(timeZone)
  const modules = await ensureBuiltinModules(db)
  const moduleIds = modules.map((m) => m.id)

  const goals = Array.from({ length: 20 }, (_, i) => ({
    ...newBase(),
    moduleId: moduleIds[i % moduleIds.length],
    title: `负载目标 ${i + 1}`,
    description: i % 5 === 0 ? '带较长描述的目标，用于检查卡片截断与换行是否正常。'.repeat(2) : '',
    startDate: addDaysToDate(today, -30),
    targetDate: addDaysToDate(today, 30),
    status: i % 7 === 0 ? ('done' as const) : ('in_progress' as const),
    progressMode: 'auto' as const,
    manualProgress: null,
  }))

  const tasks = Array.from({ length: 700 }, (_, i) => {
    const status = STATUSES[i % STATUSES.length]
    const long = i % 17 === 0
    return {
      ...newBase(),
      moduleId: moduleIds[i % moduleIds.length],
      goalId: goals[i % goals.length].id,
      projectId: null,
      parentTaskId: null,
      title: long
        ? `负载任务 ${i + 1} ${'非常长的标题用于检查截断与换行 '.repeat(4)}`
        : `负载任务 ${i + 1}`,
      description: long ? '描述也会偏长，确认详情抽屉不会撑破视口。'.repeat(6) : '',
      status,
      priority: PRIORITIES[i % PRIORITIES.length],
      plannedDate: i % 3 === 0 ? addDaysToDate(today, -(i % 14)) : null,
      scheduledTime: null,
      dueDate: i % 11 === 0 ? addDaysToDate(today, -2) : null,
      estimatedMinutes: 15 + (i % 8) * 10,
      tags: i % 9 === 0 ? ['负载', '长标签'] : [],
      completedAt: status === 'done' ? new Date().toISOString() : null,
      completedLocalDate: status === 'done' ? addDaysToDate(today, -(i % 10)) : null,
      archivedAt: null,
    }
  })

  const activities = Array.from({ length: 200 }, (_, i) => {
    const kind = KINDS[i % KINDS.length]
    return {
      ...newBase(),
      moduleId: moduleIds[i % moduleIds.length],
      projectId: null,
      taskId: null,
      kind,
      localDate: addDaysToDate(today, -(i % 30)),
      title: `负载活动 ${i + 1}`,
      durationMinutes: 10 + (i % 12) * 5,
      note: i % 8 === 0 ? '较长备注，观察领域页列表。'.repeat(3) : '',
      sourceFocusSessionId: null,
      details:
        kind === 'workout'
          ? { workout: { workoutType: 'running' as const, distanceKm: 3 + (i % 5), intensity: 1 + (i % 5) } }
          : kind === 'learning'
            ? { learning: { topic: '负载主题', takeaway: '观察趋势图' } }
            : {},
    }
  })

  const notes = Array.from({ length: 50 }, (_, i) => ({
    ...newBase(),
    moduleId: moduleIds[i % moduleIds.length],
    projectId: null,
    goalId: null,
    title: `负载笔记 ${i + 1}`,
    bodyMarkdown: i % 4 === 0 ? '# 长笔记\n\n' + '段落。'.repeat(40) : '短笔记',
    noteType: 'note' as const,
    tags: ['负载'],
    pinned: i === 0,
    archivedAt: null,
  }))

  const habits = Array.from({ length: 30 }, (_, i) => ({
    ...newBase(),
    moduleId: moduleIds[i % moduleIds.length],
    goalId: null,
    title: `负载习惯 ${i + 1}`,
    description: '',
    enabled: true,
    startDate: addDaysToDate(today, -40),
    endDate: null,
    scheduleVersions: [
      {
        effectiveFrom: addDaysToDate(today, -40),
        frequency: { cadence: 'daily' as const, daysOfWeek: [] as number[] },
      },
    ],
    pauseIntervals: [],
    archivedAt: null,
  }))

  await db.transaction('rw', [db.goals, db.tasks, db.activityLogs, db.notes, db.habits, db.meta], async () => {
      await db.goals.bulkAdd(goals)
      await db.tasks.bulkAdd(tasks)
      await db.activityLogs.bulkAdd(activities)
      await db.notes.bulkAdd(notes)
      await db.habits.bulkAdd(habits)
      const counts: LargeSeedCounts = {
        goals: goals.length,
        tasks: tasks.length,
        activities: activities.length,
        notes: notes.length,
        habits: habits.length,
        total: goals.length + tasks.length + activities.length + notes.length + habits.length,
      }
      await db.meta.put({ key: META_KEY, value: JSON.stringify(counts) })
  })

  return {
    goals: goals.length,
    tasks: tasks.length,
    activities: activities.length,
    notes: notes.length,
    habits: habits.length,
    total: goals.length + tasks.length + activities.length + notes.length + habits.length,
  }
}

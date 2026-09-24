import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { StarDeskDB } from './db/db'
import { startFocus, getActiveSession, pauseFocus, resumeFocus, completeFocus, abandonFocus, listCompletedSessions } from './repositories/focus'
import { createReview, getReviewForPeriod, convertNextActions, updateReview } from './repositories/reviews'
import { computeReviewStats } from '@/domain/reviews'
import { newId } from '@/lib/id'
import { queryTasks } from './repositories/tasks'
import { createActivity } from './repositories/activities'
import { createHabit } from './repositories/habits'

let db: StarDeskDB

beforeEach(() => {
  db = new StarDeskDB(`test-${newId()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('专注仓储', () => {
  it('同时仅一个活动会话（重复启动返回已有会话）', async () => {
    const s1 = await startFocus(db, { plannedSeconds: 60 })
    const s2 = await startFocus(db, { plannedSeconds: 120 })
    expect(s2.id).toBe(s1.id)
    expect((await getActiveSession(db))?.id).toBe(s1.id)
  })

  it('暂停结算片段，继续重算目标结束时间，结束只写一次记录', async () => {
    const s = await startFocus(db, { plannedSeconds: 60 })
    await pauseFocus(db, s.id)
    const paused = await getActiveSession(db)
    expect(paused?.status).toBe('paused')
    expect(paused?.accumulatedActiveSeconds).toBeGreaterThanOrEqual(0)

    await resumeFocus(db, s.id)
    const running = await getActiveSession(db)
    expect(running?.status).toBe('running')
    expect(running?.targetEndAt).toBeTruthy()

    await completeFocus(db, s.id, '2026-09-24')
    await completeFocus(db, s.id, '2026-09-24') // 重复结束不重复计时
    const completed = await listCompletedSessions(db)
    expect(completed).toHaveLength(1)
    expect(completed[0].status).toBe('done')
    expect(completed[0].actualSeconds).not.toBeNull()
  })

  it('放弃会话不进入统计', async () => {
    const s = await startFocus(db, { plannedSeconds: 60 })
    await abandonFocus(db, s.id)
    expect(await listCompletedSessions(db)).toHaveLength(0)
  })
})

describe('复盘', () => {
  it('相同周期类型与日期范围只有一份复盘', async () => {
    await createReview(db, { periodType: 'week', startDate: '2026-09-21', endDate: '2026-09-27' })
    await createReview(db, { periodType: 'week', startDate: '2026-09-21', endDate: '2026-09-27' })
    const r = await getReviewForPeriod(db, 'week', '2026-09-21', '2026-09-27')
    expect(r).toBeTruthy()
    const all = await db.reviews.toArray()
    expect(all.filter((x) => !x.deletedAt)).toHaveLength(1)
  })

  it('下一周期行动转任务幂等', async () => {
    const review = await createReview(db, { periodType: 'week', startDate: '2026-09-21', endDate: '2026-09-27' })
    const actions = [{ title: '读一章书', plannedDate: '2026-09-28', moduleId: null }]
    const ids1 = await convertNextActions(db, review.id, actions)
    expect(ids1).toHaveLength(1)
    const ids2 = await convertNextActions(db, review.id, actions)
    expect(ids2).toHaveLength(0) // 防重复
    const tasks = await queryTasks(db, { keyword: '读一章书' })
    expect(tasks).toHaveLength(1)
  })

  it('复盘统计快照：任务完成数与活动时长', async () => {
    const task = {
      id: newId(), createdAt: '2026-09-22T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z',
      revision: 1, deletedAt: null, deleteBatchId: null,
      moduleId: null, goalId: null, projectId: null, parentTaskId: null,
      title: '完成的任务', description: '', status: 'done' as const, priority: 'medium' as const,
      plannedDate: null, scheduledTime: null, dueDate: null, estimatedMinutes: null, tags: [],
      completedAt: '2026-09-22T00:00:00.000Z', completedLocalDate: '2026-09-22', archivedAt: null,
    }
    await db.tasks.add(task)
    await createActivity(db, { kind: 'learning', moduleId: 'm1', localDate: '2026-09-23', title: '学习', durationMinutes: 30 })

    const stats = computeReviewStats({ tasks: [task], activities: await db.activityLogs.toArray(), habits: [], checkins: [], start: '2026-09-21', end: '2026-09-27' })
    expect(stats.tasksCompleted).toBe(1)
    expect(stats.learningMinutes).toBe(30)
  })
})
